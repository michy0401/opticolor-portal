"use server";

import { getConnection } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { headers } from "next/headers";

export async function revocarSucursal(
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
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "Desconocida";

    await pool
      .request()
      .input("id_usuario", idUsuario)
      .input("id_sucursal", idSucursal)
      .query(`
        UPDATE dbo.Seguridad_Usuarios_Sucursales
        SET esta_vigente = 0
        WHERE id_usuario = @id_usuario AND id_sucursal = @id_sucursal
      `);

    // Auditoría
    await pool
      .request()
      .input("id_usuario", session.user.id)
      .input("email_usuario", session.user.email)
      .input("accion", "REVOCAR_SUCURSAL")
      .input("tabla_afectada", "Seguridad_Usuarios_Sucursales")
      .input("registro_id", String(idUsuario))
      .input("resultado", "EXITOSO")
      .input("ip_origen", ip)
      .input("valores_anteriores", JSON.stringify({ id_sucursal: idSucursal, nombre_sucursal: nombreSucursal, esta_vigente: 1 }))
      .input("valores_nuevos", JSON.stringify({ id_sucursal: idSucursal, nombre_sucursal: nombreSucursal, esta_vigente: 0 }))
      .query(`
        INSERT INTO dbo.Seguridad_Auditoria
          (id_usuario, email_usuario, accion, tabla_afectada, registro_id, resultado, ip_origen, valores_anteriores, valores_nuevos, fecha_accion)
        VALUES
          (@id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id, @resultado, @ip_origen, @valores_anteriores, @valores_nuevos, GETDATE())
      `);

    return { success: true };
  } catch (error: any) {
    console.error("[ERROR][revocar-sucursal]", error);
    return { success: false, error: "Error interno al revocar la sucursal." };
  }
}
