"use server";

import { getConnection } from "@/lib/db";

export type SucursalOption = {
  id_sucursal: number;
  nombre_sucursal: string;
  alias_sucursal: string | null;
};

export async function getSucursalesParaSelector(): Promise<{
  success: boolean;
  data: SucursalOption[];
  error?: string;
}> {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT id_sucursal, nombre_sucursal, alias_sucursal
      FROM dbo.Maestro_Sucursales
      ORDER BY nombre_sucursal ASC
    `);
    return { success: true, data: result.recordset };
  } catch (error: any) {
    console.error("[ERROR][get-sucursales]", error);
    return { success: false, data: [], error: "No se pudieron cargar las sucursales." };
  }
}
