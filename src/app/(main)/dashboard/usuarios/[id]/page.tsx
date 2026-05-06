import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUsuarioDetalle } from "../_actions/get-usuario-detalle";
import { getRoles } from "../_actions/get-roles";
import { getSucursalesParaSelector } from "../_actions/get-sucursales";
import { UsuarioDetalleClient } from "../_components/usuario-detalle-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UsuarioDetallePage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user.nivel ?? 99) > 2) redirect("/dashboard/usuarios");

  const { id } = await params;
  const idUsuario = parseInt(id, 10);
  if (isNaN(idUsuario)) notFound();

  const [usuarioResult, rolesResult, sucursalesResult] = await Promise.all([
    getUsuarioDetalle(idUsuario),
    getRoles(),
    getSucursalesParaSelector(),
  ]);

  if (!usuarioResult.success || !usuarioResult.data) notFound();

  return (
    <UsuarioDetalleClient
      usuario={usuarioResult.data}
      roles={rolesResult.data}
      todasSucursales={sucursalesResult.data}
      currentUserId={Number(session.user.id)}
    />
  );
}
