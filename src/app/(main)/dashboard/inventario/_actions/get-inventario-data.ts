"use server";

import { unstable_cache } from "next/cache";

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

type FetchParams = Params & { userId: number; isSupervisor: boolean };

// ─── Tipos de fila DB (privados) ─────────────────────────────────────────────

// Fila devuelta por Dash_Inventario_Agregado — totales pre-calculados por marca.
// No hay fila de total global: se deriva sumando en TypeScript O(n).
type InvAggRow = {
  marca: string;
  stockFisico: number;
  capitalInvertido: number;
};

// Fila devuelta por la query fusionada de ventas (Marca + Grupo en un solo scan).
// Viene con marca y grupo: si la fila es de resumen de grupo, marca = NULL.
type VentaFusedRow = {
  marca: string | null;
  grupo: string | null;
  unidadesVendidas: number;
  ventaNeta: number;
};

type ValorRow = { valor: number };

// ─── Constantes ───────────────────────────────────────────────────────────────
// Dim_Productos usa PascalCase: Marca, Segmento_Comercial
const EXCLUSION = `AND dp.Segmento_Comercial NOT IN ('LENTES', 'TRATAMIENTOS')`;

// ─── Cache interno — datos por usuario, sucursal, rango y filtros ─────────────
// La guarda de auth vive fuera del cache: unstable_cache no puede capturar
// APIs dinámicas (headers/cookies) como getAuthContext().
// La clave incluye todos los argumentos serializados → cada combinación única
// tiene su propio slot; userId/isSupervisor aseguran aislamiento entre usuarios.
const fetchInventarioData = unstable_cache(
  async (params: FetchParams): Promise<InventarioData> => {
    const { startDate, endDate, sucursalId, marcaFilter, grupoFilter, userId, isSupervisor } = params;

    const pool = await getConnection();

    // Filtros opcionales para la tabla agregada (columnas nativas: marca, grupo)
    const marcaSqlAgg = marcaFilter ? "AND da.marca = @marcaFilter" : "";
    const grupoSqlAgg = grupoFilter ? "AND da.grupo = @grupoFilter" : "";

    // Filtro opcional para Dash_Ventas_Resumen (columna via JOIN Dim_Productos)
    const marcaSql = marcaFilter ? "AND dp.Marca = @marcaFilter" : "";

    const req = () => {
      let r = pool
        .request()
        .input("startDate",    startDate)
        .input("endDate",      endDate)
        .input("sucursalId",   sucursalId)
        .input("userId",       userId)
        .input("isSupervisor", isSupervisor ? 1 : 0);
      if (marcaFilter) r = r.input("marcaFilter", marcaFilter);
      if (grupoFilter) r = r.input("grupoFilter", grupoFilter);
      return r;
    };

    // ── 3 queries en paralelo ────────────────────────────────────────────────
    //
    //  [1] Dash_Inventario_Agregado — totales pre-calculados por marca/grupo.
    //      Lectura directa sobre el snapshot más reciente ≤ @endDate (DATE).
    //      Sin JOIN, sin GROUPING SETS, sin derived tables.
    //      El total global se deriva en TypeScript sumando las filas.
    //
    //  [2] Dash_Ventas_Resumen — GROUPING SETS ((Marca), (Segmento_Comercial))
    //      devuelve filas de marca y de grupo en un solo scan y un solo JOIN.
    //
    //  [3] KPI_Inf1_Cantidad_Facturas — denominador del UPT.

    const [
      inventarioRes,  // Stock por marca (Dash_Inventario_Agregado, snapshot)
      ventasRes,      // Ventas por Marca + por Grupo via GROUPING SETS (flujo)
      facturasRes,    // Conteo de facturas únicas (denominador UPT)
    ] = await Promise.all([

      // ── [QUERY 1] Inventario por Marca (Dash_Inventario_Agregado) ───────────
      //
      // Fuente: tabla de totales pre-calculados — sin JOIN con Dim_Productos,
      // sin GROUPING SETS, sin derived tables. Una lectura directa sobre el
      // snapshot más reciente ≤ @endDate.
      //
      // @snapshotDate: MAX(fecha_foto DATE) ≤ @endDate.
      // El total global (stock + capital) se calcula en TypeScript O(n)
      // sumando todas las filas por marca — cero round-trips adicionales.
      req().query(`
        DECLARE @snapshotDate DATE = (
          SELECT MAX(da_inner.fecha_foto)
          FROM dbo.Dash_Inventario_Agregado da_inner
          WHERE da_inner.fecha_foto <= CAST(@endDate AS DATE)
            AND da_inner.grupo NOT IN ('LENTES', 'TRATAMIENTOS')
            ${buildSucursalFilter("da_inner")}
        );

        SELECT
          da.marca                              AS marca,
          ISNULL(SUM(da.stock_total),  0)       AS stockFisico,
          ISNULL(SUM(da.valor_total),  0)       AS capitalInvertido
        FROM dbo.Dash_Inventario_Agregado da
        WHERE da.fecha_foto = @snapshotDate
          AND da.grupo NOT IN ('LENTES', 'TRATAMIENTOS')
          ${marcaSqlAgg}
          ${grupoSqlAgg}
          ${buildSucursalFilter("da")}
        GROUP BY da.marca
        ORDER BY SUM(da.stock_total) DESC
      `),

      // ── [QUERY 2] Ventas fusionadas: Por Marca + Por Grupo (flujo) ──────────
      //
      // Fuente: Dash_Ventas_Resumen (tabla física de resumen, reemplaza la vista
      // Fact_Ventas_Detalle). fecha_factura es tipo DATE → SARGable con los
      // parámetros ISO 'YYYY-MM-DD' sin necesidad de conversión explícita.
      //
      // GROUPING SETS ((dp.Marca), (dp.Segmento_Comercial)) produce:
      //   · grupo=NULL, marca='RAYBAN' → ventas de esa marca
      //   · marca=NULL, grupo='ARMAZONES' → ventas de ese grupo
      // Un solo JOIN. Un solo round-trip.
      req().query(`
        SELECT
          dp.Marca                                  AS marca,
          dp.Segmento_Comercial                     AS grupo,
          ISNULL(SUM(dvr.cantidad), 0)              AS unidadesVendidas,
          ISNULL(SUM(dvr.monto_total), 0)           AS ventaNeta
        FROM dbo.Dash_Ventas_Resumen dvr
        INNER JOIN dbo.Dim_Productos dp ON dvr.id_producto = dp.SK_Producto
        WHERE dvr.fecha_factura >= @startDate
          AND dvr.fecha_factura <= @endDate
          ${EXCLUSION}
          ${marcaSql}
          AND dp.Marca IS NOT NULL AND dp.Marca <> ''
          AND dp.Segmento_Comercial IS NOT NULL AND dp.Segmento_Comercial <> ''
          ${buildSucursalFilter("dvr")}
        GROUP BY GROUPING SETS ((dp.Marca), (dp.Segmento_Comercial))
        ORDER BY SUM(dvr.monto_total) DESC
      `),

      // ── [QUERY 3] Facturas únicas — denominador del UPT ────────────────────
      req().query(`
        SELECT COUNT(DISTINCT id_factura) AS valor
        FROM dbo.KPI_Inf1_Cantidad_Facturas
        WHERE fecha_factura >= @startDate
          AND fecha_factura <= @endDate
          ${buildSucursalFilter()}
      `),
    ]);

    // ── Procesamiento TypeScript — costo O(n), cero round-trips adicionales ───

    // [A] Inventario: todas las filas son por marca (sin fila de total GROUPING SETS).
    // El total global se deriva sumando en TypeScript — cero round-trips adicionales.
    const invRows = inventarioRes.recordset as InvAggRow[];

    const stockTotal   = invRows.reduce((acc, r) => acc + Number(r.stockFisico    ?? 0), 0);
    const capitalTotal = invRows.reduce((acc, r) => acc + Number(r.capitalInvertido ?? 0), 0);

    const stockByMarca = new Map(
      invRows.map((r) => [String(r.marca ?? ""), Number(r.stockFisico ?? 0)]),
    );

    // [B] Ventas: separar filas de marca vs. filas de grupo
    const ventasRows = ventasRes.recordset as VentaFusedRow[];

    // Filas de MARCA: tienen marca != NULL y grupo = NULL (GROUPING SET de Marca)
    const ventasMarca = ventasRows.filter(
      (r) => r.marca !== null && r.grupo === null,
    );
    // Filas de GRUPO: tienen grupo != NULL y marca = NULL (GROUPING SET de Grupo)
    const ventasGrupo = ventasRows.filter(
      (r) => r.grupo !== null && r.marca === null,
    );

    // [C] Construcción de marcasDetalle: join en memoria entre ventas y stock
    const marcasDetalle: MarcaItem[] = ventasMarca.map((r) => ({
      marca:            String(r.marca ?? ""),
      unidadesVendidas: Number(r.unidadesVendidas ?? 0),
      stockFisico:      stockByMarca.get(String(r.marca ?? "")) ?? 0,
      ventaNeta:        Number(r.ventaNeta ?? 0),
    }));

    // [D] Totales de ventas derivados del mismo resultado (sin query extra)
    const unidadesTotal  = marcasDetalle.reduce((acc, m) => acc + m.unidadesVendidas, 0);
    const ventaNetaTotal = marcasDetalle.reduce((acc, m) => acc + m.ventaNeta, 0);

    // [E] Porcentajes de grupo — calculados sobre las filas de grupo
    const rawGrupos = ventasGrupo.map((r) => ({
      grupo:     String(r.grupo ?? ""),
      ventaNeta: Number(r.ventaNeta ?? 0),
    }));
    const totalGrupos = rawGrupos.reduce((acc, r) => acc + r.ventaNeta, 0);
    const gruposMix: GrupoMix[] = rawGrupos.map((r) => ({
      name:       r.grupo,
      size:       r.ventaNeta,
      porcentaje: totalGrupos > 0 ? Math.round((r.ventaNeta / totalGrupos) * 10000) / 100 : 0,
    }));

    return {
      kpis: {
        stockFisico:       stockTotal,
        capitalInvertido:  capitalTotal,
        unidadesVendidas:  unidadesTotal,
        ventaNetaProducto: ventaNetaTotal,
        cantidadFacturas:  Number((facturasRes.recordset as ValorRow[])[0]?.valor ?? 0),
      },
      marcasDetalle,
      gruposMix,
    };
  },
  ["dash-inventario"],
  { revalidate: 3600, tags: ["dash-inventario"] },
);

// ─── Acción principal ─────────────────────────────────────────────────────────
// La guarda de auth vive fuera del cache: unstable_cache no puede capturar
// APIs dinámicas (headers/cookies) como getAuthContext().

export async function getInventarioData(
  params: Params,
): Promise<{ success: boolean; data?: InventarioData; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "No autorizado" };

    const data = await fetchInventarioData({
      ...params,
      userId:       auth.userId,
      isSupervisor: auth.isSupervisor,
    });
    return { success: true, data };
  } catch (err) {
    console.error("[ERROR][getInventarioData]", err);
    return { success: false, error: "Error al obtener los datos de inventario." };
  }
}
