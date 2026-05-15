"use server";

import { unstable_cache } from "next/cache";

import { getConnection } from "@/lib/db";
import { buildSucursalFilter } from "@/lib/sql-helpers";
import { getAuthContext } from "@/lib/get-auth-context";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type EficienciaKpis = {
  ordenesHoy: number;
  volumenOrdenes: number;
  promedioDiario: number;
  montoTotal: number;
};

export type TendenciaOrden = {
  mes_nombre: string;
  volumen_ordenes: number;
};

export type TipoLenteDetalle = {
  tipo_lente_descripcion: string;
  volumen_ordenes: number;
  monto_total: number;
};

export type OrdenesSucursal = {
  nombre_sucursal: string;
  volumen_ordenes: number;
};

export type EficienciaData = {
  kpis: EficienciaKpis;
  tendencia: TendenciaOrden[];
  tipoLente: TipoLenteDetalle[];
  ordenesSucursal: OrdenesSucursal[];
};

type Params = {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  sucursalId: number | null;
};

type FetchParams = Params & { userId: number; isSupervisor: boolean };

// ─── Tipos de fila DB (privados) ─────────────────────────────────────────────

type ValorRow        = { valor: number };
type PeriodoStatsRow = { volumen_ordenes: number; monto_total: number; promedio_ordenes_diarias: number };
// periodo viene de la DB como 'YYYY-MM'; mes_nombre se deriva en TypeScript
type TendenciaRow    = { periodo: string; volumen_ordenes: number };
// tipo_lente (DB) y total_ordenes (DB) son alias en SQL para mantener el contrato TS
type TipoLenteRow    = { tipo_lente_descripcion: string; volumen_ordenes: number; monto_total: number };
type SucursalRow     = { nombre_sucursal: string; volumen_ordenes: number };

// ─── Auxiliares ───────────────────────────────────────────────────────────────

// Nombres de mes en español derivados del campo periodo ('YYYY-MM') sin depender del locale SQL.
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Cache interno ────────────────────────────────────────────────────────────
// La guarda de auth vive fuera: unstable_cache no puede capturar APIs dinámicas.

const fetchEficienciaData = unstable_cache(
  async (params: FetchParams): Promise<EficienciaData> => {
    const { startDate, endDate, sucursalId, userId, isSupervisor } = params;

    const pool = await getConnection();

    const req = () =>
      pool
        .request()
        .input("startDate",    startDate)
        .input("endDate",      endDate)
        .input("sucursalId",   sucursalId)
        .input("userId",       userId)
        .input("isSupervisor", isSupervisor ? 1 : 0);

    // ── 5 queries en paralelo ────────────────────────────────────────────────
    //
    //  Fuente principal: Dash_Eficiencia_Agregado (dea)
    //  · fecha_pedido es DATE → filtros BETWEEN son SARGables sin CAST.
    //  · total_ordenes reemplaza COUNT(id_pedido) — lectura directa del total pre-calculado.
    //  · tipo_lente reemplaza tipo_lente_descripcion — alias SQL mantiene contrato TS.
    //  · periodo ('YYYY-MM') reemplaza mes_nombre — mes_nombre se deriva en TypeScript.
    //  · id_sucursal no tiene nombre_sucursal pre-unido → LEFT JOIN Dim_Sucursales.

    const [
      ordenesHoyRes,
      periodoStatsRes,
      tendenciaRes,
      tipoLenteRes,
      ordenesSucursalRes,
    ] = await Promise.all([

      // [1] Órdenes Hoy — snapshot del día actual (zona GMT-4)
      req().query(`
        SELECT ISNULL(SUM(dea.total_ordenes), 0) AS valor
        FROM dbo.Dash_Eficiencia_Agregado dea
        WHERE dea.fecha_pedido = CAST(GETDATE() AT TIME ZONE 'UTC' AT TIME ZONE 'SA Western Standard Time' AS DATE)
          ${buildSucursalFilter("dea")}
      `),

      // [2] KPIs período — aggregación directa sobre totales pre-calculados.
      // COUNT(DISTINCT fecha_pedido) es SARGable porque fecha_pedido ya es DATE.
      req().query(`
        SELECT
          ISNULL(SUM(dea.total_ordenes), 0)                                           AS volumen_ordenes,
          ISNULL(SUM(dea.monto_total),   0)                                           AS monto_total,
          ISNULL(
            SUM(dea.total_ordenes) * 1.0 / NULLIF(COUNT(DISTINCT dea.fecha_pedido), 0),
            0
          )                                                                            AS promedio_ordenes_diarias
        FROM dbo.Dash_Eficiencia_Agregado dea
        WHERE dea.fecha_pedido BETWEEN @startDate AND @endDate
          ${buildSucursalFilter("dea")}
      `),

      // [3] Tendencia mensual — últimos 12 meses desde @endDate.
      // GROUP BY periodo ('YYYY-MM'): más eficiente que GROUP BY mes_nombre + anio + mes.
      // mes_nombre se convierte en TypeScript desde el periodo para evitar dependencias de locale SQL.
      req().query(`
        SELECT
          dea.periodo                           AS periodo,
          ISNULL(SUM(dea.total_ordenes), 0)     AS volumen_ordenes
        FROM dbo.Dash_Eficiencia_Agregado dea
        WHERE dea.fecha_pedido >= DATEADD(MONTH, -12, CAST(@endDate AS DATE))
          AND dea.fecha_pedido <= CAST(@endDate AS DATE)
          ${buildSucursalFilter("dea")}
        GROUP BY dea.periodo
        ORDER BY dea.periodo ASC
      `),

      // [4] Mix por Tipo de Lente — alias SQL mantiene contrato TypeScript intacto.
      // tipo_lente (DB) → tipo_lente_descripcion (TS alias)
      // total_ordenes (DB) → volumen_ordenes (TS alias)
      req().query(`
        SELECT
          ISNULL(dea.tipo_lente, 'Sin Definir')  AS tipo_lente_descripcion,
          ISNULL(SUM(dea.total_ordenes), 0)       AS volumen_ordenes,
          ISNULL(SUM(dea.monto_total),   0)       AS monto_total
        FROM dbo.Dash_Eficiencia_Agregado dea
        WHERE dea.fecha_pedido BETWEEN @startDate AND @endDate
          ${buildSucursalFilter("dea")}
        GROUP BY dea.tipo_lente
        ORDER BY volumen_ordenes DESC
      `),

      // [5] Órdenes por Sucursal — LEFT JOIN Dim_Sucursales (nombre_sucursal no pre-unido en tabla agregada).
      req().query(`
        SELECT
          ds.nombre_sucursal,
          ISNULL(SUM(dea.total_ordenes), 0) AS volumen_ordenes
        FROM dbo.Dash_Eficiencia_Agregado dea
        LEFT JOIN dbo.Dim_Sucursales ds ON dea.id_sucursal = ds.id_sucursal
        WHERE dea.fecha_pedido BETWEEN @startDate AND @endDate
          ${buildSucursalFilter("dea")}
        GROUP BY ds.nombre_sucursal
        ORDER BY volumen_ordenes DESC
      `),
    ]);

    // ── Procesamiento TypeScript — costo O(n), cero round-trips adicionales ───

    const stats = (periodoStatsRes.recordset as PeriodoStatsRow[])[0]
      ?? { volumen_ordenes: 0, promedio_ordenes_diarias: 0, monto_total: 0 };

    // periodo 'YYYY-MM' → mes_nombre en español (sin depender del locale del servidor SQL)
    const tendencia: TendenciaOrden[] = (tendenciaRes.recordset as TendenciaRow[]).map((r) => ({
      mes_nombre:      MESES[parseInt(r.periodo.slice(5, 7), 10) - 1] ?? r.periodo,
      volumen_ordenes: Number(r.volumen_ordenes ?? 0),
    }));

    return {
      kpis: {
        ordenesHoy:     Number((ordenesHoyRes.recordset as ValorRow[])[0]?.valor ?? 0),
        volumenOrdenes: Number(stats.volumen_ordenes ?? 0),
        promedioDiario: Math.round(Number(stats.promedio_ordenes_diarias ?? 0) * 100) / 100,
        montoTotal:     Math.round(Number(stats.monto_total ?? 0) * 100) / 100,
      },
      tendencia,
      tipoLente: (tipoLenteRes.recordset as TipoLenteRow[]).map((r) => ({
        tipo_lente_descripcion: String(r.tipo_lente_descripcion ?? ""),
        volumen_ordenes:        Number(r.volumen_ordenes ?? 0),
        monto_total:            Number(r.monto_total ?? 0),
      })),
      ordenesSucursal: (ordenesSucursalRes.recordset as SucursalRow[]).map((r) => ({
        nombre_sucursal: String(r.nombre_sucursal ?? ""),
        volumen_ordenes: Number(r.volumen_ordenes ?? 0),
      })),
    };
  },
  ["dash-eficiencia"],
  { revalidate: 3600, tags: ["dash-eficiencia"] },
);

// ─── Acción principal ─────────────────────────────────────────────────────────
// La guarda de auth vive fuera del cache: unstable_cache no puede capturar
// APIs dinámicas (headers/cookies) como getAuthContext().

export async function getEficienciaData(
  params: Params,
): Promise<{ success: boolean; data?: EficienciaData; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "No autorizado" };

    const data = await fetchEficienciaData({
      ...params,
      userId:       auth.userId,
      isSupervisor: auth.isSupervisor,
    });
    return { success: true, data };
  } catch (err) {
    console.error("[ERROR][getEficienciaData]", err);
    return { success: false, error: "Error al obtener los datos de eficiencia de órdenes." };
  }
}
