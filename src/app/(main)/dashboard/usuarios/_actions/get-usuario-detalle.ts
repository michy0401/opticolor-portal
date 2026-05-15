"use server";

import { getConnection } from "@/lib/db";

export type AuditoriaRow = {
  id_auditoria: number;
  accion: string;
  tabla_afectada: string | null;
  resultado: string | null;
  ip_origen: string | null;
  fecha_accion: Date;
  valores_anteriores: string | null;
  valores_nuevos: string | null;
};

export type SucursalVigente = {
  id_relacion: number;
  id_sucursal: number;
  nombre_sucursal: string;
};

export type UsuarioDetalle = {
  id_usuario: number;
  nombre_completo: string;
  email: string;
  esta_activo: boolean;
  ultima_sesion: Date | null;
  fecha_creacion: Date | null;
  fecha_modificacion: Date | null;
  usuario_creacion: string | null;
  usuario_modificacion: string | null;
  id_rol: number | null;
  nombre_rol: string | null;
  nivel_jerarquico: number | null;
  sucursales: SucursalVigente[];
  auditoria: AuditoriaRow[];
};

export async function getUsuarioDetalle(idUsuario: number): Promise<{
  success: boolean;
  data: UsuarioDetalle | null;
  error?: string;
}> {
  try {
    const pool = await getConnection();

    // Datos base + rol
    const userResult = await pool
      .request()
      .input("id_usuario", idUsuario)
      .query(`
        SELECT
          u.id_usuario,
          u.nombre_completo,
          u.email,
          u.esta_activo,
          u.ultima_sesion,
          u.fecha_creacion,
          u.fecha_modificacion,
          u.usuario_creacion,
          u.usuario_modificacion,
          r.id_rol,
          r.nombre_rol,
          r.nivel_jerarquico
        FROM dbo.Seguridad_Usuarios u
        LEFT JOIN dbo.Seguridad_Usuarios_Roles ur
          ON u.id_usuario = ur.id_usuario AND ur.esta_vigente = 1
        LEFT JOIN dbo.Seguridad_Roles r
          ON ur.id_rol = r.id_rol
        WHERE u.id_usuario = @id_usuario
      `);

    if (userResult.recordset.length === 0) {
      return { success: false, data: null, error: "Usuario no encontrado." };
    }

    const user = userResult.recordset[0];

    // Sucursales vigentes
    const sucursalesResult = await pool
      .request()
      .input("id_usuario", idUsuario)
      .query(`
        SELECT
          us.id_sucursal AS id_relacion,
          us.id_sucursal,
          ms.nombre_sucursal
        FROM dbo.Seguridad_Usuarios_Sucursales us
        INNER JOIN dbo.Maestro_Sucursales ms ON us.id_sucursal = ms.id_sucursal
        WHERE us.id_usuario = @id_usuario AND us.esta_vigente = 1
        ORDER BY ms.nombre_sucursal ASC
      `);

    // Auditoría últimos 20
    const auditoriaResult = await pool
      .request()
      .input("id_usuario", idUsuario)
      .query(`
        SELECT TOP 20
          id_auditoria,
          accion,
          tabla_afectada,
          resultado,
          ip_origen,
          fecha_accion,
          valores_anteriores,
          valores_nuevos
        FROM dbo.Seguridad_Auditoria
        WHERE id_usuario = @id_usuario
        ORDER BY fecha_accion DESC
      `);

    return {
      success: true,
      data: {
        ...user,
        sucursales: sucursalesResult.recordset,
        auditoria: auditoriaResult.recordset,
      },
    };
  } catch (error: any) {
    console.error("[ERROR][get-usuario-detalle]", error);
    return { success: false, data: null, error: "No se pudo cargar el usuario." };
  }
}
