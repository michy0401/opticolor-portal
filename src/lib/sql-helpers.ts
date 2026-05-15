export function buildSucursalFilter(tableAlias = ""): string {
  const col = tableAlias ? `${tableAlias}.id_sucursal` : "id_sucursal";
  return `
    AND (
      (
        @isSupervisor = 1
        AND ${col} IN (
          SELECT id_sucursal
          FROM dbo.Seguridad_Usuarios_Sucursales
          WHERE id_usuario = @userId AND esta_vigente = 1
        )
      )
      OR (
        @isSupervisor = 0
        AND ${col} IN (
          SELECT id_sucursal
          FROM dbo.Seguridad_Usuarios_Sucursales
          WHERE id_usuario = @userId
            AND esta_vigente = 1
            AND (@sucursalId IS NULL OR id_sucursal = @sucursalId)
        )
      )
    )`;
}
