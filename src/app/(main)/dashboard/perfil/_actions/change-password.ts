"use server";

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { headers } from "next/headers";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getConnection } from "@/lib/db";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida."),
  newPassword: z.string()
    .min(8, "Mínimo 8 caracteres.")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula.")
    .regex(/[a-z]/, "Debe contener al menos una letra minúscula.")
    .regex(/[0-9]/, "Debe contener al menos un número.")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial (!@#$%^&*…)."),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"]
});

export async function changePassword(formData: FormData) {
  try {
    // 1. Validate Session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const id_usuario = session.user.id;
    const email_usuario = session.user.email;
    const headersList = await headers();
    const ip_origen = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "Desconocida";

    const pool = await getConnection();

    // Helper para registrar auditoría en caso de fallos de validación o lógica
    const logErrorAudit = async (errorMsg: string) => {
      try {
        await pool.request()
          .input("id_usuario", id_usuario)
          .input("email_usuario", email_usuario)
          .input("accion", "CAMBIO_PASSWORD")
          .input("tabla_afectada", "Seguridad_Usuarios")
          .input("registro_id", id_usuario)
          .input("valores_anteriores", "[HASH_ACTUAL_PROTEGIDO]")
          .input("valores_nuevos", null)
          .input("resultado", "ERROR")
          .input("mensaje_error", errorMsg)
          .input("ip_origen", ip_origen)
          .query(`
            INSERT INTO dbo.Seguridad_Auditoria (
              id_usuario, email_usuario, accion, tabla_afectada, registro_id,
              valores_anteriores, valores_nuevos, resultado, mensaje_error, ip_origen, fecha_accion
            ) VALUES (
              @id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id,
              @valores_anteriores, @valores_nuevos, @resultado, @mensaje_error, @ip_origen, GETDATE()
            )
          `);
      } catch (err) {
        console.error("[ERROR][change-password] auditoría de fallo", err);
      }
    };

    // 2. Validate Inputs
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    const validationResult = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validationResult.success) {
      const msg = "Validación fallida. Revisa los requisitos de contraseña.";
      await logErrorAudit(msg);
      return { success: false, error: msg };
    }

    // 3. Get Current User Password
    const userQuery = await pool.request()
      .input("email", email_usuario)
      .query(`
        SELECT id_usuario, password_hash
        FROM dbo.Seguridad_Usuarios
        WHERE email = @email AND esta_activo = 1
      `);

    const user = userQuery.recordset[0];
    if (!user) {
      const msg = "Usuario no encontrado o inactivo.";
      await logErrorAudit(msg);
      return { success: false, error: msg };
    }

    // 4. Compare Passwords
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      const msg = "La contraseña actual es incorrecta.";
      await logErrorAudit(msg);
      return { success: false, error: msg };
    }

    // 5. Hash new password & update
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // Transacción para asegurar la consistencia entre update de usuario y auditoría exitosa
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      await transaction.request()
        .input("password_hash", newPasswordHash)
        .input("id_usuario", user.id_usuario)
        .query(`
          UPDATE dbo.Seguridad_Usuarios
          SET password_hash = @password_hash,
              fecha_modificacion = GETDATE(),
              usuario_modificacion = @id_usuario
          WHERE id_usuario = @id_usuario
        `);

      await transaction.request()
        .input("id_usuario", user.id_usuario)
        .input("email_usuario", email_usuario)
        .input("accion", "CAMBIO_PASSWORD")
        .input("tabla_afectada", "Seguridad_Usuarios")
        .input("registro_id", user.id_usuario)
        .input("valores_anteriores", "[HASH_ACTUAL_PROTEGIDO]")
        .input("valores_nuevos", "[NUEVO_HASH_GENERADO]")
        .input("resultado", "EXITOSO")
        .input("ip_origen", ip_origen)
        .query(`
          INSERT INTO dbo.Seguridad_Auditoria (
            id_usuario, email_usuario, accion, tabla_afectada, registro_id,
            valores_anteriores, valores_nuevos, resultado, ip_origen, fecha_accion
          )
          VALUES (
            @id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id,
            @valores_anteriores, @valores_nuevos, @resultado, @ip_origen, GETDATE()
          )
        `);

      await transaction.commit();
      return { success: true };
    } catch (e: any) {
      await transaction.rollback();
      throw e; // Lanzamos para que lo capture el catch principal y audite el error SQL
    }
  } catch (error: any) {
    console.error("[ERROR][change-password]", error);
    const msg = "Ha ocurrido un error inesperado al cambiar la contraseña.";
    
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id && session?.user?.email) {
        const pool = await getConnection();
        const headersList = await headers();
        const ip_origen = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "Desconocida";

        await pool.request()
          .input("id_usuario", session.user.id)
          .input("email_usuario", session.user.email)
          .input("accion", "CAMBIO_PASSWORD")
          .input("tabla_afectada", "Seguridad_Usuarios")
          .input("registro_id", session.user.id)
          .input("valores_anteriores", "[HASH_ACTUAL_PROTEGIDO]")
          .input("resultado", "ERROR")
          .input("mensaje_error", error.message || msg)
          .input("ip_origen", ip_origen)
          .query(`
            INSERT INTO dbo.Seguridad_Auditoria (
              id_usuario, email_usuario, accion, tabla_afectada, registro_id,
              valores_anteriores, resultado, mensaje_error, ip_origen, fecha_accion
            ) VALUES (
              @id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id,
              @valores_anteriores, @resultado, @mensaje_error, @ip_origen, GETDATE()
            )
          `);
      }
    } catch (e2) {
      console.error("[ERROR][change-password] auditoría crítica", e2);
    }

    return { success: false, error: msg };
  }
}

export async function verifyCurrentPassword(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const currentPassword = formData.get("currentPassword") as string;
    if (!currentPassword) {
      return { success: false, error: "La contraseña actual es requerida." };
    }

    const pool = await getConnection();
    const id_usuario = session.user.id;
    const email_usuario = session.user.email;
    const headersList = await headers();
    const ip_origen = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "Desconocida";

    const userQuery = await pool.request()
      .input("email", email_usuario)
      .query(`
        SELECT id_usuario, password_hash
        FROM dbo.Seguridad_Usuarios
        WHERE email = @email AND esta_activo = 1
      `);

    const user = userQuery.recordset[0];
    if (!user) {
      return { success: false, error: "Usuario no encontrado o inactivo." };
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isPasswordValid) {
      // Auditoría de intento fallido (obligatoria)
      try {
        await pool.request()
          .input("id_usuario", id_usuario)
          .input("email_usuario", email_usuario)
          .input("accion", "INTENTO_CAMBIO_PASSWORD_FALLIDO")
          .input("tabla_afectada", "Seguridad_Usuarios")
          .input("registro_id", id_usuario)
          .input("resultado", "ERROR")
          .input("mensaje_error", "Contraseña actual incorrecta")
          .input("ip_origen", ip_origen)
          .query(`
            INSERT INTO dbo.Seguridad_Auditoria (
              id_usuario, email_usuario, accion, tabla_afectada, registro_id,
              resultado, mensaje_error, ip_origen, fecha_accion
            ) VALUES (
              @id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id,
              @resultado, @mensaje_error, @ip_origen, GETDATE()
            )
          `);
      } catch (err) {
        console.error("[ERROR][change-password] auditoría de intento", err);
      }
      return { success: false, error: "La contraseña actual es incorrecta." };
    }

    return { success: true };
  } catch (error) {
    console.error("[ERROR][change-password] verificación", error);
    return { success: false, error: "Error interno al verificar la contraseña." };
  }
}
