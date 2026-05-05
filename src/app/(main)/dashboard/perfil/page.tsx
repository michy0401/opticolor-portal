import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, History, Key, MapPin, Shield, ShieldAlert, ShieldCheck } from "lucide-react";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getConnection } from "@/lib/db";
import { getInitials } from "@/lib/utils";
import { ChangePasswordModal } from "./_components/change-password-modal";

export default async function PerfilPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const pool = await getConnection();
  const email = session.user.email;

  // 1. Obtener información del usuario, rol y jerarquía
  const userQuery = await pool
    .request()
    .input("email", email)
    .query(
      `
      SELECT 
        u.id_usuario, 
        u.nombre_completo, 
        u.email, 
        u.ultima_sesion, 
        u.fecha_creacion,
        r.nombre_rol, 
        r.nivel_jerarquico
      FROM dbo.Seguridad_Usuarios u
      LEFT JOIN dbo.Seguridad_Usuarios_Roles ur ON u.id_usuario = ur.id_usuario AND ur.esta_vigente = 1
      LEFT JOIN dbo.Seguridad_Roles r ON ur.id_rol = r.id_rol
      WHERE u.email = @email AND u.esta_activo = 1
    `,
    );

  const user = userQuery.recordset[0];

  if (!user) {
    redirect("/login");
  }

  // 2. Traer sucursales asignadas
  const sucursalesQuery = await pool
    .request()
    .input("id_usuario", user.id_usuario)
    .query(
      `
      SELECT ms.nombre_sucursal
      FROM dbo.Seguridad_Usuarios_Sucursales us
      INNER JOIN dbo.Maestro_Sucursales ms ON us.id_sucursal = ms.id_sucursal
      WHERE us.id_usuario = @id_usuario AND us.esta_vigente = 1
    `,
    );

  const sucursales = sucursalesQuery.recordset;

  // 3. Traer últimos 5 registros de auditoría
  const auditQuery = await pool
    .request()
    .input("id_usuario", user.id_usuario)
    .query(
      `
      SELECT TOP 5 accion, fecha_accion, ip_origen
      FROM dbo.Seguridad_Auditoria
      WHERE id_usuario = @id_usuario
      ORDER BY fecha_accion DESC
    `,
    );

  const auditoria = auditQuery.recordset;

  const formatDate = (date: Date | string) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return format(d, "dd 'de' MMMM, yyyy - HH:mm", { locale: es });
  };

  const isAccessTotal = user.nivel_jerarquico === 1 || user.nivel_jerarquico === 2;
  const isSupervisor = user.nivel_jerarquico === 4;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Identidad */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 md:flex-row">
            <Avatar className="h-24 w-24 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                {getInitials(user.nombre_completo || "U")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-center gap-1 md:items-start">
              <h2 className="text-2xl font-semibold">{user.nombre_completo}</h2>
              <p className="text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={isAccessTotal ? "default" : "secondary"}>{user.nombre_rol || "USUARIO"}</Badge>
                {isAccessTotal && (
                  <Badge variant="outline" className="gap-1 border-green-500 text-green-600 dark:text-green-400">
                    <ShieldCheck className="h-3 w-3" /> Acceso Total
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seguridad */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" /> Última Sesión
              </span>
              <span className="text-sm">{formatDate(user.ultima_sesion)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" /> Miembro desde
              </span>
              <span className="text-sm">{formatDate(user.fecha_creacion)}</span>
            </div>
          </CardContent>
          <CardFooter>
            <ChangePasswordModal />
          </CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Organización / Sucursales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Sucursales Asignadas
            </CardTitle>
            <CardDescription>Ubicaciones a las que tienes acceso.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sucursales.length > 0 ? (
                sucursales.map((s, idx) => (
                  <Badge key={idx} variant="secondary" className="px-3 py-1 text-sm font-normal">
                    {s.nombre_sucursal}
                  </Badge>
                ))
              ) : (
                <div className="flex w-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
                  <MapPin className="mb-2 h-8 w-8 opacity-20" />
                  <p className="text-sm">Sin sucursales asignadas.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actividad / Auditoría */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Actividad Reciente
            </CardTitle>
            <CardDescription>Tus últimos 5 movimientos registrados.</CardDescription>
          </CardHeader>
          <CardContent>
            {auditoria.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Acción</TableHead>
                    <TableHead className="text-right">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditoria.map((log, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{log.accion}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDate(log.fecha_accion)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <History className="mb-2 h-8 w-8 opacity-20" />
                <p className="text-sm">No hay registros de actividad.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
