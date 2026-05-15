"use server";

import { unstable_cache } from "next/cache";

import { getConnection } from "@/lib/db";
import { buildSucursalFilter } from "@/lib/sql-helpers";
import { getAuthContext } from "@/lib/get-auth-context";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type KpiData = {
  ventaNetaYTD: number;   // siempre Ene-1 → hoy (independiente del filtro)
  ventaNeta: number;      // período filtrado (se usa internamente para proyeccionPct)
  proyeccion: number;
  totalCobrado: number;
  ticketPromedio: number;
  cantidadPedidos: number;
  totalExamenes: number;
  clientesNuevos: number;
};

export type VentaDiaria = {
  fecha: string;  // "YYYY-MM"
  label: string;  // "Ene", "Feb", …
  ventaNeta: number;
  trafico: number;
};

export type VentaSucursal = {
  idSucursal: number;
  nombreSucursal: string;
  ventaNeta: number;
  estimadoCierre: number;
};

export type MedioPago = {
  medioPago: string;
  monto: number;
  porcentaje: number; // con 1 decimal (ej: 45.2)
};

export type ResumenData = {
  kpis: KpiData;
  ventasDiarias: VentaDiaria[];
  topSucursales: VentaSucursal[];
  mediosPago: MedioPago[];
};

type Params = {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  sucursalId: number | null;
};

type FetchParams = Params & { userId: number; isSupervisor: boolean };

// ─── Tipos de fila DB (privados) ─────────────────────────────────────────────

type VentasKpiRow       = { anio: number; mes_nro: number; ventaMensual: number; trafico: number; ventaNeta: number; ventaNetaYTD: number };
type ProyeccionRow      = { kpi: string; valor: number };
type ValorRow           = { valor: number };
type PedidosClientesRow = { cantidadPedidos: number; clientesNuevos: number };
type TopSucursalRow     = { idSucursal: number; nombreSucursal: string; ventaNeta: number; estimadoCierre: number };
type MedioPagoRow       = { medioPago: string; monto: number };

// ─── Cache interno — datos por usuario, sucursal y rango de fechas ───────────
// La guarda de auth vive fuera del cache: unstable_cache no puede capturar
// APIs dinámicas (headers/cookies) como getAuthContext().
// La clave de cache incluye todos los argumentos serializados (userId, isSupervisor,
// startDate, endDate, sucursalId) → cada combinación única tiene su propio slot.
const fetchResumenData = unstable_cache(
  async (params: FetchParams): Promise<ResumenData> => {
    const { startDate, endDate, sucursalId, userId, isSupervisor } = params;

    const pool = await getConnection();

    const startYM = parseInt(startDate.slice(0, 4) + startDate.slice(5, 7), 10);
    const endYM   = parseInt(endDate.slice(0, 4)   + endDate.slice(5, 7),   10);

    // Rango YTD: 1-Ene del año actual → hoy, calculado server-side
    const nowDate  = new Date();
    const ytdStart = `${nowDate.getFullYear()}-01-01`;
    const ytdEnd   = [
      nowDate.getFullYear(),
      String(nowDate.getMonth() + 1).padStart(2, "0"),
      String(nowDate.getDate()).padStart(2, "0"),
    ].join("-");

    // req: todos los parámetros necesarios (rango filtrado + YTD + auth)
    const req = () =>
      pool
        .request()
        .input("startDate", startDate)
        .input("endDate", endDate)
        .input("ytdStart", ytdStart)
        .input("ytdEnd", ytdEnd)
        .input("startYM", startYM)
        .input("endYM", endYM)
        .input("sucursalId", sucursalId)
        .input("userId", userId)
        .input("isSupervisor", isSupervisor ? 1 : 0);

    // ── 7 consultas en paralelo (reducidas desde 11) ─────────────────────────
    //
    // Consolidación A: ventaNeta + ventaNetaYTD + gráfico mensual → ventasKpisRes
    //   Un solo scan de KPI_Inf1_Venta_Neta devuelve filas mensuales (para el
    //   gráfico YTD) con los escalares KPI embebidos vía window functions.
    //   Elimina el round-trip previo a Fact_Ventas_Analitico (JOIN de 4 tablas).
    // Consolidación B: cantidadPedidos + clientesNuevos → pedidosClientesRes
    //   Mismo scan de Fact_Pedidos, dos columnas calculadas.
    // Consolidación C: proyeccion + cobrado → proyeccionCobradoRes
    //   Vistas distintas unidas con UNION ALL y columna discriminadora.
    // Eliminado: factory reqYTD() — los parámetros ytdStart/ytdEnd viven en req().

    const [
      ventasKpisRes,
      proyeccionCobradoRes,
      ticketRes,
      pedidosClientesRes,
      examenesRes,
      topSucursalesRes,
      mediosPagoRes,
    ] = await Promise.all([

      // [A] KPI + Gráfico YTD: filas mensuales con escalares globales embebidos.
      // ventaMensual/trafico → datos del gráfico (una fila por mes).
      // ventaNeta/ventaNetaYTD → mismo valor en cada fila (SUM(SUM()) OVER ()).
      req().query(`
        SELECT
          anio_factura                                                                  AS anio,
          mes_factura_nro                                                               AS mes_nro,
          ISNULL(SUM(monto_neto), 0)                                                   AS ventaMensual,
          COUNT(*)                                                                       AS trafico,
          ISNULL(SUM(SUM(CASE WHEN fecha_factura BETWEEN @startDate AND @endDate
                          THEN monto_neto ELSE 0 END)) OVER (), 0)                      AS ventaNeta,
          ISNULL(SUM(SUM(monto_neto)) OVER (), 0)                                       AS ventaNetaYTD
        FROM dbo.KPI_Inf1_Venta_Neta
        WHERE (fecha_factura BETWEEN @startDate AND @endDate
            OR fecha_factura BETWEEN @ytdStart  AND @ytdEnd)
        ${buildSucursalFilter()}
        GROUP BY anio_factura, mes_factura_nro
        ORDER BY anio_factura, mes_factura_nro ASC
      `),

      // [C] KPI: Proyección + Total Cobrado — UNION ALL con discriminador
      // Proyección: fórmula proporcional (monto_neto / dia_hoy_gmt4) * dias_del_mes
      // Meses pasados: dia_hoy_gmt4 = dias_del_mes → ratio = 1 (sin extrapolación).
      // Mes actual:    dia_hoy_gmt4 < dias_del_mes → extrapolación lineal al cierre.
      req().query(`
        SELECT 'proyeccion' AS kpi, ISNULL(SUM(
          CAST(monto_neto AS DECIMAL(18,4))
          / NULLIF(CAST(dia_hoy_gmt4 AS DECIMAL(18,4)), 0)
          * CAST(dias_del_mes AS DECIMAL(18,4))
        ), 0) AS valor
        FROM dbo.KPI_Inf1_Proyeccion_Venta_Neta
        WHERE fecha_factura BETWEEN @startDate AND @endDate
        ${buildSucursalFilter()}
        UNION ALL
        SELECT 'cobrado', ISNULL(SUM(importe_neto), 0)
        FROM dbo.KPI_Inf1_Total_Cobrado
        WHERE fecha_completa BETWEEN @startDate AND @endDate
        ${buildSucursalFilter()}
      `),

      // KPI: Ticket Promedio (vista sin columna de fecha; filtra por anio + mes_nro)
      req().query(`
        SELECT ISNULL(
          CAST(SUM(venta_neta) AS DECIMAL(18,4)) / NULLIF(SUM(cantidad_pedidos), 0),
          0
        ) AS valor
        FROM dbo.KPI_Inf1_Ticket_Promedio
        WHERE anio * 100 + mes_nro BETWEEN @startYM AND @endYM
        ${buildSucursalFilter()}
      `),

      // [B] KPI: Cantidad de Pedidos + Clientes Nuevos — un solo scan de Fact_Pedidos
      // CTE para pre-calcular es_nuevo: SQL Server prohíbe NOT EXISTS dentro de
      // funciones de agregado (error 130), por lo que el flag se evalúa primero
      // en la CTE y el COUNT externo solo opera sobre el escalar 0/1.
      req().query(`
        WITH pedidos_periodo AS (
          SELECT
            fp.id_cliente,
            CASE
              WHEN NOT EXISTS (
                SELECT 1 FROM dbo.Fact_Pedidos fp2
                WHERE fp2.id_cliente = fp.id_cliente
                  AND CAST(fp2.fecha_pedido_completa AS DATE) < @startDate
              ) THEN 1 ELSE 0
            END AS es_nuevo
          FROM dbo.Fact_Pedidos fp
          WHERE CAST(fp.fecha_pedido_completa AS DATE) BETWEEN @startDate AND @endDate
          ${buildSucursalFilter("fp")}
        )
        SELECT
          COUNT(*)                                                    AS cantidadPedidos,
          COUNT(DISTINCT CASE WHEN es_nuevo = 1 THEN id_cliente END)  AS clientesNuevos
        FROM pedidos_periodo
      `),

      // KPI: Total Exámenes
      req().query(`
        SELECT COUNT(*) AS valor
        FROM dbo.Fact_Examenes
        WHERE CAST(fecha_examen_completa AS DATE) BETWEEN @startDate AND @endDate
        ${buildSucursalFilter()}
      `),

      // Gráfico: Top 10 sucursales — proyección usa la misma fórmula proporcional
      req().query(`
        SELECT TOP 10
          vn.idSucursal,
          ds.nombre_sucursal              AS nombreSucursal,
          vn.ventaNeta,
          ISNULL(pv.estimado, 0)         AS estimadoCierre
        FROM (
          SELECT
            id_sucursal                  AS idSucursal,
            ISNULL(SUM(monto_neto), 0)  AS ventaNeta
          FROM dbo.KPI_Inf1_Venta_Neta
          WHERE fecha_factura BETWEEN @startDate AND @endDate
            ${buildSucursalFilter()}
          GROUP BY id_sucursal
        ) vn
        INNER JOIN dbo.Dim_Sucursales ds ON ds.id_sucursal = vn.idSucursal
        LEFT JOIN (
          SELECT
            id_sucursal,
            ISNULL(SUM(
              CAST(monto_neto AS DECIMAL(18,4))
              / NULLIF(CAST(dia_hoy_gmt4 AS DECIMAL(18,4)), 0)
              * CAST(dias_del_mes AS DECIMAL(18,4))
            ), 0) AS estimado
          FROM dbo.KPI_Inf1_Proyeccion_Venta_Neta
          WHERE fecha_factura BETWEEN @startDate AND @endDate
            ${buildSucursalFilter()}
          GROUP BY id_sucursal
        ) pv ON pv.id_sucursal = vn.idSucursal
        ORDER BY vn.ventaNeta DESC
      `),

      // Gráfico: Mix de Medios de Pago
      req().query(`
        SELECT
          metodo_pago                       AS medioPago,
          ISNULL(SUM(importe_neto), 0)     AS monto
        FROM dbo.KPI_Inf1_Mix_Medios_Pago
        WHERE fecha_completa BETWEEN @startDate AND @endDate
          ${buildSucursalFilter()}
        GROUP BY metodo_pago
        ORDER BY monto DESC
      `),
    ]);

    // ── Extracción de resultados consolidados ────────────────────────────────
    const ventasRows = ventasKpisRes.recordset as VentasKpiRow[];
    const ventasRow  = ventasRows[0];
    const pcRows     = proyeccionCobradoRes.recordset as ProyeccionRow[];
    const proyRow    = pcRows.find((r) => r.kpi === "proyeccion");
    const cobRow     = pcRows.find((r) => r.kpi === "cobrado");
    const pedidosRow = pedidosClientesRes.recordset[0] as PedidosClientesRow;

    // ── Porcentajes con 2 decimales ──────────────────────────────────────────
    const rawMedios = (mediosPagoRes.recordset as MedioPagoRow[]).map((r) => ({
      medioPago: r.medioPago ?? "",
      monto:     Number(r.monto ?? 0),
    }));
    const montoTotal = rawMedios.reduce((acc, r) => acc + r.monto, 0);
    const mediosPago: MedioPago[] = rawMedios.map((r) => ({
      ...r,
      porcentaje:
        montoTotal > 0 ? Math.round((r.monto / montoTotal) * 10000) / 100 : 0,
    }));

    return {
      kpis: {
        ventaNetaYTD:    Number(ventasRow?.ventaNetaYTD   ?? 0),
        ventaNeta:       Number(ventasRow?.ventaNeta       ?? 0),
        proyeccion:      Number(proyRow?.valor             ?? 0),
        totalCobrado:    Number(cobRow?.valor              ?? 0),
        ticketPromedio:  Math.round(Number((ticketRes.recordset as ValorRow[])[0]?.valor ?? 0) * 100) / 100,
        cantidadPedidos: Number(pedidosRow?.cantidadPedidos ?? 0),
        totalExamenes:   Number((examenesRes.recordset as ValorRow[])[0]?.valor ?? 0),
        clientesNuevos:  Number(pedidosRow?.clientesNuevos  ?? 0),
      },
      ventasDiarias: ventasRows.map((r) => {
        const mesNum = Number(r.mes_nro ?? 1);
        const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        return {
          fecha:     `${r.anio}-${String(mesNum).padStart(2, "0")}`,
          label:     MESES[mesNum - 1] ?? String(mesNum),
          ventaNeta: Number(r.ventaMensual ?? 0),
          trafico:   Number(r.trafico ?? 0),
        };
      }),
      topSucursales: (topSucursalesRes.recordset as TopSucursalRow[]).map((r) => ({
        idSucursal:     Number(r.idSucursal),
        nombreSucursal: String(r.nombreSucursal ?? ""),
        ventaNeta:      Number(r.ventaNeta ?? 0),
        estimadoCierre: Number(r.estimadoCierre ?? 0),
      })),
      mediosPago,
    };
  },
  ["dash-ventas"],
  { revalidate: 3600, tags: ["dash-ventas"] },
);

// ─── Acción principal ─────────────────────────────────────────────────────────
// La guarda de auth vive fuera del cache: unstable_cache no puede capturar
// APIs dinámicas (headers/cookies) como getAuthContext().

export async function getResumenData(
  params: Params,
): Promise<{ success: boolean; data?: ResumenData; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "No autorizado" };

    const data = await fetchResumenData({
      ...params,
      userId:       auth.userId,
      isSupervisor: auth.isSupervisor,
    });
    return { success: true, data };
  } catch (err) {
    console.error("[ERROR][getResumenData]", err);
    return { success: false, error: "Error al obtener los datos del resumen comercial." };
  }
}
