"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Search, UserPlus, Eye, Pencil, UserCheck, UserX, ShieldCheck, ShieldAlert,
} from "lucide-react";

import { type UsuarioRow } from "../_actions/get-usuarios";
import { type Rol } from "../_actions/get-roles";
import { type SucursalOption } from "../_actions/get-sucursales";
import { toggleEstadoUsuario } from "../_actions/toggle-estado-usuario";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { UsuarioFormModal } from "./usuario-form-modal";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function nivelColor(nivel: number | null) {
  if (nivel === 1 || nivel === 2) return "bg-primary/15 text-primary border-primary/30";
  if (nivel === 3) return "bg-secondary/20 text-secondary-foreground border-secondary/50";
  return "bg-muted text-muted-foreground border-border";
}

interface Props {
  data: UsuarioRow[];
  roles: Rol[];
  sucursales: SucursalOption[];
  currentUserId: number;
}

export default function UsuariosClient({ data, roles, sucursales, currentUserId }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>(data);
  const [openCreate, setOpenCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<UsuarioRow | null>(null);
  const [toggleTarget, setToggleTarget] = useState<UsuarioRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nombre_completo.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.nombre_rol ?? "").toLowerCase().includes(q)
    );
  }, [searchTerm, usuarios]);

  function handleToggleConfirm() {
    if (!toggleTarget) return;
    const nuevoEstado = !toggleTarget.esta_activo;
    startTransition(async () => {
      const res = await toggleEstadoUsuario(toggleTarget.id_usuario, nuevoEstado);
      if (res.success) {
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id_usuario === toggleTarget.id_usuario ? { ...u, esta_activo: nuevoEstado } : u
          )
        );
        toast.success(
          nuevoEstado ? "Usuario activado correctamente." : "Usuario desactivado correctamente."
        );
      } else {
        toast.error(res.error ?? "Error al cambiar el estado.");
      }
      setToggleTarget(null);
    });
  }

  function handleSaved(updated?: UsuarioRow) {
    // Refrescar recargando la página (simple y seguro con Server Components)
    window.location.reload();
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        {/* Barra de herramientas */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre, email o rol..."
              className="pl-9 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={() => setOpenCreate(true)} className="gap-2 shrink-0">
            <UserPlus className="h-4 w-4" />
            Nuevo Usuario
          </Button>
        </div>

        {/* Tabla */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold w-[280px]">Usuario</TableHead>
                <TableHead className="font-semibold">Rol</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
                <TableHead className="font-semibold">Última Sesión</TableHead>
                <TableHead className="text-right font-semibold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-6 w-6 opacity-40" />
                      <span>No se encontraron usuarios.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((usuario) => (
                  <TableRow
                    key={usuario.id_usuario}
                    className="group transition-colors"
                  >
                    {/* Usuario */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-border shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(usuario.nombre_completo)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm truncate">
                            {usuario.nombre_completo}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {usuario.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Rol */}
                    <TableCell>
                      {usuario.nombre_rol ? (
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium ${nivelColor(usuario.nivel_jerarquico)}`}
                        >
                          {usuario.nivel_jerarquico === 1 || usuario.nivel_jerarquico === 2 ? (
                            <ShieldCheck className="h-3 w-3 mr-1" />
                          ) : (
                            <ShieldAlert className="h-3 w-3 mr-1" />
                          )}
                          {usuario.nombre_rol}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin rol</span>
                      )}
                    </TableCell>

                    {/* Estado */}
                    <TableCell>
                      <Badge
                        variant={usuario.esta_activo ? "default" : "secondary"}
                        className={
                          usuario.esta_activo
                            ? "bg-primary/10 text-primary border-primary/20 border"
                            : "bg-destructive/10 text-destructive border-destructive/20 border"
                        }
                      >
                        <span
                          className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${usuario.esta_activo ? "bg-primary" : "bg-destructive"
                            }`}
                        />
                        {usuario.esta_activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>

                    {/* Última sesión */}
                    <TableCell className="text-sm text-muted-foreground">
                      {usuario.ultima_sesion
                        ? formatDistanceToNow(new Date(usuario.ultima_sesion), {
                          addSuffix: true,
                          locale: es,
                        })
                        : "Nunca"}
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                              <Link href={`/dashboard/usuarios/${usuario.id_usuario}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver detalle</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditTarget(usuario)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${usuario.esta_activo
                                  ? "text-destructive hover:text-destructive hover:bg-destructive/10"
                                  : "text-primary hover:text-primary hover:bg-primary/10"
                                }`}
                              onClick={() => setToggleTarget(usuario)}
                              disabled={isPending}
                            >
                              {usuario.esta_activo ? (
                                <UserX className="h-4 w-4" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {usuario.esta_activo ? "Desactivar usuario" : "Activar usuario"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Stat footer */}
        <p className="text-xs text-muted-foreground text-right">
          {filtered.length} de {usuarios.length} usuarios
        </p>
      </div>

      {/* Modal crear */}
      <UsuarioFormModal
        open={openCreate}
        onOpenChange={setOpenCreate}
        roles={roles}
        sucursales={sucursales}
        onSaved={handleSaved}
        currentUserId={currentUserId}
      />

      {/* Modal editar */}
      {editTarget && (
        <UsuarioFormModal
          open={!!editTarget}
          onOpenChange={(open: boolean) => !open && setEditTarget(null)}
          usuario={editTarget}
          roles={roles}
          sucursales={sucursales}
          onSaved={handleSaved}
          currentUserId={currentUserId}
        />
      )}

      {/* Confirm toggle */}
      <AlertDialog open={!!toggleTarget} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.esta_activo ? "¿Desactivar usuario?" : "¿Activar usuario?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.esta_activo
                ? `El usuario "${toggleTarget?.nombre_completo}" no podrá iniciar sesión hasta que sea reactivado.`
                : `El usuario "${toggleTarget?.nombre_completo}" podrá iniciar sesión nuevamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleConfirm}
              className={toggleTarget?.esta_activo ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {toggleTarget?.esta_activo ? "Sí, desactivar" : "Sí, activar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
