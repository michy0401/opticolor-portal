"use server";

import { getConnection } from "@/lib/db";

export type DatosEdicion = {
  id_rol: number | null;
  ids_sucursales: number[];
};

export async function getDatosEdicion(idUsuario: number): Promise<{
  success: boolean;
  data: DatosEdicion | null;
  error?: string;
}> {
  try {
    const pool = await getConnection();

    // Rol activo
    const rolResult = await pool
      .request()
      .input("id_usuario", idUsuario)
      .query(`
        SELECT r.id_rol
        FROM dbo.Seguridad_Usuarios_Roles ur
        INNER JOIN dbo.Seguridad_Roles r ON ur.id_rol = r.id_rol
        WHERE ur.id_usuario = @id_usuario AND ur.esta_vigente = 1
      `);

    // Sucursales vigentes
    const sucursalesResult = await pool
      .request()
      .input("id_usuario", idUsuario)
      .query(`
        SELECT id_sucursal
        FROM dbo.Seguridad_Usuarios_Sucursales
        WHERE id_usuario = @id_usuario AND esta_vigente = 1
      `);

    return {
      success: true,
      data: {
        id_rol: rolResult.recordset[0]?.id_rol ?? null,
        ids_sucursales: sucursalesResult.recordset.map(
          (r: { id_sucursal: number }) => r.id_sucursal
        ),
      },
    };
  } catch (error: any) {
    console.error("[ERROR][get-datos-edicion]", error);
    return { success: false, data: null, error: "No se pudieron cargar los datos." };
  }
}
