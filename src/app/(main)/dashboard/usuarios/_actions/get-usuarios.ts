"use server";

import { getConnection } from "@/lib/db";

export type UsuarioRow = {
  id_usuario: number;
  nombre_completo: string;
  email: string;
  esta_activo: boolean;
  ultima_sesion: Date | null;
  nombre_rol: string | null;
  nivel_jerarquico: number | null;
};

export async function getUsuarios(): Promise<{
  success: boolean;
  data: UsuarioRow[];
  error?: string;
}> {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT
        u.id_usuario,
        u.nombre_completo,
        u.email,
        u.esta_activo,
        u.ultima_sesion,
        r.nombre_rol,
        r.nivel_jerarquico
      FROM dbo.Seguridad_Usuarios u
      LEFT JOIN dbo.Seguridad_Usuarios_Roles ur
        ON u.id_usuario = ur.id_usuario AND ur.esta_vigente = 1
      LEFT JOIN dbo.Seguridad_Roles r
        ON ur.id_rol = r.id_rol
      ORDER BY u.nombre_completo ASC
    `);
    return { success: true, data: result.recordset };
  } catch (error: any) {
    console.error("[ERROR][get-usuarios]", error);
    return { success: false, data: [], error: "No se pudieron cargar los usuarios." };
  }
}
