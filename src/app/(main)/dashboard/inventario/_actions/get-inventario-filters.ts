"use server";

import { unstable_cache } from "next/cache";

import { getConnection } from "@/lib/db";
import { getAuthContext } from "@/lib/get-auth-context";

export type InventarioFilters = {
  marcas: string[];
  grupos: string[];
};

// ─── Cache interno — catálogo global, sin dependencia de usuario ──────────────
// Un solo slot para toda la app; se invalida con revalidateTag('marcas-grupos-inventory')
const fetchMarcasGrupos = unstable_cache(
  async (): Promise<InventarioFilters> => {
    const pool = await getConnection();

    // Una sola query devuelve combinaciones únicas Marca × Segmento_Comercial.
    // TypeScript deduplica cada dimensión con Set para poblar los dos selects.
    const res = await pool.request().query(`
      SELECT DISTINCT Marca, Segmento_Comercial
      FROM dbo.Dim_Productos
      WHERE Segmento_Comercial NOT IN ('LENTES', 'TRATAMIENTOS')
        AND Marca             IS NOT NULL AND Marca             <> ''
        AND Segmento_Comercial IS NOT NULL AND Segmento_Comercial <> ''
      ORDER BY Marca
    `);

    type DimProductoRow = { Marca: string; Segmento_Comercial: string };
    const rows = (res.recordset as DimProductoRow[]).map((r) => ({
      Marca:              String(r.Marca),
      Segmento_Comercial: String(r.Segmento_Comercial),
    }));

    return {
      marcas: [...new Set(rows.map((r) => r.Marca))].sort(),
      grupos: [...new Set(rows.map((r) => r.Segmento_Comercial))].sort(),
    };
  },
  ["marcas-grupos-inventory"],
  { revalidate: 3600, tags: ["marcas-grupos-inventory"] },
);

// ─── Acción principal ─────────────────────────────────────────────────────────
// La guarda de auth vive fuera del cache: unstable_cache no puede capturar
// APIs dinámicas (headers/cookies) como getAuthContext().
export async function getMarcasGrupos(): Promise<{
  success: boolean;
  data?: InventarioFilters;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "No autorizado" };

    const data = await fetchMarcasGrupos();
    return { success: true, data };
  } catch (err) {
    console.error("[ERROR][getMarcasGrupos]", err);
    return { success: false, error: "Error al obtener filtros." };
  }
}
