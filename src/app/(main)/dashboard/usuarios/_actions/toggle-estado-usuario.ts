"use server";

import { getConnection } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { headers } from "next/headers";

export async function toggleEstadoUsuario(
  idUsuario: number,
  nuevoEstado: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.nivel ?? 99) > 2) {
    return { success: false, error: "Sin permisos para realizar esta acción." };
  }

  try {
    const pool = await getConnection();
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "Desconocida";

    // Capturar estado anterior
    const anteriorResult = await pool
      .request()
      .input("id_usuario", idUsuario)
      .query("SELECT esta_activo FROM dbo.Seguridad_Usuarios WHERE id_usuario = @id_usuario");
    const estadoAnterior = anteriorResult.recordset[0]?.esta_activo;

    await pool
      .request()
      .input("id_usuario", idUsuario)
      .input("esta_activo", nuevoEstado ? 1 : 0)
      .query(`
        UPDATE dbo.Seguridad_Usuarios
        SET esta_activo = @esta_activo
        WHERE id_usuario = @id_usuario
      `);

    // Auditoría
    await pool
      .request()
      .input("id_usuario", session.user.id)
      .input("email_usuario", session.user.email)
      .input("accion", nuevoEstado ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO")
      .input("tabla_afectada", "Seguridad_Usuarios")
      .input("registro_id", String(idUsuario))
      .input("resultado", "EXITOSO")
      .input("ip_origen", ip)
      .input("valores_anteriores", JSON.stringify({ esta_activo: estadoAnterior }))
      .input("valores_nuevos", JSON.stringify({ esta_activo: nuevoEstado ? 1 : 0 }))
      .query(`
        INSERT INTO dbo.Seguridad_Auditoria
          (id_usuario, email_usuario, accion, tabla_afectada, registro_id, resultado, ip_origen, valores_anteriores, valores_nuevos, fecha_accion)
        VALUES
          (@id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id, @resultado, @ip_origen, @valores_anteriores, @valores_nuevos, GETDATE())
      `);

    return { success: true };
  } catch (error: any) {
    console.error("[ERROR][toggle-estado-usuario]", error);
    return { success: false, error: "Error interno al cambiar el estado." };
  }
}
