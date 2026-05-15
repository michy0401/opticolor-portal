"use server";

import { getConnection } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { headers } from "next/headers";

export async function cambiarRol(
  idUsuario: number,
  nuevoIdRol: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.nivel ?? 99) > 2) {
    return { success: false, error: "Sin permisos para realizar esta acción." };
  }
  if (!session.user.email) {
    return { success: false, error: "No autorizado: la sesión no contiene email de administrador." };
  }
  // Guardia de auto-modificación: nadie puede cambiar su propio rol
  if (Number(session.user.id) === idUsuario) {
    return { success: false, error: "No puedes cambiar tu propio rol de acceso." };
  }

  const emailAdmin = session.user.email;

  try {
    const pool = await getConnection();
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "Desconocida";

    // Capturar rol anterior
    const anteriorResult = await pool
      .request()
      .input("id_usuario", idUsuario)
      .query(`
        SELECT r.id_rol, r.nombre_rol, r.nivel_jerarquico
        FROM dbo.Seguridad_Usuarios_Roles ur
        INNER JOIN dbo.Seguridad_Roles r ON ur.id_rol = r.id_rol
        WHERE ur.id_usuario = @id_usuario AND ur.esta_vigente = 1
      `);
    const rolAnterior = anteriorResult.recordset[0];

    // ── Protección de Super Admin ───────────────────────────────────────────
    // Ningún usuario puede modificar el rol de un perfil de nivel 1 (SUPER_ADMIN)
    if (rolAnterior?.nivel_jerarquico === 1) {
      return { success: false, error: "No se puede modificar el rol de un Super Admin." };
    }
    // Tampoco se puede asignar el rol de nivel 1 a nadie mediante esta acción
    const nuevoRolCheckResult = await pool
      .request()
      .input("id_rol", nuevoIdRol)
      .query("SELECT nivel_jerarquico FROM dbo.Seguridad_Roles WHERE id_rol = @id_rol");
    if (nuevoRolCheckResult.recordset[0]?.nivel_jerarquico === 1) {
      return { success: false, error: "No se puede asignar el rol de Super Admin desde este panel." };
    }

    // Desactivar rol vigente
    await pool
      .request()
      .input("id_usuario", idUsuario)
      .query(`
        UPDATE dbo.Seguridad_Usuarios_Roles
        SET esta_vigente = 0
        WHERE id_usuario = @id_usuario AND esta_vigente = 1
      `);

    // Insertar nuevo rol
    await pool
      .request()
      .input("id_usuario", idUsuario)
      .input("id_rol", nuevoIdRol)
      .query(`
        INSERT INTO dbo.Seguridad_Usuarios_Roles (id_usuario, id_rol, esta_vigente)
        VALUES (@id_usuario, @id_rol, 1)
      `);

    // Estampar auditoría en la ficha del usuario
    await pool
      .request()
      .input("id_usuario", idUsuario)
      .input("email_admin", emailAdmin)
      .query(`
        UPDATE dbo.Seguridad_Usuarios
        SET fecha_modificacion = GETDATE(),
            usuario_modificacion = @email_admin
        WHERE id_usuario = @id_usuario
      `);

    // Obtener nombre nuevo rol para auditoría
    const nuevoRolResult = await pool
      .request()
      .input("id_rol", nuevoIdRol)
      .query("SELECT nombre_rol FROM dbo.Seguridad_Roles WHERE id_rol = @id_rol");
    const nuevoRol = nuevoRolResult.recordset[0];

    // Auditoría
    await pool
      .request()
      .input("id_usuario", session.user.id)
      .input("email_usuario", session.user.email)
      .input("accion", "CAMBIAR_ROL")
      .input("tabla_afectada", "Seguridad_Usuarios_Roles")
      .input("registro_id", String(idUsuario))
      .input("resultado", "EXITOSO")
      .input("ip_origen", ip)
      .input("valores_anteriores", JSON.stringify(rolAnterior ?? {}))
      .input("valores_nuevos", JSON.stringify({ id_rol: nuevoIdRol, nombre_rol: nuevoRol?.nombre_rol }))
      .query(`
        INSERT INTO dbo.Seguridad_Auditoria
          (id_usuario, email_usuario, accion, tabla_afectada, registro_id, resultado, ip_origen, valores_anteriores, valores_nuevos, fecha_accion)
        VALUES
          (@id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id, @resultado, @ip_origen, @valores_anteriores, @valores_nuevos, GETDATE())
      `);

    return { success: true };
  } catch (error: any) {
    console.error("[ERROR][cambiar-rol]", error);
    return { success: false, error: "Error interno al cambiar el rol." };
  }
}
