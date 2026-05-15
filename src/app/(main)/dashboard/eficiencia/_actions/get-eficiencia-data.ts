"use server";

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

// ─── Tipos de fila DB (privados) ─────────────────────────────────────────────

type ValorRow        = { valor: number };
type PeriodoStatsRow = { volumen_ordenes: number; monto_total: number; promedio_ordenes_diarias: number };
type TendenciaRow    = { mes_nombre: string; volumen_ordenes: number };
type TipoLenteRow    = { tipo_lente_descripcion: string; volumen_ordenes: number; monto_total: number };
type SucursalRow     = { nombre_sucursal: string; volumen_ordenes: number };

// ─── Acción principal ─────────────────────────────────────────────────────────

export async function getEficienciaData(
  params: Params,
): Promise<{ success: boolean; data?: EficienciaData; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "No autorizado" };
    const { userId, isSupervisor } = auth;
    const { startDate, endDate, sucursalId } = params;

    const pool = await getConnection();

    const req = () =>
      pool
        .request()
        .input("startDate", startDate)
        .input("endDate", endDate)
        .input("sucursalId", sucursalId)
        .input("userId", userId)
        .input("isSupervisor", isSupervisor ? 1 : 0);

    // ── Consultas en paralelo ────────────────────────────────────────────────
    const [
      ordenesHoyRes,
      periodoStatsRes,
      tendenciaRes,
      tipoLenteRes,
      ordenesSucursalRes,
    ] = await Promise.all([
      // 1. Órdenes Hoy (Snapshot ignorando startDate y endDate del filtro)
      req().query(`
        SELECT ISNULL(COUNT(id_pedido), 0) AS valor
        FROM dbo.Fact_Eficiencia_Ordenes
        WHERE CAST(fecha_pedido AS DATE) = CAST(GETDATE() AT TIME ZONE 'UTC' AT TIME ZONE 'SA Western Standard Time' AS DATE)
        ${buildSucursalFilter()}
      `),

      // 2. Volumen y KPIs de todo el periodo
      req().query(`
        SELECT
          ISNULL(COUNT(id_pedido), 0) AS volumen_ordenes,
          ISNULL(SUM(monto_total), 0) AS monto_total,
          CASE WHEN COUNT(DISTINCT CAST(fecha_pedido AS DATE)) = 0
               THEN 0
               ELSE CAST(COUNT(id_pedido) AS FLOAT) / COUNT(DISTINCT CAST(fecha_pedido AS DATE))
          END AS promedio_ordenes_diarias
        FROM dbo.Fact_Eficiencia_Ordenes
        WHERE CAST(fecha_pedido AS DATE) BETWEEN @startDate AND @endDate
        ${buildSucursalFilter()}
      `),

      // 3. Tendencia (Últimos 12 meses respecto a endDate)
      req().query(`
        SELECT
          mes_nombre,
          YEAR(fecha_pedido) AS anio,
          MONTH(fecha_pedido) AS mes,
          ISNULL(COUNT(id_pedido), 0) AS volumen_ordenes
        FROM dbo.Fact_Eficiencia_Ordenes
        WHERE CAST(fecha_pedido AS DATE) >= DATEADD(month, -12, CAST(@endDate AS DATE))
          AND CAST(fecha_pedido AS DATE) <= @endDate
        ${buildSucursalFilter()}
        GROUP BY mes_nombre, YEAR(fecha_pedido), MONTH(fecha_pedido)
        ORDER BY YEAR(fecha_pedido) ASC, MONTH(fecha_pedido) ASC
      `),

      // 4. Detalle por Tipo Lente (Para Chart y Tabla)
      req().query(`
        SELECT
          ISNULL(tipo_lente_descripcion, 'Sin Definir') AS tipo_lente_descripcion,
          ISNULL(COUNT(id_pedido), 0) AS volumen_ordenes,
          ISNULL(SUM(monto_total), 0) AS monto_total
        FROM dbo.Fact_Eficiencia_Ordenes
        WHERE CAST(fecha_pedido AS DATE) BETWEEN @startDate AND @endDate
        ${buildSucursalFilter()}
        GROUP BY tipo_lente_descripcion
        ORDER BY volumen_ordenes DESC
      `),

      // 5. Órdenes por Sucursal (Para BarChart Horizontal)
      req().query(`
        SELECT
          ds.nombre_sucursal,
          ISNULL(COUNT(f.id_pedido), 0) AS volumen_ordenes
        FROM dbo.Fact_Eficiencia_Ordenes f
        INNER JOIN dbo.Dim_Sucursales ds ON f.id_sucursal = ds.id_sucursal
        WHERE CAST(f.fecha_pedido AS DATE) BETWEEN @startDate AND @endDate
        ${buildSucursalFilter("f")}
        GROUP BY ds.nombre_sucursal
        ORDER BY volumen_ordenes DESC
      `),
    ]);

    const stats = (periodoStatsRes.recordset as PeriodoStatsRow[])[0]
      ?? { volumen_ordenes: 0, promedio_ordenes_diarias: 0, monto_total: 0 };

    return {
      success: true,
      data: {
        kpis: {
          ordenesHoy:     Number((ordenesHoyRes.recordset as ValorRow[])[0]?.valor ?? 0),
          volumenOrdenes: Number(stats.volumen_ordenes ?? 0),
          promedioDiario: Math.round(Number(stats.promedio_ordenes_diarias ?? 0) * 100) / 100,
          montoTotal:     Math.round(Number(stats.monto_total ?? 0) * 100) / 100,
        },
        tendencia: (tendenciaRes.recordset as TendenciaRow[]).map((r) => ({
          mes_nombre:      String(r.mes_nombre ?? ""),
          volumen_ordenes: Number(r.volumen_ordenes ?? 0),
        })),
        tipoLente: (tipoLenteRes.recordset as TipoLenteRow[]).map((r) => ({
          tipo_lente_descripcion: String(r.tipo_lente_descripcion ?? ""),
          volumen_ordenes:        Number(r.volumen_ordenes ?? 0),
          monto_total:            Number(r.monto_total ?? 0),
        })),
        ordenesSucursal: (ordenesSucursalRes.recordset as SucursalRow[]).map((r) => ({
          nombre_sucursal: String(r.nombre_sucursal ?? ""),
          volumen_ordenes: Number(r.volumen_ordenes ?? 0),
        })),
      },
    };
  } catch (err) {
    console.error("[ERROR][getEficienciaData]", err);
    return { success: false, error: "Error al obtener los datos de eficiencia de órdenes." };
  }
}
