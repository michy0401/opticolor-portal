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

// ─── Tipos de fila DB (privados) ─────────────────────────────────────────────

// Fila devuelta por la query fusionada de inventario (GROUPING SETS).
// marca = NULL  → fila de TOTAL (GROUPING(dp.Marca) = 1)
// marca = valor → fila de desglose por marca
type InvFusedRow = {
  marca: string | null;
  stockFisico: number;
  capitalInvertido: number;
  esTotal: number; // 1 si es la fila de total, 0 si es por marca
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
        .input("endDate",   endDate)
        .input("sucursalId", sucursalId)
        .input("userId",     userId)
        .input("isSupervisor", isSupervisor ? 1 : 0);
      if (marcaFilter) r = r.input("marcaFilter", marcaFilter);
      if (grupoFilter) r = r.input("grupoFilter", grupoFilter);
      return r;
    };

    // ── 3 queries en paralelo (reducido desde 5) ─────────────────────────────
    //
    // OPTIMIZACIONES APLICADAS:
    //
    //  [1] SARGability total:
    //      · fecha_factura en Fact_Ventas_Detalle es tipo DATE (ya convertida
    //        por la vista). Los parámetros @startDate/@endDate son strings ISO,
    //        SQL Server los convierte implícitamente a DATE → índice en uso.
    //      · fecha_foto_sistema en Fact_Inventario es datetime2. En lugar de
    //        CAST(fi.fecha_foto_sistema AS DATE) <= @endDate (non-SARGable),
    //        usamos una subquery que halla la MAX fecha de snapshot ≤ @endDate
    //        y filtramos fi.fecha_foto_sistema exactamente por ese valor. Así
    //        el predicado recae sobre el datetime2 puro → índice utilizable.
    //
    //  [2] Snapshot eficiente (Fact_Inventario):
    //      Subquery @snapshotDate = MAX(CAST(fecha_foto_sistema AS DATE)) ≤ @endDate.
    //      Solo escaneamos las filas de ESA fecha exacta, no toda la historia.
    //
    //  [3] Fusión Inventario (Stock Total + Stock por Marca en una sola pasada):
    //      GROUPING SETS ((dp.Marca), ()) → una sola query devuelve:
    //        · La fila TOTAL (GROUPING(dp.Marca)=1, marca=NULL)
    //        · Las filas por marca
    //      El split se hace en TypeScript O(n), costo cero en la red.
    //
    //  [4] Fusión Ventas (Marca + Grupo en una sola pasada):
    //      GROUPING SETS ((dp.Marca), (dp.Segmento_Comercial)) → un solo JOIN
    //      con Fact_Ventas_Detalle devuelve filas para ambos niveles:
    //        · Filas de marca: grupo = NULL
    //        · Filas de grupo: marca = NULL
    //      Eliminamos completamente la segunda query y el segundo JOIN.
    //
    //  [5] Payload limpio: solo SUM de las columnas que el frontend consume.

    const [
      inventarioRes,  // Stock total + por marca via GROUPING SETS (snapshot)
      ventasRes,      // Ventas por Marca + por Grupo via GROUPING SETS (flujo)
      facturasRes,    // Conteo de facturas únicas (denominador UPT)
    ] = await Promise.all([

      // ── [QUERY 1] Inventario fusionado: Total + Por Marca (snapshot) ────────
      //
      // La subquery interna encuentra el último snapshot disponible en el rango.
      // El filtro externo usa fi.fecha_foto_sistema (datetime2) comparado con
      // el inicio y fin del día de esa fecha — completamente SARGable.
      //
      // GROUPING SETS ((dp.Marca), ()) produce:
      //   · esTotal = 0, marca = 'RAYBAN'  → stock de esa marca
      //   · esTotal = 1, marca = NULL      → stock total
      req().query(`
        DECLARE @snapshotDate DATE = (
          SELECT MAX(CAST(fi_inner.fecha_foto_sistema AS DATE))
          FROM dbo.Fact_Inventario fi_inner
          INNER JOIN dbo.Dim_Productos dp_inner
            ON fi_inner.id_producto = dp_inner.SK_Producto
          WHERE fi_inner.fecha_foto_sistema < DATEADD(DAY, 1, CAST(@endDate AS DATE))
            AND dp_inner.Segmento_Comercial NOT IN ('LENTES', 'TRATAMIENTOS')
            ${buildSucursalFilter("fi_inner")}
        );

        SELECT
          dp.Marca                                        AS marca,
          ISNULL(SUM(fi.cantidad_disponible),    0)       AS stockFisico,
          ISNULL(SUM(fi.valor_total_inventario), 0)       AS capitalInvertido,
          GROUPING(dp.Marca)                              AS esTotal
        FROM dbo.Fact_Inventario fi
        INNER JOIN dbo.Dim_Productos dp ON fi.id_producto = dp.SK_Producto
        WHERE fi.fecha_foto_sistema >= CAST(@snapshotDate AS DATETIME2)
          AND fi.fecha_foto_sistema <  DATEADD(DAY, 1, CAST(@snapshotDate AS DATETIME2))
          ${EXCLUSION}
          ${marcaSql}
          ${grupoSql}
          ${buildSucursalFilter("fi")}
        GROUP BY GROUPING SETS ((dp.Marca), ())
      `),

      // ── [QUERY 2] Ventas fusionadas: Por Marca + Por Grupo (flujo) ──────────
      //
      // fecha_factura en Fact_Ventas_Detalle es tipo DATE (la vista ya aplica
      // CAST(...) AS DATE). Los parámetros ISO 'YYYY-MM-DD' son SARGables
      // directamente: SQL los trata como DATE sin necesidad de conversión.
      //
      // GROUPING SETS ((dp.Marca), (dp.Segmento_Comercial)) produce:
      //   · grupo=NULL, marca='RAYBAN' → ventas de esa marca
      //   · marca=NULL, grupo='ARMAZONES' → ventas de ese grupo
      // Un solo JOIN. Un solo round-trip.
      req().query(`
        SELECT
          dp.Marca                                        AS marca,
          dp.Segmento_Comercial                           AS grupo,
          ISNULL(SUM(fvd.cantidad), 0)                    AS unidadesVendidas,
          ISNULL(SUM(fvd.monto_final_transaccional), 0)   AS ventaNeta
        FROM dbo.Fact_Ventas_Detalle fvd
        INNER JOIN dbo.Dim_Productos dp ON fvd.id_producto = dp.SK_Producto
        WHERE fvd.fecha_factura >= @startDate
          AND fvd.fecha_factura <= @endDate
          ${EXCLUSION}
          ${marcaSql}
          AND dp.Marca IS NOT NULL AND dp.Marca <> ''
          AND dp.Segmento_Comercial IS NOT NULL AND dp.Segmento_Comercial <> ''
          ${buildSucursalFilter("fvd")}
        GROUP BY GROUPING SETS ((dp.Marca), (dp.Segmento_Comercial))
        ORDER BY SUM(fvd.monto_final_transaccional) DESC
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

    // [A] Inventario: separar la fila TOTAL de las filas por marca
    const invRows = inventarioRes.recordset as InvFusedRow[];
    const invTotal = invRows.find((r) => r.esTotal === 1);
    const invByMarca = invRows.filter((r) => r.esTotal === 0);

    const stockByMarca = new Map(
      invByMarca.map((r) => [String(r.marca ?? ""), Number(r.stockFisico ?? 0)]),
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
      success: true,
      data: {
        kpis: {
          stockFisico:       Number(invTotal?.stockFisico       ?? 0),
          capitalInvertido:  Number(invTotal?.capitalInvertido  ?? 0),
          unidadesVendidas:  unidadesTotal,
          ventaNetaProducto: ventaNetaTotal,
          cantidadFacturas:  Number((facturasRes.recordset as ValorRow[])[0]?.valor ?? 0),
        },
        marcasDetalle,
        gruposMix,
      },
    };
  } catch (err) {
    console.error("[ERROR][getInventarioData]", err);
    return { success: false, error: "Error al obtener los datos de inventario." };
  }
}
