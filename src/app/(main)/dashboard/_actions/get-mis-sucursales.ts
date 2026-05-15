"use server";

import { unstable_cache } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getConnection } from "@/lib/db";

export type MiSucursal = {
  id_sucursal: number;
  nombre_sucursal: string;
};

// ─── Cache interno — slot independiente por userId ────────────────────────────
// Next.js construye la clave efectiva como ['sucursales-list', userId],
// garantizando aislamiento total entre usuarios.
// Se invalida con revalidateTag('sucursales-list').
const fetchMisSucursales = unstable_cache(
  async (userId: string): Promise<MiSucursal[]> => {
    const pool = await getConnection();
    const result = await pool
      .request()
      .input("id_usuario", userId)
      .query(`
        SELECT ms.id_sucursal, ms.nombre_sucursal
        FROM dbo.Seguridad_Usuarios_Sucursales sus
        INNER JOIN dbo.Maestro_Sucursales ms ON sus.id_sucursal = ms.id_sucursal
        WHERE sus.id_usuario = @id_usuario AND sus.esta_vigente = 1
        ORDER BY ms.nombre_sucursal ASC
      `);
    return result.recordset as MiSucursal[];
  },
  ["sucursales-list"],
  { revalidate: 3600, tags: ["sucursales-list"] },
);

// ─── Acción principal ─────────────────────────────────────────────────────────
// La sesión se resuelve fuera del cache: getServerSession usa cookies/headers
// dinámicos que no pueden ejecutarse dentro de unstable_cache.
export async function getMisSucursales(): Promise<{
  success: boolean;
  data: MiSucursal[];
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, data: [] };

  try {
    const data = await fetchMisSucursales(session.user.id);
    return { success: true, data };
  } catch {
    return { success: false, data: [] };
  }
}
