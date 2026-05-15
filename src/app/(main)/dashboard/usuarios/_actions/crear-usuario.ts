"use server";

import { getConnection } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";

const crearUsuarioSchema = z.object({
  nombre_completo: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  email: z.string().email("El correo no es válido."),
  password: z.string()
    .min(8, "Mínimo 8 caracteres.")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula.")
    .regex(/[a-z]/, "Debe contener al menos una letra minúscula.")
    .regex(/[0-9]/, "Debe contener al menos un número.")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial (!@#$%^&*…)."),
  id_rol: z.number({ error: "Selecciona un rol." }),
  ids_sucursales: z.array(z.number()).optional().default([]),
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export async function crearUsuario(input: unknown): Promise<{
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

  const parsed = crearUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { nombre_completo, email, password, id_rol, ids_sucursales } = parsed.data;

  try {
    const pool = await getConnection();
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "Desconocida";

    // Verificar email único
    const existente = await pool
      .request()
      .input("email", email)
      .query("SELECT id_usuario FROM dbo.Seguridad_Usuarios WHERE email = @email");

    if (existente.recordset.length > 0) {
      return { success: false, error: "Ya existe un usuario con ese correo electrónico." };
    }

    const password_hash = await bcrypt.hash(password, 12);

    // INSERT usuario
    const insertResult = await pool
      .request()
      .input("nombre_completo", nombre_completo)
      .input("email", email)
      .input("password_hash", password_hash)
      .input("email_admin", emailAdmin)
      .query(`
        INSERT INTO dbo.Seguridad_Usuarios
          (nombre_completo, email, password_hash, esta_activo, fecha_creacion, usuario_creacion)
        OUTPUT INSERTED.id_usuario
        VALUES (@nombre_completo, @email, @password_hash, 1, GETDATE(), @email_admin)
      `);

    const id_nuevo = insertResult.recordset[0].id_usuario;

    // INSERT rol
    await pool
      .request()
      .input("id_usuario", id_nuevo)
      .input("id_rol", id_rol)
      .query(`
        INSERT INTO dbo.Seguridad_Usuarios_Roles (id_usuario, id_rol, esta_vigente)
        VALUES (@id_usuario, @id_rol, 1)
      `);

    // INSERT sucursales
    for (const id_sucursal of ids_sucursales) {
      await pool
        .request()
        .input("id_usuario", id_nuevo)
        .input("id_sucursal", id_sucursal)
        .query(`
          INSERT INTO dbo.Seguridad_Usuarios_Sucursales (id_usuario, id_sucursal, esta_vigente)
          VALUES (@id_usuario, @id_sucursal, 1)
        `);
    }

    // Auditoría
    const nuevosValores = JSON.stringify({ nombre_completo, email, id_rol, ids_sucursales });
    await pool
      .request()
      .input("id_usuario", session.user.id)
      .input("email_usuario", session.user.email)
      .input("accion", "CREAR_USUARIO")
      .input("tabla_afectada", "Seguridad_Usuarios")
      .input("registro_id", String(id_nuevo))
      .input("resultado", "EXITOSO")
      .input("ip_origen", ip)
      .input("valores_anteriores", null)
      .input("valores_nuevos", nuevosValores)
      .query(`
        INSERT INTO dbo.Seguridad_Auditoria
          (id_usuario, email_usuario, accion, tabla_afectada, registro_id, resultado, ip_origen, valores_anteriores, valores_nuevos, fecha_accion)
        VALUES
          (@id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id, @resultado, @ip_origen, @valores_anteriores, @valores_nuevos, GETDATE())
      `);

    return { success: true };
  } catch (error: any) {
    console.error("[ERROR][crear-usuario]", error);
    return { success: false, error: "Error interno al crear el usuario." };
  }
}
