"use server";

import { getConnection } from "@/lib/db";
import { buildSucursalFilter } from "@/lib/sql-helpers";
import { getAuthContext } from "@/lib/get-auth-context";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type InventarioKpis = {
  stockFisico: number;
  capitalInvertido: number;
  unidadesVendidas: number;
  ventaNetaProducto: number;
  cantidadFacturas: number;
};

export type MarcaItem = {
  marca: string;
  unidadesVendidas: number;
  stockFisico: number;
  ventaNeta: number;
};

export type GrupoMix = {
  name: string;
  size: number;       // ventaNeta — Recharts Treemap usa este campo para el área
  porcentaje: number; // 1 decimal
};

export type InventarioData = {
  kpis: InventarioKpis;
  marcasDetalle: MarcaItem[];
  gruposMix: GrupoMix[];
};

type Params = {
  startDate: string;
  endDate: string;
  sucursalId: number | null;
  marcaFilter: string | null;
  grupoFilter: string | null;
};

// ─── Constantes ───────────────────────────────────────────────────────────────
// Dim_Productos usa PascalCase: Marca, Segmento_Comercial
const EXCLUSION = `AND dp.Segmento_Comercial NOT IN ('LENTES', 'TRATAMIENTOS')`;

// ─── Acción principal ─────────────────────────────────────────────────────────

export async function getInventarioData(
  params: Params,
): Promise<{ success: boolean; data?: InventarioData; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "No autorizado" };
    const { userId, isSupervisor } = auth;
    const { startDate, endDate, sucursalId, marcaFilter, grupoFilter } = params;

    const pool = await getConnection();

    // Filtros opcionales — sólo se inyectan cuando el usuario eligió un valor
    const marcaSql = marcaFilter ? "AND dp.Marca = @marcaFilter" : "";
    const grupoSql = grupoFilter ? "AND dp.Segmento_Comercial = @grupoFilter" : "";

    const req = () => {
      let r = pool
        .request()
        .input("startDate", startDate)
        .input("endDate", endDate)
        .input("sucursalId", sucursalId)
        .input("userId", userId)
        .input("isSupervisor", isSupervisor ? 1 : 0);
      if (marcaFilter) r = r.input("marcaFilter", marcaFilter);
      if (grupoFilter) r = r.input("grupoFilter", grupoFilter);
      return r;
    };

    // ── 5 consultas en paralelo (reducidas desde 7) ──────────────────────────
    //
    // Optimizaciones aplicadas:
    //   · inventarioRes: fusiona Stock Físico + Capital Invertido en 1 sola
    //     query a Fact_Inventario (antes eran 2 queries idénticas en WHERE).
    //   · marcasVentasRes: agrupa por Marca y también sirve para derivar los
    //     KPI de unidades totales y venta neta en TypeScript (eliminando la
    //     query independiente de totales que antes ocupaba un slot adicional).
    //
    // JOIN invariante:
    //   Fact_Inventario.id_producto    = Dim_Productos.SK_Producto
    //   Fact_Ventas_Detalle.id_producto = Dim_Productos.SK_Producto

    const [
      inventarioRes,   // stock físico + capital (snapshot ≤ endDate)
      facturasRes,     // conteo de facturas únicas (denominador UPT)
      marcasVentasRes, // ranking por marca: unidades + venta neta (flujo)
      marcasStockRes,  // stock por marca (snapshot ≤ endDate)
      gruposRes,       // mix por grupo: venta neta del período (flujo)
    ] = await Promise.all([

      // ── Snapshot: Stock Físico + Capital Invertido en una sola pasada ──────
      req().query(`
        SELECT
          ISNULL(SUM(fi.cantidad_disponible),    0) AS stockFisico,
          ISNULL(SUM(fi.valor_total_inventario), 0) AS capitalInvertido
        FROM dbo.Fact_Inventario fi
        INNER JOIN dbo.Dim_Productos dp ON fi.id_producto = dp.SK_Producto
        WHERE CAST(fi.fecha_foto_sistema AS DATE) <= @endDate
          ${EXCLUSION}
          ${marcaSql}
          ${grupoSql}
          ${buildSucursalFilter("fi")}
      `),

      // ── Facturas únicas en el período — denominador del UPT ────────────────
      req().query(`
        SELECT COUNT(DISTINCT id_factura) AS valor
        FROM dbo.KPI_Inf1_Cantidad_Facturas
        WHERE fecha_factura BETWEEN @startDate AND @endDate
          ${buildSucursalFilter()}
      `),

      // ── Flujo por marca: unidades vendidas + venta neta ────────────────────
      // Los KPI totales (unidadesVendidas, ventaNetaProducto) se derivan
      // acumulando este resultado en TypeScript, evitando una query extra.
      req().query(`
        SELECT
          dp.Marca                                        AS marca,
          ISNULL(SUM(fvd.cantidad), 0)                   AS unidadesVendidas,
          ISNULL(SUM(fvd.monto_final_transaccional), 0)  AS ventaNeta
        FROM dbo.Fact_Ventas_Detalle fvd
        INNER JOIN dbo.Dim_Productos dp ON fvd.id_producto = dp.SK_Producto
        WHERE CAST(fvd.fecha_factura AS DATE) BETWEEN @startDate AND @endDate
          ${EXCLUSION}
          ${marcaSql}
          ${grupoSql}
          AND dp.Marca IS NOT NULL AND dp.Marca <> ''
          ${buildSucursalFilter("fvd")}
        GROUP BY dp.Marca
        ORDER BY SUM(fvd.cantidad) DESC
      `),

      // ── Snapshot por marca: stock físico ───────────────────────────────────
      req().query(`
        SELECT
          dp.Marca                                    AS marca,
          ISNULL(SUM(fi.cantidad_disponible), 0)      AS stockFisico
        FROM dbo.Fact_Inventario fi
        INNER JOIN dbo.Dim_Productos dp ON fi.id_producto = dp.SK_Producto
        WHERE CAST(fi.fecha_foto_sistema AS DATE) <= @endDate
          ${EXCLUSION}
          ${marcaSql}
          ${grupoSql}
          AND dp.Marca IS NOT NULL AND dp.Marca <> ''
          ${buildSucursalFilter("fi")}
        GROUP BY dp.Marca
      `),

      // ── Flujo por grupo: venta neta del período ─────────────────────────────
      req().query(`
        SELECT
          dp.Segmento_Comercial                           AS grupo,
          ISNULL(SUM(fvd.monto_final_transaccional), 0)  AS ventaNeta
        FROM dbo.Fact_Ventas_Detalle fvd
        INNER JOIN dbo.Dim_Productos dp ON fvd.id_producto = dp.SK_Producto
        WHERE CAST(fvd.fecha_factura AS DATE) BETWEEN @startDate AND @endDate
          ${EXCLUSION}
          ${marcaSql}
          AND dp.Segmento_Comercial IS NOT NULL AND dp.Segmento_Comercial <> ''
          ${buildSucursalFilter("fvd")}
        GROUP BY dp.Segmento_Comercial
        ORDER BY SUM(fvd.monto_final_transaccional) DESC
      `),
    ]);

    // ── KPI de snapshot ──────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invRow = inventarioRes.recordset[0] as any;

    // ── Join per-marca en TypeScript ─────────────────────────────────────────
    const stockByMarca = new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      marcasStockRes.recordset.map((r: any) => [
        String(r.marca ?? ""),
        Number(r.stockFisico ?? 0),
      ]),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const marcasDetalle: MarcaItem[] = marcasVentasRes.recordset.map((r: any) => ({
      marca:            String(r.marca ?? ""),
      unidadesVendidas: Number(r.unidadesVendidas ?? 0),
      stockFisico:      stockByMarca.get(String(r.marca ?? "")) ?? 0,
      ventaNeta:        Number(r.ventaNeta ?? 0),
    }));

    // Totales derivados del resultado agrupado (evita una query extra)
    const unidadesTotal  = marcasDetalle.reduce((acc, m) => acc + m.unidadesVendidas, 0);
    const ventaNetaTotal = marcasDetalle.reduce((acc, m) => acc + m.ventaNeta, 0);

    // ── Porcentajes de grupo ──────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawGrupos = gruposRes.recordset.map((r: any) => ({
      grupo:     String(r.grupo ?? ""),
      ventaNeta: Number(r.ventaNeta ?? 0),
    }));
    const totalGrupos = rawGrupos.reduce((acc, r) => acc + r.ventaNeta, 0);
    const gruposMix: GrupoMix[] = rawGrupos.map((r) => ({
      name:       r.grupo,
      size:       r.ventaNeta,
      porcentaje: totalGrupos > 0 ? Math.round((r.ventaNeta / totalGrupos) * 1000) / 10 : 0,
    }));

    return {
      success: true,
      data: {
        kpis: {
          stockFisico:       Number(invRow?.stockFisico       ?? 0),
          capitalInvertido:  Number(invRow?.capitalInvertido  ?? 0),
          unidadesVendidas:  unidadesTotal,
          ventaNetaProducto: ventaNetaTotal,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cantidadFacturas:  Number((facturasRes.recordset[0] as any)?.valor ?? 0),
        },
        marcasDetalle,
        gruposMix,
      },
    };
  } catch (err) {
    console.error("[getInventarioData]", err);
    return { success: false, error: "Error al obtener los datos de inventario." };
  }
}
