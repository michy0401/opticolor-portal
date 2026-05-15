"use server";

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

// ─── Función auxiliar para ordenar rango de edad ─────────────────────────────
// Extrae el primer número de una cadena para usarlo como criterio de ordenamiento.
function extractMinAge(rango: string): number {
  const match = rango.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// ─── Acción principal ─────────────────────────────────────────────────────────

export async function getClinicaData(
  params: Params,
): Promise<{ success: boolean; data?: ClinicaData; error?: string }> {
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
      examenesHoyRes,
      periodoStatsRes,
      tendenciaRes,
      volumenConversionRes,
      generoRes,
      edadRes,
      topSucursalesRes,
    ] = await Promise.all([
      // 1. Exámenes Hoy (Snapshot ignorando startDate y endDate del filtro)
      req().query(`
        SELECT ISNULL(COUNT(DISTINCT id_examen), 0) AS valor
        FROM dbo.Fact_Examenes
        WHERE CAST(fecha_examen_completa AS DATE) = CAST(GETDATE() AT TIME ZONE 'UTC' AT TIME ZONE 'SA Western Standard Time' AS DATE)
        ${buildSucursalFilter()}
      `),

      // 2. Volumen y KPIs de todo el periodo
      req().query(`
        SELECT 
          ISNULL(COUNT(DISTINCT id_examen), 0) AS total_examenes,
          ISNULL(COUNT(DISTINCT CASE WHEN estado_conversion = 'CONVERTIDO' THEN id_examen END), 0) AS convertidos,
          ISNULL(COUNT(DISTINCT CASE WHEN estado_conversion = 'NO CONVERTIDO' THEN id_examen END), 0) AS no_convertidos,
          CASE WHEN COUNT(DISTINCT CAST(fecha_examen_completa AS DATE)) = 0 
               THEN 0 
               ELSE CAST(COUNT(DISTINCT id_examen) AS FLOAT) / COUNT(DISTINCT CAST(fecha_examen_completa AS DATE)) 
          END AS promedio_diario
        FROM dbo.Fact_Examenes
        WHERE CAST(fecha_examen_completa AS DATE) BETWEEN @startDate AND @endDate
        ${buildSucursalFilter()}
      `),

      // 3. Tendencia Mensual (12 meses respecto a endDate)
      req().query(`
        SELECT 
          mes_examen_nombre,
          YEAR(fecha_examen_completa) AS anio,
          MONTH(fecha_examen_completa) AS mes,
          ISNULL(COUNT(DISTINCT id_examen), 0) AS total_examenes
        FROM dbo.Fact_Examenes
        WHERE CAST(fecha_examen_completa AS DATE) >= DATEADD(month, -12, CAST(@endDate AS DATE))
          AND CAST(fecha_examen_completa AS DATE) <= @endDate
        ${buildSucursalFilter()}
        GROUP BY mes_examen_nombre, YEAR(fecha_examen_completa), MONTH(fecha_examen_completa)
        ORDER BY YEAR(fecha_examen_completa) ASC, MONTH(fecha_examen_completa) ASC
      `),

      // 4. Volumen vs Conversión por mes (Dentro del periodo seleccionado)
      req().query(`
        SELECT 
          mes_examen_nombre,
          YEAR(fecha_examen_completa) AS anio,
          MONTH(fecha_examen_completa) AS mes,
          ISNULL(COUNT(DISTINCT CASE WHEN estado_conversion = 'CONVERTIDO' THEN id_examen END), 0) AS convertidos,
          ISNULL(COUNT(DISTINCT CASE WHEN estado_conversion = 'NO CONVERTIDO' THEN id_examen END), 0) AS no_convertidos,
          ISNULL(COUNT(DISTINCT id_examen), 0) AS total_mes
        FROM dbo.Fact_Examenes
        WHERE CAST(fecha_examen_completa AS DATE) >= DATEADD(month, -12, CAST(@endDate AS DATE))
          AND CAST(fecha_examen_completa AS DATE) <= @endDate
        ${buildSucursalFilter()}
        GROUP BY mes_examen_nombre, YEAR(fecha_examen_completa), MONTH(fecha_examen_completa)
        ORDER BY YEAR(fecha_examen_completa) ASC, MONTH(fecha_examen_completa) ASC
      `),

      // 5. Distribución por Género
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

      // 6. Rango de Edad
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

      // 7. Top Sucursales
      req().query(`
        SELECT 
          ds.nombre_sucursal,
          ISNULL(COUNT(DISTINCT fe.id_examen), 0) AS total_examenes
        FROM dbo.Fact_Examenes fe
        INNER JOIN dbo.Dim_Sucursales ds ON fe.id_sucursal = ds.id_sucursal
        WHERE CAST(fe.fecha_examen_completa AS DATE) BETWEEN @startDate AND @endDate
        ${buildSucursalFilter("fe")}
        GROUP BY ds.nombre_sucursal
        ORDER BY total_examenes DESC
      `),
    ]);

    const stats = periodoStatsRes.recordset[0] || { total_examenes: 0, convertidos: 0, no_convertidos: 0, promedio_diario: 0 };
    const totalExamenes = Number(stats.total_examenes ?? 0);
    const convertidos = Number(stats.convertidos ?? 0);
    const pctConversion = totalExamenes > 0 ? (convertidos / totalExamenes) * 100 : 0;

    // Procesar y ordenar edades
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawEdades = edadRes.recordset.map((r: any) => {
      const desc = String(r.rango_edad_descripcion ?? "Sin Definir");
      return {
        rango_edad_descripcion: desc,
        min_edad: extractMinAge(desc),
        total_examenes: Number(r.total_examenes ?? 0),
      };
    });
    // Ordenar lógicamente por edad mínima
    const sortedEdades = rawEdades.sort((a, b) => a.min_edad - b.min_edad);

    return {
      success: true,
      data: {
        kpis: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          examenesHoy: Number((examenesHoyRes.recordset[0] as any)?.valor ?? 0),
          totalExamenes,
          pctConversion,
          promedioDiario: Number(stats.promedio_diario ?? 0),
          convertidos,
          noConvertidos: Number(stats.no_convertidos ?? 0),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tendencia: tendenciaRes.recordset.map((r: any) => ({
          mes_examen_nombre: String(r.mes_examen_nombre ?? ""),
          total_examenes: Number(r.total_examenes ?? 0),
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        volumenConversion: volumenConversionRes.recordset.map((r: any) => {
          const mTotal = Number(r.total_mes ?? 0);
          const mConv = Number(r.convertidos ?? 0);
          const mPct = mTotal > 0 ? (mConv / mTotal) * 100 : 0;
          return {
            mes_examen_nombre: String(r.mes_examen_nombre ?? ""),
            convertidos: mConv,
            no_convertidos: Number(r.no_convertidos ?? 0),
            pct_conversion: mPct,
          };
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        genero: generoRes.recordset.map((r: any) => ({
          genero_label: String(r.genero_label ?? ""),
          total_examenes: Number(r.total_examenes ?? 0),
        })),
        edad: sortedEdades,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        topSucursales: topSucursalesRes.recordset.map((r: any) => ({
          nombre_sucursal: String(r.nombre_sucursal ?? ""),
          total_examenes: Number(r.total_examenes ?? 0),
        })),
      },
    };
  } catch (err) {
    console.error("[getClinicaData]", err);
    return { success: false, error: "Error al obtener los datos de clínica." };
  }
}
