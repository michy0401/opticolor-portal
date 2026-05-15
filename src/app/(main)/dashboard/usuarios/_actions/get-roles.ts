"use server";

import { getConnection } from "@/lib/db";

export type Rol = {
  id_rol: number;
  nombre_rol: string;
  nivel_jerarquico: number;
};

export async function getRoles(): Promise<{
  success: boolean;
  data: Rol[];
  error?: string;
}> {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT id_rol, nombre_rol, nivel_jerarquico
      FROM dbo.Seguridad_Roles
      WHERE nivel_jerarquico IN (1, 2, 4) AND esta_activo = 1
      ORDER BY nivel_jerarquico ASC
    `);
    return { success: true, data: result.recordset };
  } catch (error: any) {
    console.error("[ERROR][get-roles]", error);
    return { success: false, data: [], error: "No se pudieron cargar los roles." };
  }
}
