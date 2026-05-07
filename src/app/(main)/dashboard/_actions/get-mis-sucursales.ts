"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getConnection } from "@/lib/db";

export type MiSucursal = {
  id_sucursal: number;
  nombre_sucursal: string;
};

export async function getMisSucursales(): Promise<{
  success: boolean;
  data: MiSucursal[];
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, data: [] };

  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .input("id_usuario", session.user.id)
      .query(`
        SELECT ms.id_sucursal, ms.nombre_sucursal
        FROM dbo.Seguridad_Usuarios_Sucursales sus
        INNER JOIN dbo.Maestro_Sucursales ms ON sus.id_sucursal = ms.id_sucursal
        WHERE sus.id_usuario = @id_usuario AND sus.esta_vigente = 1
        ORDER BY ms.nombre_sucursal ASC
      `);
    return { success: true, data: result.recordset };
  } catch {
    return { success: false, data: [] };
  }
}
