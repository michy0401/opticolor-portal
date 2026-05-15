"use server";

import { getConnection } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { headers } from "next/headers";

/**
 * Asigna una sucursal a un usuario.
 * - Si ya existe el par (id_usuario, id_sucursal) pero está inactiva, la reactiva.
 * - Si no existe, inserta el registro.
 */
export async function asignarSucursal(
  idUsuario: number,
  idSucursal: number,
  nombreSucursal: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.nivel ?? 99) > 2) {
    return { success: false, error: "Sin permisos para realizar esta acción." };
  }

  try {
    const pool = await getConnection();
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for") ||
      headersList.get("x-real-ip") ||
      "Desconocida";

    // ¿Ya existe el registro?
    const existente = await pool
      .request()
      .input("id_usuario", idUsuario)
      .input("id_sucursal", idSucursal)
      .query(`
        SELECT esta_vigente
        FROM dbo.Seguridad_Usuarios_Sucursales
        WHERE id_usuario = @id_usuario AND id_sucursal = @id_sucursal
      `);

    if (existente.recordset.length > 0) {
      // Reactivar si estaba revocada
      await pool
        .request()
        .input("id_usuario", idUsuario)
        .input("id_sucursal", idSucursal)
        .query(`
          UPDATE dbo.Seguridad_Usuarios_Sucursales
          SET esta_vigente = 1
          WHERE id_usuario = @id_usuario AND id_sucursal = @id_sucursal
        `);
    } else {
      // Insertar nueva asignación
      await pool
        .request()
        .input("id_usuario", idUsuario)
        .input("id_sucursal", idSucursal)
        .query(`
          INSERT INTO dbo.Seguridad_Usuarios_Sucursales (id_usuario, id_sucursal, esta_vigente)
          VALUES (@id_usuario, @id_sucursal, 1)
        `);
    }

    // Auditoría
    await pool
      .request()
      .input("id_usuario", session.user.id)
      .input("email_usuario", session.user.email)
      .input("accion", "ASIGNAR_SUCURSAL")
      .input("tabla_afectada", "Seguridad_Usuarios_Sucursales")
      .input("registro_id", String(idUsuario))
      .input("resultado", "EXITOSO")
      .input("ip_origen", ip)
      .input("valores_anteriores", JSON.stringify({ id_sucursal: idSucursal, esta_vigente: 0 }))
      .input("valores_nuevos", JSON.stringify({ id_sucursal: idSucursal, nombre_sucursal: nombreSucursal, esta_vigente: 1 }))
      .query(`
        INSERT INTO dbo.Seguridad_Auditoria
          (id_usuario, email_usuario, accion, tabla_afectada, registro_id, resultado, ip_origen, valores_anteriores, valores_nuevos, fecha_accion)
        VALUES
          (@id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id, @resultado, @ip_origen, @valores_anteriores, @valores_nuevos, GETDATE())
      `);

    return { success: true };
  } catch (error: any) {
    console.error("[ERROR][asignar-sucursal]", error);
    return { success: false, error: "Error interno al asignar la sucursal." };
  }
}
