"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getConnection } from "@/lib/db";

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

// ─── Filtro de sucursal reutilizable ─────────────────────────────────────────

function sucursalFilter(tableAlias = "") {
  const col = tableAlias ? `${tableAlias}.id_sucursal` : "id_sucursal";
  return `
    AND (
      (
        @isSupervisor = 1
        AND ${col} IN (
          SELECT id_sucursal
          FROM dbo.Seguridad_Usuarios_Sucursales
          WHERE id_usuario = @userId AND esta_vigente = 1
        )
      )
      OR (
        @isSupervisor = 0
        AND (@sucursalId IS NULL OR ${col} = @sucursalId)
      )
    )`;
}

// ─── Acción principal ─────────────────────────────────────────────────────────

export async function getResumenData(
  params: Params,
): Promise<{ success: boolean; data?: ResumenData; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "No autorizado" };

    const isSupervisor =
      session.user.nivel === 4 || session.user.rol === "SUPERVISOR";
    const userId = parseInt(session.user.id, 10);
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

    // req: rango filtrado por el usuario + parámetros de auth
    const req = () =>
      pool
        .request()
        .input("startDate", startDate)
        .input("endDate", endDate)
        .input("startYM", startYM)
        .input("endYM", endYM)
        .input("sucursalId", sucursalId)
        .input("userId", userId)
        .input("isSupervisor", isSupervisor ? 1 : 0);

    // reqYTD: rango YTD fijo + parámetros de auth (sin startYM/endYM)
    const reqYTD = () =>
      pool
        .request()
        .input("startDate", ytdStart)
        .input("endDate", ytdEnd)
        .input("sucursalId", sucursalId)
        .input("userId", userId)
        .input("isSupervisor", isSupervisor ? 1 : 0);

    // ── Consultas en paralelo ────────────────────────────────────────────────

    const [
      ventaNetaRes,
      ventaNetaYTDRes,
      proyeccionRes,
      cobradoRes,
      ticketRes,
      pedidosRes,
      examenesRes,
      clientesNuevosRes,
      ventasDiariasRes,
      topSucursalesRes,
      mediosPagoRes,
    ] = await Promise.all([

      // KPI: Venta Neta filtrada (interna, para calcular proyeccionPct en el UI)
      req().query(`
        SELECT ISNULL(SUM(monto_neto), 0) AS valor
        FROM dbo.KPI_Inf1_Venta_Neta
        WHERE fecha_factura BETWEEN @startDate AND @endDate
        ${sucursalFilter()}
      `),

      // KPI: Venta Neta YTD — siempre 1-Ene → hoy, independiente del filtro de Navbar
      reqYTD().query(`
        SELECT ISNULL(SUM(monto_neto), 0) AS valor
        FROM dbo.KPI_Inf1_Venta_Neta
        WHERE fecha_factura BETWEEN @startDate AND @endDate
        ${sucursalFilter()}
      `),

      // KPI: Proyección — fórmula proporcional: (monto_neto / dia_hoy_gmt4) * dias_del_mes
      // Meses pasados: dia_hoy_gmt4 = dias_del_mes → ratio = 1 (sin extrapolación).
      // Mes actual:    dia_hoy_gmt4 < dias_del_mes → extrapolación lineal al cierre.
      req().query(`
        SELECT ISNULL(SUM(
          CAST(monto_neto AS DECIMAL(18,4))
          / NULLIF(CAST(dia_hoy_gmt4 AS DECIMAL(18,4)), 0)
          * CAST(dias_del_mes AS DECIMAL(18,4))
        ), 0) AS valor
        FROM dbo.KPI_Inf1_Proyeccion_Venta_Neta
        WHERE fecha_factura BETWEEN @startDate AND @endDate
        ${sucursalFilter()}
      `),

      // KPI: Total Cobrado
      req().query(`
        SELECT ISNULL(SUM(importe_neto), 0) AS valor
        FROM dbo.KPI_Inf1_Total_Cobrado
        WHERE fecha_completa BETWEEN @startDate AND @endDate
        ${sucursalFilter()}
      `),

      // KPI: Ticket Promedio (vista sin columna de fecha; filtra por anio + mes_nro)
      req().query(`
        SELECT ISNULL(
          CAST(SUM(venta_neta) AS DECIMAL(18,4)) / NULLIF(SUM(cantidad_pedidos), 0),
          0
        ) AS valor
        FROM dbo.KPI_Inf1_Ticket_Promedio
        WHERE anio * 100 + mes_nro BETWEEN @startYM AND @endYM
        ${sucursalFilter()}
      `),

      // KPI: Cantidad de Pedidos
      req().query(`
        SELECT COUNT(*) AS valor
        FROM dbo.Fact_Pedidos
        WHERE CAST(fecha_pedido_completa AS DATE) BETWEEN @startDate AND @endDate
        ${sucursalFilter()}
      `),

      // KPI: Total Exámenes
      req().query(`
        SELECT COUNT(*) AS valor
        FROM dbo.Fact_Examenes
        WHERE CAST(fecha_examen_completa AS DATE) BETWEEN @startDate AND @endDate
        ${sucursalFilter()}
      `),

      // KPI: Clientes Nuevos
      req().query(`
        SELECT COUNT(DISTINCT fp.id_cliente) AS valor
        FROM dbo.Fact_Pedidos fp
        WHERE CAST(fp.fecha_pedido_completa AS DATE) BETWEEN @startDate AND @endDate
          ${sucursalFilter("fp")}
          AND NOT EXISTS (
            SELECT 1
            FROM dbo.Fact_Pedidos fp2
            WHERE fp2.id_cliente = fp.id_cliente
              AND CAST(fp2.fecha_pedido_completa AS DATE) < @startDate
          )
      `),

      // Gráfico: Tendencia anual — siempre YTD para mostrar estacionalidad completa
      reqYTD().query(`
        SELECT
          YEAR(fecha_factura)                        AS anio,
          MONTH(fecha_factura)                       AS mes_nro,
          ISNULL(SUM(monto_final_transaccional), 0)  AS ventaNeta,
          COUNT(*)                                   AS trafico
        FROM dbo.Fact_Ventas_Analitico
        WHERE fecha_factura BETWEEN @startDate AND @endDate
          ${sucursalFilter()}
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
            ${sucursalFilter()}
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
            ${sucursalFilter()}
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
          ${sucursalFilter()}
        GROUP BY metodo_pago
        ORDER BY monto DESC
      `),
    ]);

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ventaNetaYTD:    Number((ventaNetaYTDRes.recordset[0] as any)?.valor ?? 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ventaNeta:       Number((ventaNetaRes.recordset[0] as any)?.valor ?? 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          proyeccion:      Number((proyeccionRes.recordset[0] as any)?.valor ?? 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totalCobrado:    Number((cobradoRes.recordset[0] as any)?.valor ?? 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ticketPromedio:  Number((ticketRes.recordset[0] as any)?.valor ?? 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cantidadPedidos: Number((pedidosRes.recordset[0] as any)?.valor ?? 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totalExamenes:   Number((examenesRes.recordset[0] as any)?.valor ?? 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          clientesNuevos:  Number((clientesNuevosRes.recordset[0] as any)?.valor ?? 0),
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
