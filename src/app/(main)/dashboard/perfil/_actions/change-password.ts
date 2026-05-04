"use server";

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getConnection } from "@/lib/db";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida."),
  newPassword: z.string()
    .min(8, "Mínimo 8 caracteres.")
    .regex(/[A-Za-z]/, "Debe contener al menos una letra.")
    .regex(/[0-9]/, "Debe contener al menos un número.")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial."),
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
      return { success: false, error: "Validación fallida. Revisa los requisitos de contraseña." };
    }

    const pool = await getConnection();

    // 3. Get Current User Password
    const userQuery = await pool.request()
      .input("email", session.user.email)
      .query(`
        SELECT id_usuario, password_hash
        FROM dbo.Seguridad_Usuarios
        WHERE email = @email AND esta_activo = 1
      `);

    const user = userQuery.recordset[0];
    if (!user) {
      return { success: false, error: "Usuario no encontrado o inactivo." };
    }

    // 4. Compare Passwords
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return { success: false, error: "La contraseña actual es incorrecta." };
    }

    // 5. Hash new password & update
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // Transacción para asegurar la consistencia entre update de usuario y auditoría
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      await transaction.request()
        .input("password_hash", newPasswordHash)
        .input("id_usuario", user.id_usuario)
        .query(`
          UPDATE dbo.Seguridad_Usuarios
          SET password_hash = @password_hash
          WHERE id_usuario = @id_usuario
        `);

      await transaction.request()
        .input("id_usuario", user.id_usuario)
        .input("accion", "CAMBIO_PASSWORD")
        .input("ip_origen", "N/A") // In a real app we might get the IP from headers
        .query(`
          INSERT INTO dbo.Seguridad_Auditoria (id_usuario, accion, fecha_accion, ip_origen)
          VALUES (@id_usuario, @accion, GETDATE(), @ip_origen)
        `);

      await transaction.commit();
      return { success: true };
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  } catch (error: any) {
    console.error("Error changing password:", error);
    return { success: false, error: "Ha ocurrido un error al cambiar la contraseña." };
  }
}
