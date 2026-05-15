"use server";

import { getConnection } from "@/lib/db";

export type UsuarioSucursal = {
  nombre_completo: string;
};

export async function getUsuariosBySucursal(
  idSucursal: number
): Promise<{ success: boolean; data: UsuarioSucursal[]; error?: string }> {
  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .input("id_sucursal", idSucursal)
      .query(`
        SELECT u.nombre_completo 
        FROM dbo.Seguridad_Usuarios u
        INNER JOIN dbo.Seguridad_Usuarios_Sucursales us ON u.id_usuario = us.id_usuario
        WHERE us.id_sucursal = @id_sucursal AND us.esta_vigente = 1
      `);

    return { success: true, data: result.recordset };
  } catch (error: any) {
    console.error("[ERROR][get-usuarios-sucursal]", error);
    return { success: false, data: [], error: "Error al obtener usuarios." };
  }
}
