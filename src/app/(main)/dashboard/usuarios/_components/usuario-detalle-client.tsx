"use client";

import { useState, useTransition, useRef, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft, Shield, History, MapPin, Clock, ShieldCheck, ShieldAlert,
  Cpu, FileText, Trash2, Loader2, Lock, Plus, Search, X, Check,
} from "lucide-react";
import Link from "next/link";

import { type UsuarioDetalle, type AuditoriaRow } from "../_actions/get-usuario-detalle";
import { type Rol } from "../_actions/get-roles";
import { type SucursalOption } from "../_actions/get-sucursales";
import { cambiarRol } from "../_actions/cambiar-rol";
import { revocarSucursal } from "../_actions/revocar-sucursal";
import { asignarSucursal } from "../_actions/asignar-sucursal";
import { AuditDetailDialog } from "./audit-detail-dialog";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function nivelColor(nivel: number | null) {
  if (nivel === 1) return "bg-primary/15 text-primary border-primary/30";
  if (nivel === 2) return "bg-secondary/20 text-secondary-foreground border-secondary/50";
  return "bg-muted text-muted-foreground border-border";
}

function accionColor(accion: string) {
  if (accion.includes("CREAR") || accion.includes("ASIGNAR")) return "bg-primary/15 text-primary border-primary/30";
  if (accion.includes("EDITAR") || accion.includes("CAMBIAR")) return "bg-secondary/20 text-secondary-foreground border-secondary/50";
  if (accion.includes("DESACTIVAR") || accion.includes("REVOCAR") || accion.includes("ELIMINAR"))
    return "bg-destructive/15 text-destructive border-destructive/30";
  if (accion === "LOGIN") return "bg-muted text-muted-foreground border-border";
  return "bg-secondary/15 text-secondary-foreground border-border";
}

// ─── AsignarSucursalPopover ───────────────────────────────────────────────────
interface AsignarProps {
  todasSucursales: SucursalOption[];
  asignadasIds: Set<number>;
  onAsignar: (sucursal: SucursalOption) => Promise<void>;
  isPending: boolean;
}

function AsignarSucursalPopover({ todasSucursales, asignadasIds, onAsignar, isPending }: AsignarProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [asignando, setAsignando] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const disponibles = useMemo(() =>
    todasSucursales.filter((s) => !asignadasIds.has(s.id_sucursal)),
    [todasSucursales, asignadasIds]
  );

  const filtradas = useMemo(() => {
    if (!q.trim()) return disponibles;
    const lower = q.toLowerCase();
    return disponibles.filter(
      (s) =>
        s.nombre_sucursal.toLowerCase().includes(lower) ||
        (s.alias_sucursal ?? "").toLowerCase().includes(lower)
    );
  }, [q, disponibles]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQ("");
  }, [open]);

  async function handleSelect(s: SucursalOption) {
    setAsignando(s.id_sucursal);
    await onAsignar(s);
    setAsignando(null);
    if (filtradas.length === 1) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-7 text-xs"
          disabled={isPending || disponibles.length === 0}
        >
          <Plus className="h-3 w-3" />
          Asignar sucursal
          {disponibles.length > 0 && (
            <span className="ml-1 text-muted-foreground">({disponibles.length})</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end" sideOffset={6}>
        {/* Buscador */}
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar sucursal…"
            className="flex-1 py-2.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="opacity-50 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Contador */}
        <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/30 border-b">
          {filtradas.length} de {disponibles.length} disponibles
        </div>

        {/* Lista — onWheel stopPropagation evita que Radix capture el evento y bloquee el scroll con rueda del ratón */}
        <div
          className="max-h-56 overflow-y-auto overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >
          {filtradas.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-6 text-sm text-muted-foreground">
              <Search className="h-4 w-4 opacity-40" />
              Sin resultados
            </div>
          ) : (
            filtradas.map((s) => (
              <button
                key={s.id_sucursal}
                type="button"
                disabled={asignando === s.id_sucursal || isPending}
                onClick={() => handleSelect(s)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                  "hover:bg-accent transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {asignando === s.id_sucursal ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate flex-1">{s.nombre_sucursal}</span>
                {s.alias_sucursal && (
                  <span className="text-xs text-muted-foreground shrink-0">{s.alias_sucursal}</span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  usuario: UsuarioDetalle;
  roles: Rol[];
  todasSucursales: SucursalOption[];
  currentUserId: number;
}

export function UsuarioDetalleClient({ usuario, roles, todasSucursales, currentUserId }: Props) {
  const router = useRouter();
  const [data, setData] = useState(usuario);
  const [isPending, startTransition] = useTransition();
  const [selectedRol, setSelectedRol] = useState<string>(
    data.id_rol ? String(data.id_rol) : ""
  );
  const [revocandoSucursal, setRevocandoSucursal] = useState<{
    id_relacion: number;
    id_sucursal: number;
    nombre: string;
  } | null>(null);
  const [auditDetalle, setAuditDetalle] = useState<AuditoriaRow | null>(null);

  // Bloqueo de auto-modificación de rol: un usuario no puede cambiar su propio rol
  const esAutoEdicion = currentUserId === data.id_usuario;

  // IDs ya asignados (para excluirlos del popover)
  const asignadasIds = useMemo(
    () => new Set(data.sucursales.map((s) => s.id_sucursal)),
    [data.sucursales]
  );

  // ── Cambiar rol ─────────────────────────────────────────────────────────────
  function handleCambiarRol() {
    if (!selectedRol || Number(selectedRol) === data.id_rol || esAutoEdicion) return;
    startTransition(async () => {
      const res = await cambiarRol(data.id_usuario, Number(selectedRol));
      if (res.success) {
        const nuevoRol = roles.find((r) => r.id_rol === Number(selectedRol));
        setData((prev) => ({
          ...prev,
          id_rol: Number(selectedRol),
          nombre_rol: nuevoRol?.nombre_rol ?? prev.nombre_rol,
          nivel_jerarquico: nuevoRol?.nivel_jerarquico ?? prev.nivel_jerarquico,
        }));
        toast.success("Rol actualizado correctamente.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Error al cambiar el rol.");
      }
    });
  }

  // ── Revocar sucursal ────────────────────────────────────────────────────────
  function handleRevocarConfirm() {
    if (!revocandoSucursal) return;
    startTransition(async () => {
      const res = await revocarSucursal(
        data.id_usuario,
        revocandoSucursal.id_sucursal,
        revocandoSucursal.nombre
      );
      if (res.success) {
        setData((prev) => ({
          ...prev,
          sucursales: prev.sucursales.filter(
            (s) => s.id_sucursal !== revocandoSucursal.id_sucursal
          ),
        }));
        toast.success(`Acceso a "${revocandoSucursal.nombre}" revocado.`);
      } else {
        toast.error(res.error ?? "Error al revocar la sucursal.");
      }
      setRevocandoSucursal(null);
    });
  }

  // ── Asignar sucursal ────────────────────────────────────────────────────────
  const handleAsignar = useCallback(async (sucursal: SucursalOption) => {
    const res = await asignarSucursal(data.id_usuario, sucursal.id_sucursal, sucursal.nombre_sucursal);
    if (res.success) {
      setData((prev) => ({
        ...prev,
        sucursales: [
          ...prev.sucursales,
          { id_relacion: sucursal.id_sucursal, id_sucursal: sucursal.id_sucursal, nombre_sucursal: sucursal.nombre_sucursal },
        ].sort((a, b) => a.nombre_sucursal.localeCompare(b.nombre_sucursal)),
      }));
      toast.success(`Acceso a "${sucursal.nombre_sucursal}" asignado.`);
    } else {
      toast.error(res.error ?? "Error al asignar la sucursal.");
    }
  }, [data.id_usuario]);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/dashboard/usuarios">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.nombre_completo}</h1>
            <p className="text-sm text-muted-foreground">{data.email}</p>
          </div>
        </div>

        {/* ── Grid principal ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ── Información de Cuenta + Rol (col-span-2) ── */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-4 w-4 text-primary" />
                Información de Cuenta
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">

              {/* Avatar + badges */}
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-primary/20 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                    {getInitials(data.nombre_completo)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2 items-center">
                  {data.nombre_rol && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${nivelColor(data.nivel_jerarquico)}`}
                    >
                      {(data.nivel_jerarquico ?? 99) <= 2
                        ? <ShieldCheck className="h-3 w-3 mr-1" />
                        : <ShieldAlert className="h-3 w-3 mr-1" />
                      }
                      {data.nombre_rol}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={
                      data.esta_activo
                        ? "bg-primary/10 text-primary border-primary/20 text-xs"
                        : "bg-destructive/10 text-destructive border-destructive/20 text-xs"
                    }
                  >
                    <span
                      className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${
                        data.esta_activo ? "bg-primary" : "bg-destructive"
                      }`}
                    />
                    {data.esta_activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </div>

              {/* Metadatos */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Clock className="h-3 w-3" /> Última Sesión
                  </span>
                  <span>
                    {data.ultima_sesion
                      ? formatDistanceToNow(new Date(data.ultima_sesion), { addSuffix: true, locale: es })
                      : "Nunca"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Clock className="h-3 w-3" /> Miembro desde
                  </span>
                  <span>
                    {data.fecha_creacion
                      ? format(new Date(data.fecha_creacion), "dd 'de' MMMM, yyyy", { locale: es })
                      : "N/A"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Clock className="h-3 w-3" /> Creado por
                  </span>
                  <span className="truncate" title={data.usuario_creacion ?? undefined}>
                    {data.usuario_creacion ?? "N/A"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Clock className="h-3 w-3" /> Última modificación
                  </span>
                  <span>
                    {data.fecha_modificacion
                      ? format(new Date(data.fecha_modificacion), "dd 'de' MMMM, yyyy", { locale: es })
                      : "Sin modificaciones"}
                  </span>
                  {data.usuario_modificacion && (
                    <span className="text-xs text-muted-foreground truncate" title={data.usuario_modificacion}>
                      por {data.usuario_modificacion}
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Selector de Rol integrado */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Shield className="h-3 w-3" /> Rol Activo
                  </span>
                  {esAutoEdicion && (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <Lock className="h-3 w-3" />
                      No puedes cambiar tu propio rol
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Select value={selectedRol} onValueChange={setSelectedRol} disabled={esAutoEdicion}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar rol…" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id_rol} value={String(r.id_rol)}>
                          {r.nombre_rol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleCambiarRol}
                    disabled={isPending || esAutoEdicion || !selectedRol || Number(selectedRol) === data.id_rol}
                    className="shrink-0 gap-1.5"
                  >
                    {isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Shield className="h-3.5 w-3.5" />
                    }
                    Aplicar
                  </Button>
                </div>
                {esAutoEdicion && (
                  <p className="text-xs text-muted-foreground">
                    No puedes modificar tu propio rol de acceso. Pide a otro administrador que lo haga.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Sucursales (columna derecha) ── */}
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Sucursales Asignadas
              </CardTitle>
              <CardDescription className="mt-0.5">
                {data.sucursales.length} sede(s) con acceso vigente.
              </CardDescription>
              {/* Botón asignar — debajo del contador */}
              <div className="pt-1">
                <AsignarSucursalPopover
                  todasSucursales={todasSucursales}
                  asignadasIds={asignadasIds}
                  onAsignar={handleAsignar}
                  isPending={isPending}
                />
              </div>
            </CardHeader>
            <CardContent>
              {data.sucursales.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
                  <MapPin className="h-6 w-6 opacity-30" />
                  <p className="text-xs">Sin sucursales asignadas.</p>
                  <p className="text-xs opacity-70">Usa el botón de arriba para asignar.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1 max-h-72 overflow-y-auto overscroll-contain pr-1">
                  {data.sucursales.map((s) => (
                    <div
                      key={s.id_sucursal}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group transition-colors"
                    >
                      <span className="text-sm truncate flex-1">{s.nombre_sucursal}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() =>
                              setRevocandoSucursal({
                                id_relacion: s.id_relacion,
                                id_sucursal: s.id_sucursal,
                                nombre: s.nombre_sucursal,
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Revocar acceso</TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Timeline de Auditoría ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Timeline de Auditoría
            </CardTitle>
            <CardDescription>
              Últimos {data.auditoria.length} registros de actividad de este usuario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.auditoria.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <History className="h-8 w-8 opacity-20" />
                <p className="text-sm">No hay registros de auditoría.</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold">Acción</TableHead>
                      <TableHead className="font-semibold">Tabla</TableHead>
                      <TableHead className="font-semibold">IP Origen</TableHead>
                      <TableHead className="font-semibold">Resultado</TableHead>
                      <TableHead className="font-semibold">Fecha</TableHead>
                      <TableHead className="text-right font-semibold">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.auditoria.map((log) => (
                      <TableRow key={log.id_auditoria} className="group">
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs font-mono ${accionColor(log.accion)}`}
                          >
                            {log.accion}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {log.tabla_afectada ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {log.ip_origen ?? "—"}
                        </TableCell>
                        <TableCell>
                          {log.resultado ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                log.resultado === "EXITOSO"
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                              }`}
                            >
                              {log.resultado}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.fecha_accion), "dd MMM yyyy, HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setAuditDetalle(log)}
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver cambios</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dialogs ── */}
      <AlertDialog
        open={!!revocandoSucursal}
        onOpenChange={(open) => !open && setRevocandoSucursal(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar acceso a sucursal?</AlertDialogTitle>
            <AlertDialogDescription>
              Se revocará el acceso de <strong>{data.nombre_completo}</strong> a{" "}
              <strong>{revocandoSucursal?.nombre}</strong>. Esta acción se puede revertir
              editando el usuario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevocarConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, revocar acceso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AuditDetailDialog
        open={!!auditDetalle}
        onOpenChange={(open) => !open && setAuditDetalle(null)}
        registro={auditDetalle}
      />
    </TooltipProvider>
  );
}
