"use server";

import { unstable_cache } from "next/cache";

import { getConnection } from "@/lib/db";
import { buildSucursalFilter } from "@/lib/sql-helpers";
import { getAuthContext } from "@/lib/get-auth-context";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type ClinicaKpis = {
  totalExamenes: number;
  pctConversion: number;
  examenesHoy: number;
  promedioDiario: number;
  convertidos: number;
  noConvertidos: number;
};

export type TendenciaExamen = {
  mes_examen_nombre: string;
  total_examenes: number;
};

export type VolumenConversion = {
  mes_examen_nombre: string;
  convertidos: number;
  no_convertidos: number;
  pct_conversion: number;
};

export type GeneroExamen = {
  genero_label: string;
  total_examenes: number;
};

export type EdadExamen = {
  rango_edad_descripcion: string;
  min_edad: number;
  total_examenes: number;
};

export type SucursalExamen = {
  nombre_sucursal: string;
  total_examenes: number;
};

export type ClinicaData = {
  kpis: ClinicaKpis;
  tendencia: TendenciaExamen[];
  volumenConversion: VolumenConversion[];
  genero: GeneroExamen[];
  edad: EdadExamen[];
  topSucursales: SucursalExamen[];
};

type Params = {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  sucursalId: number | null;
};

type FetchParams = Params & { userId: number; isSupervisor: boolean };

// ─── Tipos de fila DB (privados) ─────────────────────────────────────────────

type ValorRow        = { valor: number };
type PeriodoStatsRow = { total_examenes: number; convertidos: number; no_convertidos: number; promedio_diario: number };
// Fila fusionada tendencia + volumen/conversión — misma query, distintas proyecciones en TS
type TendenciaVolRow = { periodo: string; total_examenes: number; convertidos: number; no_convertidos: number };
type GeneroRow       = { genero_label: string; total_examenes: number };
type EdadRow         = { rango_edad_descripcion: string; total_examenes: number };
type SucursalRow     = { nombre_sucursal: string; total_examenes: number };

// ─── Auxiliares ───────────────────────────────────────────────────────────────

function extractMinAge(rango: string): number {
  const match = rango.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// Nombres de mes en español derivados del campo periodo ('YYYY-MM') — sin depender del locale de SQL Server.
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Cache interno ────────────────────────────────────────────────────────────
// La guarda de auth vive fuera: unstable_cache no puede capturar APIs dinámicas.

const fetchClinicaData = unstable_cache(
  async (params: FetchParams): Promise<ClinicaData> => {
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

    // ── 6 queries en paralelo (reducido desde 7) ─────────────────────────────
    //
    //  [1] Exámenes Hoy       — Dash_Clinico_Agregado (fecha_examen = hoy GMT-4)
    //  [2] KPIs período       — Dash_Clinico_Agregado (aggregación condicional)
    //  [3] Tendencia + Volumen FUSIONADOS — Dash_Clinico_Agregado GROUP BY periodo
    //      Una sola pasada alimenta dos visualizaciones; mes_examen_nombre se
    //      deriva en TypeScript desde el campo periodo ('YYYY-MM').
    //  [4] Género  — Fact_Examenes (genero_label no disponible en tabla agregada)
    //  [5] Edad    — Fact_Examenes (rango_edad_descripcion no disponible en tabla agregada)
    //  [6] Top Sucursales — Dash_Clinico_Agregado (nombre_sucursal pre-unido, sin JOIN)

    const [
      examenesHoyRes,
      periodoStatsRes,
      tendenciaVolumenRes,
      generoRes,
      edadRes,
      topSucursalesRes,
    ] = await Promise.all([

      // [1] Exámenes Hoy — snapshot del día actual (zona GMT-4)
      req().query(`
        SELECT ISNULL(SUM(dca.total_examenes), 0) AS valor
        FROM dbo.Dash_Clinico_Agregado dca
        WHERE dca.fecha_examen = CAST(GETDATE() AT TIME ZONE 'UTC' AT TIME ZONE 'SA Western Standard Time' AS DATE)
          ${buildSucursalFilter("dca")}
      `),

      // [2] KPIs período — aggregación condicional por estado_conversion.
      // Una sola fila devuelve total, convertidos, no_convertidos y promedio_diario.
      req().query(`
        SELECT
          ISNULL(SUM(dca.total_examenes), 0)                                                                    AS total_examenes,
          ISNULL(SUM(CASE WHEN dca.estado_conversion = 'CONVERTIDO'    THEN dca.total_examenes ELSE 0 END), 0)  AS convertidos,
          ISNULL(SUM(CASE WHEN dca.estado_conversion = 'NO CONVERTIDO' THEN dca.total_examenes ELSE 0 END), 0)  AS no_convertidos,
          ISNULL(
            SUM(dca.total_examenes) * 1.0 / NULLIF(COUNT(DISTINCT dca.fecha_examen), 0),
            0
          )                                                                                                      AS promedio_diario
        FROM dbo.Dash_Clinico_Agregado dca
        WHERE dca.fecha_examen BETWEEN @startDate AND @endDate
          ${buildSucursalFilter("dca")}
      `),

      // [3] Tendencia + Volumen/Conversión FUSIONADOS — últimos 12 meses.
      // GROUP BY periodo ('YYYY-MM') → cada fila alimenta ambas visualizaciones.
      // mes_examen_nombre se convierte en TypeScript para evitar dependencias de locale SQL.
      req().query(`
        SELECT
          dca.periodo                                                                                            AS periodo,
          ISNULL(SUM(dca.total_examenes), 0)                                                                    AS total_examenes,
          ISNULL(SUM(CASE WHEN dca.estado_conversion = 'CONVERTIDO'    THEN dca.total_examenes ELSE 0 END), 0)  AS convertidos,
          ISNULL(SUM(CASE WHEN dca.estado_conversion = 'NO CONVERTIDO' THEN dca.total_examenes ELSE 0 END), 0)  AS no_convertidos
        FROM dbo.Dash_Clinico_Agregado dca
        WHERE dca.fecha_examen >= DATEADD(MONTH, -12, CAST(@endDate AS DATE))
          AND dca.fecha_examen <= CAST(@endDate AS DATE)
          ${buildSucursalFilter("dca")}
        GROUP BY dca.periodo
        ORDER BY dca.periodo ASC
      `),

      // [4] Género — Fact_Examenes + Dim_Clientes (genero_label no está en la tabla agregada)
      req().query(`
        SELECT
          ISNULL(dc.genero_label, 'Sin Definir') AS genero_label,
          ISNULL(COUNT(DISTINCT fe.id_examen), 0) AS total_examenes
        FROM dbo.Fact_Examenes fe
        LEFT JOIN dbo.Dim_Clientes dc ON fe.id_cliente = dc.id_cliente
        WHERE CAST(fe.fecha_examen_completa AS DATE) BETWEEN @startDate AND @endDate
          ${buildSucursalFilter("fe")}
        GROUP BY dc.genero_label
        ORDER BY total_examenes DESC
      `),

      // [5] Rango de Edad — Fact_Examenes + Dim_Clientes (rango_edad_descripcion no está en la tabla agregada)
      req().query(`
        SELECT
          ISNULL(dc.rango_edad_descripcion, 'Sin Definir') AS rango_edad_descripcion,
          ISNULL(COUNT(DISTINCT fe.id_examen), 0) AS total_examenes
        FROM dbo.Fact_Examenes fe
        LEFT JOIN dbo.Dim_Clientes dc ON fe.id_cliente = dc.id_cliente
        WHERE CAST(fe.fecha_examen_completa AS DATE) BETWEEN @startDate AND @endDate
          ${buildSucursalFilter("fe")}
        GROUP BY dc.rango_edad_descripcion
      `),

      // [6] Top Sucursales — Dash_Clinico_Agregado (nombre_sucursal pre-unido, sin JOIN a Dim_Sucursales)
      req().query(`
        SELECT
          dca.nombre_sucursal,
          ISNULL(SUM(dca.total_examenes), 0) AS total_examenes
        FROM dbo.Dash_Clinico_Agregado dca
        WHERE dca.fecha_examen BETWEEN @startDate AND @endDate
          ${buildSucursalFilter("dca")}
        GROUP BY dca.nombre_sucursal
        ORDER BY total_examenes DESC
      `),
    ]);

    // ── Procesamiento TypeScript — costo O(n), cero round-trips adicionales ───

    const stats = (periodoStatsRes.recordset as PeriodoStatsRow[])[0]
      ?? { total_examenes: 0, convertidos: 0, no_convertidos: 0, promedio_diario: 0 };
    const totalExamenes = Number(stats.total_examenes ?? 0);
    const convertidos   = Number(stats.convertidos ?? 0);
    const pctConversion = totalExamenes > 0 ? Math.round((convertidos / totalExamenes) * 10000) / 100 : 0;

    // Fila fusionada → tendencia y volumenConversion derivados de las mismas filas O(n)
    const tvRows = tendenciaVolumenRes.recordset as TendenciaVolRow[];

    const tendencia: TendenciaExamen[] = tvRows.map((r) => ({
      mes_examen_nombre: MESES[parseInt(r.periodo.slice(5, 7), 10) - 1] ?? r.periodo,
      total_examenes:    Number(r.total_examenes ?? 0),
    }));

    const volumenConversion: VolumenConversion[] = tvRows.map((r) => {
      const total = Number(r.total_examenes ?? 0);
      const conv  = Number(r.convertidos ?? 0);
      return {
        mes_examen_nombre: MESES[parseInt(r.periodo.slice(5, 7), 10) - 1] ?? r.periodo,
        convertidos:       conv,
        no_convertidos:    Number(r.no_convertidos ?? 0),
        pct_conversion:    total > 0 ? Math.round((conv / total) * 10000) / 100 : 0,
      };
    });

    // Edades ordenadas lógicamente por el primer número del rango descriptivo
    const rawEdades = (edadRes.recordset as EdadRow[]).map((r) => {
      const desc = String(r.rango_edad_descripcion ?? "Sin Definir");
      return {
        rango_edad_descripcion: desc,
        min_edad:               extractMinAge(desc),
        total_examenes:         Number(r.total_examenes ?? 0),
      };
    });

    return {
      kpis: {
        examenesHoy:    Number((examenesHoyRes.recordset as ValorRow[])[0]?.valor ?? 0),
        totalExamenes,
        pctConversion,
        promedioDiario: Math.round(Number(stats.promedio_diario ?? 0) * 100) / 100,
        convertidos,
        noConvertidos:  Number(stats.no_convertidos ?? 0),
      },
      tendencia,
      volumenConversion,
      genero: (generoRes.recordset as GeneroRow[]).map((r) => ({
        genero_label:   String(r.genero_label ?? ""),
        total_examenes: Number(r.total_examenes ?? 0),
      })),
      edad: rawEdades.sort((a, b) => a.min_edad - b.min_edad),
      topSucursales: (topSucursalesRes.recordset as SucursalRow[]).map((r) => ({
        nombre_sucursal: String(r.nombre_sucursal ?? ""),
        total_examenes:  Number(r.total_examenes ?? 0),
      })),
    };
  },
  ["dash-clinico"],
  { revalidate: 3600, tags: ["dash-clinico"] },
);

// ─── Acción principal ─────────────────────────────────────────────────────────
// La guarda de auth vive fuera del cache: unstable_cache no puede capturar
// APIs dinámicas (headers/cookies) como getAuthContext().

export async function getClinicaData(
  params: Params,
): Promise<{ success: boolean; data?: ClinicaData; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "No autorizado" };

    const data = await fetchClinicaData({
      ...params,
      userId:       auth.userId,
      isSupervisor: auth.isSupervisor,
    });
    return { success: true, data };
  } catch (err) {
    console.error("[ERROR][getClinicaData]", err);
    return { success: false, error: "Error al obtener los datos de clínica." };
  }
}
