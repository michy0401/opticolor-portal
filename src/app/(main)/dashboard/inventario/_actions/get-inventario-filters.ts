"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getConnection } from "@/lib/db";

export type InventarioFilters = {
  marcas: string[];
  grupos: string[];
};

export async function getMarcasGrupos(): Promise<{
  success: boolean;
  data?: InventarioFilters;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "No autorizado" };

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: Array<{ Marca: string; Segmento_Comercial: string }> = res.recordset.map((r: any) => ({
      Marca:              String(r.Marca),
      Segmento_Comercial: String(r.Segmento_Comercial),
    }));

    const marcas = [...new Set(rows.map((r) => r.Marca))].sort();
    const grupos = [...new Set(rows.map((r) => r.Segmento_Comercial))].sort();

    return { success: true, data: { marcas, grupos } };
  } catch (err) {
    console.error("[getMarcasGrupos]", err);
    return { success: false, error: "Error al obtener filtros." };
  }
}
