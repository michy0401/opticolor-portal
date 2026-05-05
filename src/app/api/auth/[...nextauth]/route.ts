import { getConnection } from "@/lib/db";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Por favor, ingresa tu correo y contraseña.");
        }

        try {
          const pool = await getConnection();

          // Buscar el usuario por email
          const userResult = await pool.request()
            .input("email", credentials.email)
            .query(`
              SELECT 
                u.id_usuario, 
                u.nombre_completo, 
                u.email, 
                u.password_hash,
                r.nombre_rol,
                r.nivel_jerarquico
              FROM dbo.Seguridad_Usuarios u
              LEFT JOIN dbo.Seguridad_Usuarios_Roles ur ON u.id_usuario = ur.id_usuario
              LEFT JOIN dbo.Seguridad_Roles r ON ur.id_rol = r.id_rol
              WHERE u.email = @email
            `);

          const user = userResult.recordset[0];

          if (!user) {
            throw new Error("Usuario no encontrado.");
          }

          // Validar la contraseña usando bcryptjs
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);

          if (!isPasswordValid) {
            throw new Error("Contraseña incorrecta.");
          }

          // Retornar la información del usuario para la sesión
          return {
            id: user.id_usuario.toString(),
            name: user.nombre_completo,
            email: user.email,
            rol: user.nombre_rol || "USUARIO",
            nivel: user.nivel_jerarquico || 0,
          };
        } catch (error: any) {
          console.error("Error en autorización:", error);
          throw new Error(error.message || "Error al autenticar al usuario.");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
        token.nivel = user.nivel;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as string;
        session.user.nivel = token.nivel as number;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      try {
        const pool = await getConnection();
        
        // Acción A: Actualización de Usuario
        await pool.request()
          .input("id_usuario", user.id)
          .query(`
            UPDATE dbo.Seguridad_Usuarios 
            SET ultima_sesion = GETDATE() 
            WHERE id_usuario = @id_usuario
          `);

        // Obtener IP
        const headersList = await headers();
        const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "Desconocida";

        // Acción B: Inserción en Auditoría
        await pool.request()
          .input("id_usuario", user.id)
          .input("email_usuario", user.email)
          .input("accion", "LOGIN")
          .input("tabla_afectada", "Seguridad_Usuarios")
          .input("registro_id", user.id)
          .input("resultado", "EXITOSO")
          .input("ip_origen", ip)
          .query(`
            INSERT INTO dbo.Seguridad_Auditoria (
              id_usuario, email_usuario, accion, tabla_afectada, registro_id, resultado, ip_origen, fecha_accion
            ) VALUES (
              @id_usuario, @email_usuario, @accion, @tabla_afectada, @registro_id, @resultado, @ip_origen, GETDATE()
            )
          `);
      } catch (error) {
        console.error("Error en evento signIn de auditoría:", error);
      }
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
