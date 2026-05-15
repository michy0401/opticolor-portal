"use server";

import { unstable_cache } from "next/cache";

import { getConnection } from "@/lib/db";
import { buildSucursalFilter } from "@/lib/sql-helpers";
import { getAuthContext } from "@/lib/get-auth-context";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type CarteraKpiData = {
  montoPedidos: number;
  recaudado: number;
  saldoPendiente: number;
  pedidosLiquidar: number;
  pctCobroInmediato: number;
  pctNivelAbono: number;
};

export type GapCobro = {
  mes_pedido_nombre: string;
  monto_total: number;
  saldo_pendiente: number;
};

export type MixVenta = {
  categoria_agrupada: string;
  venta_neta: number;
  facturas: number;
};

export type CarteraSucursal = {
  nombre_sucursal: string;
  saldo_pendiente: number;
};

export type ClienteDeudor = {
  nombre_sucursal: string;
  nombre_completo: string;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
};

export type CarteraData = {
  kpis: CarteraKpiData;
  gapCobro: GapCobro[];
  mixVentas: MixVenta[];
  carteraSucursal: CarteraSucursal[];
  clientesDeudores: ClienteDeudor[];
};

type Params = {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  sucursalId: number | null;
};

type FetchParams = Params & { userId: number; isSupervisor: boolean };

// ─── Tipos de fila DB (privados) ─────────────────────────────────────────────

type ValorRow         = { valor: number };
type GapCobroRow      = { mes_pedido_nombre: string; monto_total: number; saldo_pendiente: number };
type MixVentaRow      = { categoria_agrupada: string; venta_neta: number; facturas: number };
type CarteraSucRow    = { nombre_sucursal: string; saldo_pendiente: number };
type ClienteDeudorRow = { nombre_sucursal: string; nombre_completo: string; monto_total: number; monto_pagado: number; saldo_pendiente: number };

// ─── Cache interno ────────────────────────────────────────────────────────────
// La guarda de auth vive fuera: unstable_cache no puede capturar APIs dinámicas.

const fetchCarteraData = unstable_cache(
  async (params: FetchParams): Promise<CarteraData> => {
    const { startDate, endDate, sucursalId, userId, isSupervisor } = params;

    const pool = await getConnection();

    // startYM / endYM: enteros YYYYMM para filtrar vistas que usan anio*100+mes
    const startYM = parseInt(startDate.slice(0, 4) + startDate.slice(5, 7), 10);
    const endYM   = parseInt(endDate.slice(0, 4)   + endDate.slice(5, 7),   10);

    const req = () =>
      pool
        .request()
        .input("startDate",    startDate)
        .input("endDate",      endDate)
        .input("startYM",      startYM)
        .input("endYM",        endYM)
        .input("sucursalId",   sucursalId)
        .input("userId",       userId)
        .input("isSupervisor", isSupervisor ? 1 : 0);

    // ── 10 queries en paralelo ───────────────────────────────────────────────
    //
    //  KPI recaudado migrado a Dash_Recaudo_Agregado:
    //  · fecha_recaudo es DATE → SARGable con BETWEEN sin CAST.
    //  · monto_total reemplaza monto_pagado de KPI_Inf3_Recaudado_Pedidos.
    //  El resto de queries permanece sin cambios.

    const [
      montoPedidosRes,
      recaudadoRes,
      saldoPendienteRes,
      pedidosLiquidarRes,
      pctCobroInmediatoRes,
      pctNivelAbonoRes,
      gapCobroRes,
      mixVentasRes,
      carteraSucursalRes,
      clientesDeudoresRes,
    ] = await Promise.all([

      // 1. Monto Pedidos
      req().query(`
        SELECT ISNULL(SUM(monto_total), 0) AS valor
        FROM dbo.KPI_Inf3_Monto_Pedidos
        WHERE CAST(fecha_pedido_completa AS DATE) BETWEEN @startDate AND @endDate
          ${buildSucursalFilter()}
      `),

      // 2. Recaudado — Dash_Recaudo_Agregado (reemplaza KPI_Inf3_Recaudado_Pedidos)
      // fecha_recaudo es DATE: BETWEEN es SARGable sin CAST adicional.
      req().query(`
        SELECT ISNULL(SUM(dr.monto_total), 0) AS valor
        FROM dbo.Dash_Recaudo_Agregado dr
        WHERE dr.fecha_recaudo BETWEEN @startDate AND @endDate
          ${buildSucursalFilter("dr")}
      `),

      // 3. Saldo Pendiente (snapshot histórico)
      req().query(`
        SELECT ROUND(COALESCE(SUM(saldo_pendiente), 0), 2) AS valor
        FROM dbo.KPI_Inf3_Saldo_Pendiente
        WHERE CAST(fecha_pedido_completa AS DATE) <= @endDate
          ${buildSucursalFilter()}
      `),

      // 4. Pedidos por Liquidar (snapshot histórico)
      req().query(`
        SELECT COUNT(DISTINCT id_pedido) AS valor
        FROM dbo.KPI_Inf3_Pedidos_Liquidar
        WHERE CAST(fecha_pedido_completa AS DATE) <= @endDate
          ${buildSucursalFilter()}
      `),

      // 5. % Cobro Inmediato — ratio ponderado (evita promedio simple de porcentajes)
      req().query(`
        SELECT ISNULL(
          SUM(pedidos_cobrados) * 100.0 / NULLIF(SUM(total_pedidos), 0),
          0
        ) AS valor
        FROM dbo.KPI_Inf3_Pct_Cobro_Inmediato
        WHERE anio_pedido * 100 + mes_pedido_nro BETWEEN @startYM AND @endYM
          ${buildSucursalFilter()}
      `),

      // 6. % Nivel de Abono — ratio monetario ponderado (paridad con DAX)
      req().query(`
        SELECT ISNULL(
          SUM(monto_pagado) * 100.0 / NULLIF(SUM(monto_total), 0),
          0
        ) AS valor
        FROM dbo.KPI_Inf3_Pct_Nivel_Abono
        WHERE anio_pedido * 100 + mes_pedido_nro BETWEEN @startYM AND @endYM
          ${buildSucursalFilter()}
      `),

      // 7. GAP de Cobro (tendencia — últimos 12 meses)
      req().query(`
        SELECT
          mes_pedido_nombre,
          YEAR(fecha_pedido_completa)  AS anio,
          MONTH(fecha_pedido_completa) AS mes,
          ISNULL(SUM(monto_total),       0) AS monto_total,
          ISNULL(SUM(saldo_pendiente),   0) AS saldo_pendiente
        FROM dbo.Fact_Pedidos
        WHERE CAST(fecha_pedido_completa AS DATE) >= DATEADD(MONTH, -12, CAST(@endDate AS DATE))
          AND CAST(fecha_pedido_completa AS DATE) <= @endDate
          ${buildSucursalFilter()}
        GROUP BY mes_pedido_nombre, YEAR(fecha_pedido_completa), MONTH(fecha_pedido_completa)
        ORDER BY YEAR(fecha_pedido_completa) ASC, MONTH(fecha_pedido_completa) ASC
      `),

      // 8. Mix de Ventas
      req().query(`
        SELECT
          categoria_agrupada,
          ISNULL(SUM(venta_neta), 0)       AS venta_neta,
          COUNT(DISTINCT id_factura)        AS facturas
        FROM dbo.Fact_Ventas_por_Categoria
        WHERE CAST(fecha_factura AS DATE) BETWEEN @startDate AND @endDate
          ${buildSucursalFilter()}
        GROUP BY categoria_agrupada
        ORDER BY venta_neta DESC
      `),

      // 9. Cartera por Sucursal (snapshot histórico)
      req().query(`
        SELECT
          ds.nombre_sucursal,
          ROUND(COALESCE(SUM(k.saldo_pendiente), 0), 2) AS saldo_pendiente
        FROM dbo.KPI_Inf3_Saldo_Pendiente k
        LEFT JOIN dbo.Dim_Sucursales ds ON k.id_sucursal = ds.id_sucursal
        WHERE CAST(k.fecha_pedido_completa AS DATE) <= @endDate
          ${buildSucursalFilter("k")}
        GROUP BY ds.nombre_sucursal
        ORDER BY saldo_pendiente DESC
      `),

      // 10. Top Clientes Deudores (snapshot histórico)
      req().query(`
        SELECT TOP 10
          ds.nombre_sucursal,
          dc.nombre_completo,
          ISNULL(SUM(fp.monto_total),     0) AS monto_total,
          ISNULL(SUM(fp.monto_pagado),    0) AS monto_pagado,
          ISNULL(SUM(fp.saldo_pendiente), 0) AS saldo_pendiente
        FROM dbo.Fact_Pedidos fp
        INNER JOIN dbo.Dim_Clientes    dc ON fp.id_cliente   = dc.id_cliente
        INNER JOIN dbo.Dim_Sucursales  ds ON fp.id_sucursal  = ds.id_sucursal
        WHERE CAST(fp.fecha_pedido_completa AS DATE) <= @endDate
          ${buildSucursalFilter("fp")}
        GROUP BY ds.nombre_sucursal, dc.nombre_completo
        HAVING ISNULL(SUM(fp.saldo_pendiente), 0) > 0
        ORDER BY saldo_pendiente DESC
      `),
    ]);

    return {
      kpis: {
        montoPedidos:      Number((montoPedidosRes.recordset    as ValorRow[])[0]?.valor ?? 0),
        recaudado:         Number((recaudadoRes.recordset        as ValorRow[])[0]?.valor ?? 0),
        saldoPendiente:    Number((saldoPendienteRes.recordset   as ValorRow[])[0]?.valor ?? 0),
        pedidosLiquidar:   Number((pedidosLiquidarRes.recordset  as ValorRow[])[0]?.valor ?? 0),
        pctCobroInmediato: Math.round(Number((pctCobroInmediatoRes.recordset as ValorRow[])[0]?.valor ?? 0) * 100) / 100,
        pctNivelAbono:     Math.round(Number((pctNivelAbonoRes.recordset     as ValorRow[])[0]?.valor ?? 0) * 100) / 100,
      },
      gapCobro: (gapCobroRes.recordset as GapCobroRow[]).map((r) => ({
        mes_pedido_nombre: String(r.mes_pedido_nombre ?? ""),
        monto_total:       Number(r.monto_total ?? 0),
        saldo_pendiente:   Number(r.saldo_pendiente ?? 0),
      })),
      mixVentas: (mixVentasRes.recordset as MixVentaRow[]).map((r) => ({
        categoria_agrupada: String(r.categoria_agrupada ?? ""),
        venta_neta:         Number(r.venta_neta ?? 0),
        facturas:           Number(r.facturas ?? 0),
      })),
      carteraSucursal: (carteraSucursalRes.recordset as CarteraSucRow[]).map((r) => ({
        nombre_sucursal: String(r.nombre_sucursal ?? ""),
        saldo_pendiente: Number(r.saldo_pendiente ?? 0),
      })),
      clientesDeudores: (clientesDeudoresRes.recordset as ClienteDeudorRow[]).map((r) => ({
        nombre_sucursal: String(r.nombre_sucursal ?? ""),
        nombre_completo: String(r.nombre_completo ?? ""),
        monto_total:     Number(r.monto_total ?? 0),
        monto_pagado:    Number(r.monto_pagado ?? 0),
        saldo_pendiente: Number(r.saldo_pendiente ?? 0),
      })),
    };
  },
  ["dash-recaudo"],
  { revalidate: 3600, tags: ["dash-recaudo"] },
);

// ─── Acción principal ─────────────────────────────────────────────────────────
// La guarda de auth vive fuera del cache: unstable_cache no puede capturar
// APIs dinámicas (headers/cookies) como getAuthContext().

export async function getCarteraData(
  params: Params,
): Promise<{ success: boolean; data?: CarteraData; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "No autorizado" };

    const data = await fetchCarteraData({
      ...params,
      userId:       auth.userId,
      isSupervisor: auth.isSupervisor,
    });
    return { success: true, data };
  } catch (err) {
    console.error("[ERROR][getCarteraData]", err);
    return { success: false, error: "Error al obtener los datos de cartera y saldos." };
  }
}
