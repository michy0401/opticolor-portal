"use server";

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

// ─── Acción principal ─────────────────────────────────────────────────────────

export async function getResumenData(
  params: Params,
): Promise<{ success: boolean; data?: ResumenData; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "No autorizado" };
    const { userId, isSupervisor } = auth;
    const { startDate, endDate, sucursalId } = params;

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

    // ── 8 consultas en paralelo (reducidas desde 11) ─────────────────────────
    //
    // Consolidación A: ventaNeta + ventaNetaYTD → ventasKpisRes
    //   Mismo scan de KPI_Inf1_Venta_Neta, dos SUM(CASE WHEN ...) condicionales.
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
      ventasDiariasRes,
      topSucursalesRes,
      mediosPagoRes,
    ] = await Promise.all([

      // [A] KPI: Venta Neta filtrada + Venta Neta YTD — un solo scan
      req().query(`
        SELECT
          ISNULL(SUM(CASE WHEN fecha_factura BETWEEN @startDate AND @endDate THEN monto_neto END), 0) AS ventaNeta,
          ISNULL(SUM(CASE WHEN fecha_factura BETWEEN @ytdStart  AND @ytdEnd  THEN monto_neto END), 0) AS ventaNetaYTD
        FROM dbo.KPI_Inf1_Venta_Neta
        WHERE (fecha_factura BETWEEN @startDate AND @endDate
            OR fecha_factura BETWEEN @ytdStart  AND @ytdEnd)
        ${buildSucursalFilter()}
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

      // Gráfico: Tendencia anual — siempre YTD para mostrar estacionalidad completa
      req().query(`
        SELECT
          YEAR(fecha_factura)                        AS anio,
          MONTH(fecha_factura)                       AS mes_nro,
          ISNULL(SUM(monto_final_transaccional), 0)  AS ventaNeta,
          COUNT(*)                                   AS trafico
        FROM dbo.Fact_Ventas_Analitico
        WHERE fecha_factura BETWEEN @ytdStart AND @ytdEnd
          ${buildSucursalFilter()}
        GROUP BY YEAR(fecha_factura), MONTH(fecha_factura)
        ORDER BY YEAR(fecha_factura), MONTH(fecha_factura) ASC
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ventasRow = ventasKpisRes.recordset[0] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pcRows    = proyeccionCobradoRes.recordset as any[];
    const proyRow   = pcRows.find((r) => r.kpi === "proyeccion");
    const cobRow    = pcRows.find((r) => r.kpi === "cobrado");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pedidosRow = pedidosClientesRes.recordset[0] as any;

    // ── Porcentajes con 1 decimal ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMedios: Array<{ medioPago: string; monto: number }> = mediosPagoRes.recordset.map((r: any) => ({
      medioPago: r.medioPago ?? "",
      monto: Number(r.monto ?? 0),
    }));
    const montoTotal = rawMedios.reduce((acc, r) => acc + r.monto, 0);
    const mediosPago: MedioPago[] = rawMedios.map((r) => ({
      ...r,
      porcentaje:
        montoTotal > 0 ? Math.round((r.monto / montoTotal) * 1000) / 10 : 0,
    }));

    return {
      success: true,
      data: {
        kpis: {
          ventaNetaYTD:    Number(ventasRow?.ventaNetaYTD   ?? 0),
          ventaNeta:       Number(ventasRow?.ventaNeta       ?? 0),
          proyeccion:      Number(proyRow?.valor             ?? 0),
          totalCobrado:    Number(cobRow?.valor              ?? 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ticketPromedio:  Number((ticketRes.recordset[0] as any)?.valor ?? 0),
          cantidadPedidos: Number(pedidosRow?.cantidadPedidos ?? 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totalExamenes:   Number((examenesRes.recordset[0] as any)?.valor ?? 0),
          clientesNuevos:  Number(pedidosRow?.clientesNuevos  ?? 0),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ventasDiarias: ventasDiariasRes.recordset.map((r: any) => {
          const mesNum = Number(r.mes_nro ?? 1);
          const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
          return {
            fecha:     `${r.anio}-${String(mesNum).padStart(2, "0")}`,
            label:     MESES[mesNum - 1] ?? String(mesNum),
            ventaNeta: Number(r.ventaNeta ?? 0),
            trafico:   Number(r.trafico ?? 0),
          };
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        topSucursales: topSucursalesRes.recordset.map((r: any) => ({
          idSucursal:     Number(r.idSucursal),
          nombreSucursal: String(r.nombreSucursal ?? ""),
          ventaNeta:      Number(r.ventaNeta ?? 0),
          estimadoCierre: Number(r.estimadoCierre ?? 0),
        })),
        mediosPago,
      },
    };
  } catch (err) {
    console.error("[getResumenData]", err);
    return { success: false, error: "Error al obtener los datos del resumen comercial." };
  }
}
