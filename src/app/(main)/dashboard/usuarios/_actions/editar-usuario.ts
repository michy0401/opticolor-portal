"use server";

import { getConnection } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";

const editarUsuarioSchema = z.object({
  id_usuario: z.number(),
  nombre_completo: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  email: z.string().email("El correo no es válido."),
  password: z.string()
    .refine((v) => !v || v.length >= 8,           "Mínimo 8 caracteres.")
    .refine((v) => !v || /[A-Z]/.test(v),         "Debe contener al menos una letra mayúscula.")
    .refine((v) => !v || /[a-z]/.test(v),         "Debe contener al menos una letra minúscula.")
    .refine((v) => !v || /[0-9]/.test(v),         "Debe contener al menos un número.")
    .refine((v) => !v || /[^A-Za-z0-9]/.test(v), "Debe contener al menos un carácter especial (!@#$%^&*…).")
    .optional(),
  id_rol: z.number({ error: "Selecciona un rol." }),
  ids_sucursales: z.array(z.number()).optional().default([]),
});

export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;

export async function editarUsuario(input: unknown): Promise<{
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.nivel ?? 99) > 2) {
    return { success: false, error: "Sin permisos para realizar esta acción." };
  }
  if (!session.user.email) {
    return { success: false, error: "No autorizado: la sesión no contiene email de administrador." };
  }

  const emailAdmin = session.user.email;

  const parsed = editarUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { id_usuario, nombre_completo, email, password, id_rol, ids_sucursales } = parsed.data;

  // Guardia de auto-modificación de rol
  // Un usuario nunca puede cambiar su propio id_rol (independientemente del nivel).
  // id_rol === 0 es el sentinel de "campo oculto" — ya no hacemos nada con el rol.
  // Para cualquier otro valor, verificamos si el editor es el mismo que el editado.
  if (id_rol > 0 && Number(session.user.id) === id_usuario) {
    return { success: false, error: "No puedes cambiar tu propio rol de acceso." };
  }

  try {
    const pool = await getConnection();
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "Desconocida";

    // Capturar valores anteriores para auditoría
    const anteriorResult = await pool
      .request()
      .input("id_usuario", id_usuario)
      .query(`
        SELECT u.nombre_completo, u.email, r.id_rol, r.nombre_rol
        FROM dbo.Seguridad_Usuarios u
        LEFT JOIN dbo.Seguridad_Usuarios_Roles ur ON u.id_usuario = ur.id_usuario AND ur.esta_vigente = 1
        LEFT JOIN dbo.Seguridad_Roles r ON ur.id_rol = r.id_rol
        WHERE u.id_usuario = @id_usuario
      `);
    const anterior = anteriorResult.recordset[0];
    const valoresAnteriores = JSON.stringify(anterior ?? {});

    // UPDATE usuario (con o sin password)
    if (password) {
      const password_hash = await bcrypt.hash(password, 12);
      await pool
        .request()
        .input("id_usuario", id_usuario)
        .input("nombre_completo", nombre_completo)
        .input("email", email)
        .input("password_hash", password_hash)
        .input("email_admin", emailAdmin)
        .query(`
          UPDATE dbo.Seguridad_Usuarios
          SET nombre_completo = @nombre_completo,
              email = @email,
              password_hash = @password_hash,
              fecha_modificacion = GETDATE(),
              usuario_modificacion = @email_admin
          WHERE id_usuario = @id_usuario
        `);
    } else {
      await pool
        .request()
        .input("id_usuario", id_usuario)
        .input("nombre_completo", nombre_completo)
        .input("email", email)
        .input("email_admin", emailAdmin)
        .query(`
          UPDATE dbo.Seguridad_Usuarios
          SET nombre_completo = @nombre_completo,
              email = @email,
              fecha_modificacion = GETDATE(),
              usuario_modificacion = @email_admin
          WHERE id_usuario = @id_usuario
        `);
    }

    // ── Gestión de Rol (Upsert) ────────────────────────────────────────────────
    // Solo si id_rol > 0 (no es sentinel de auto-edición) y el rol realmente cambió
    if (id_rol > 0 && anterior && anterior.id_rol !== id_rol) {
      // Paso 1: desactivar el rol vigente actual
      await pool
        .request()
        .input("id_usuario", id_usuario)
        .query(`
          UPDATE dbo.Seguridad_Usuarios_Roles
          SET esta_vigente = 0
          WHERE id_usuario = @id_usuario AND esta_vigente = 1
        `);

      // Paso 2: ¿ya existe alguna vez el par (id_usuario, id_rol)?
      const rolExistente = await pool
        .request()
        .input("id_usuario", id_usuario)
        .input("id_rol", id_rol)
        .query(`
          SELECT 1
          FROM dbo.Seguridad_Usuarios_Roles
          WHERE id_usuario = @id_usuario AND id_rol = @id_rol
        `);

      // Paso 3: Upsert según existencia
      if (rolExistente.recordset.length > 0) {
        // Reactivar el registro histórico
        await pool
          .request()
          .input("id_usuario", id_usuario)
          .input("id_rol", id_rol)
          .query(`
            UPDATE dbo.Seguridad_Usuarios_Roles
            SET esta_vigente = 1
            WHERE id_usuario = @id_usuario AND id_rol = @id_rol
          `);
      } else {
        // Insertar nuevo par — no existía antes
        await pool
          .request()
          .input("id_usuario", id_usuario)
          .input("id_rol", id_rol)
          .query(`
            INSERT INTO dbo.Seguridad_Usuarios_Roles (id_usuario, id_rol, esta_vigente)
            VALUES (@id_usuario, @id_rol, 1)
          `);
      }
    }

    // Gestionar sucursales: revocar todas y re-asignar las seleccionadas
    await pool
      .request()
      .input("id_usuario", id_usuario)
      .query(`
        UPDATE dbo.Seguridad_Usuarios_Sucursales
        SET esta_vigente = 0
        WHERE id_usuario = @id_usuario AND esta_vigente = 1
      `);

    for (const id_sucursal of ids_sucursales) {
      // Intentar reactivar si ya existía, sino insertar
      const existente = await pool
        .request()
        .input("id_usuario", id_usuario)
        .input("id_sucursal", id_sucursal)
        .query(`
          SELECT 1
          FROM dbo.Seguridad_Usuarios_Sucursales
          WHERE id_usuario = @id_usuario AND id_sucursal = @id_sucursal
        `);

      if (existente.recordset.length > 0) {
        await pool
          .request()
          .input("id_usuario", id_usuario)
          .input("id_sucursal", id_sucursal)
          .query(`
            UPDATE dbo.Seguridad_Usuarios_Sucursales
            SET esta_vigente = 1
            WHERE id_usuario = @id_usuario AND id_sucursal = @id_sucursal
          `);
      } else {
        await pool
          .request()
          .input("id_usuario", id_usuario)
          .input("id_sucursal", id_sucursal)
          .query(`
            INSERT INTO dbo.Seguridad_Usuarios_Sucursales (id_usuario, id_sucursal, esta_vigente)
            VALUES (@id_usuario, @id_sucursal, 1)
          `);
      }
    }

    // Auditoría
    const nuevosValores = JSON.stringify({ nombre_completo, email, id_rol, ids_sucursales });
    await pool
      .request()
      .input("id_usuario", session.user.id)
      .input("email_usuario", session.user.email)
      .input("accion", "EDITAR_USUARIO")
      .input("tabla_afectada", "Seguridad_Usuarios")
      .input("registro_id", String(id_usuario))
      .input("resultado", "EXITOSO")
      .input("ip_origen", ip)
      .input("valores_anteriores", valoresAnteriores)
      .input("valores_nuevos", nuevosValores)
      .query(`
        INSERT INTO dbo.Seguridad_Auditoria
          (id_usuario, email_usuario, accion, tabla_afectada, registro_id, resultado, ip_origen, valores_anteriores, valores_nuevos, fecha_accion)
        VALUES
          (@id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id, @resultado, @ip_origen, @valores_anteriores, @valores_nuevos, GETDATE())
      `);

    return { success: true };
  } catch (error: any) {
    console.error("[ERROR][editar-usuario]", error);
    return { success: false, error: "Error interno al editar el usuario." };
  }
}
