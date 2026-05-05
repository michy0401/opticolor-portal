import { getConnection } from "@/lib/db";
import SucursalesClient from "./_components/sucursales-client";

export type Sucursal = {
  id_sucursal: number;
  nombre_sucursal: string;
  alias_sucursal: string | null;
  municipio_raw: string | null;
  localidad_raw: string | null;
  direccion_raw: string | null;
  fecha_carga_etl: Date | null;
  total_usuarios: number;
};

async function getSucursales(): Promise<Sucursal[]> {
  const pool = await getConnection();
  const result = await pool.request().query(`
    SELECT 
      ms.id_sucursal, 
      ms.nombre_sucursal, 
      ms.alias_sucursal, 
      ms.municipio_raw, 
      ms.localidad_raw, 
      ms.direccion_raw, 
      ms.fecha_carga_etl,
      (SELECT COUNT(*) 
       FROM dbo.Seguridad_Usuarios_Sucursales us 
       WHERE us.id_sucursal = ms.id_sucursal AND us.esta_vigente = 1) as total_usuarios
    FROM dbo.Maestro_Sucursales ms
  `);
  return result.recordset;
}

export default async function SucursalesPage() {
  const sucursales = await getSucursales();

  return (
    <div className="flex h-full w-full flex-col p-6 gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestión de Sucursales</h1>

      </div>
      <SucursalesClient data={sucursales} />
    </div>
  );
}
