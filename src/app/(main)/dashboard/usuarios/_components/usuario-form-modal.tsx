"use client";

import { useEffect, useState, useTransition, useRef, useCallback, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, ChevronsUpDown, X, Search, Loader2 } from "lucide-react";

import { type UsuarioRow } from "../_actions/get-usuarios";
import { type Rol } from "../_actions/get-roles";
import { type SucursalOption } from "../_actions/get-sucursales";
import { crearUsuario } from "../_actions/crear-usuario";
import { editarUsuario } from "../_actions/editar-usuario";
import { getDatosEdicion } from "../_actions/get-datos-edicion";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PasswordChecklist } from "@/components/password-checklist";

// ─── Schema ───────────────────────────────────────────────────────────────────
const baseSchema = z.object({
  nombre_completo: z.string().min(3, "Mínimo 3 caracteres."),
  email: z.string().email("Correo no válido."),
  id_rol: z.string(),                                   // puede estar vacío al editar Super Admin
  ids_sucursales: z.array(z.number()).optional().default([]),
});

const createSchema = baseSchema.extend({
  id_rol: z.string().min(1, "Selecciona un rol."),
  password: z.string()
    .min(8, "Mínimo 8 caracteres.")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula.")
    .regex(/[a-z]/, "Debe contener al menos una letra minúscula.")
    .regex(/[0-9]/, "Debe contener al menos un número.")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial (!@#$%^&*…)."),
  confirm_password: z.string().min(1, "Confirma la contraseña."),
}).refine((d) => d.password === d.confirm_password, {
  message: "Las contraseñas no coinciden.",
  path: ["confirm_password"],
});

const editSchema = baseSchema.extend({
  password: z.string()
    .refine((v) => !v || v.length >= 8,           "Mínimo 8 caracteres.")
    .refine((v) => !v || /[A-Z]/.test(v),         "Debe contener al menos una letra mayúscula.")
    .refine((v) => !v || /[a-z]/.test(v),         "Debe contener al menos una letra minúscula.")
    .refine((v) => !v || /[0-9]/.test(v),         "Debe contener al menos un número.")
    .refine((v) => !v || /[^A-Za-z0-9]/.test(v), "Debe contener al menos un carácter especial (!@#$%^&*…).")
    .optional(),
  confirm_password: z.string().optional(),
}).refine((d) => !d.password || d.password === d.confirm_password, {
  message: "Las contraseñas no coinciden.",
  path: ["confirm_password"],
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;
type AnyForm = CreateForm | EditForm;

// ─── FieldWrapper ─────────────────────────────────────────────────────────────
function FieldWrapper({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── VirtualizedSucursalesSelect ──────────────────────────────────────────────
// Soporta 100+ sucursales con búsqueda en-memoria y scroll nativo
// Nota: se usa div nativo con overflow-y-auto + max-h en lugar de Radix ScrollArea
// porque ScrollAreaPrimitive.Viewport usa size-full (height:100%) y requiere
// que el Root tenga altura explícita, no solo max-height.

interface VirtualizedProps {
  sucursales: SucursalOption[];
  value: number[];
  onChange: (ids: number[]) => void;
}

function VirtualizedSucursalesSelect({ sucursales, value, onChange }: VirtualizedProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!q.trim()) return sucursales;
    const lower = q.toLowerCase();
    return sucursales.filter(
      (s) =>
        s.nombre_sucursal.toLowerCase().includes(lower) ||
        (s.alias_sucursal ?? "").toLowerCase().includes(lower)
    );
  }, [q, sucursales]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const toggle = useCallback(
    (id: number) => {
      if (selectedSet.has(id)) {
        onChange(value.filter((v) => v !== id));
      } else {
        onChange([...value, id]);
      }
    },
    [selectedSet, value, onChange]
  );

  const removeOne = (id: number) => onChange(value.filter((v) => v !== id));
  const clearAll = () => onChange([]);

  const selectedLabels = useMemo(
    () =>
      value.map((id) => {
        const s = sucursales.find((x) => x.id_sucursal === id);
        return { id, label: s?.alias_sucursal || s?.nombre_sucursal || String(id) };
      }),
    [value, sucursales]
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-9 py-1.5 px-3 font-normal"
        >
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {value.length === 0 ? (
              <span className="text-muted-foreground text-sm">Seleccionar sucursales…</span>
            ) : value.length <= 3 ? (
              selectedLabels.map(({ id, label }) => (
                <Badge key={id} variant="secondary" className="text-xs gap-1 pr-1 max-w-[160px]">
                  <span className="truncate">{label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded-sm opacity-70 hover:opacity-100 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); removeOne(id); }}
                    onKeyDown={(e) => e.key === "Enter" && removeOne(id)}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            ) : (
              <Badge variant="secondary" className="text-xs">
                {value.length} sucursales seleccionadas
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                className="opacity-50 hover:opacity-100 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); clearAll(); }}
                onKeyDown={(e) => e.key === "Enter" && clearAll()}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        {/* Buscador interno */}
        <div className="flex items-center border-b px-3 gap-2">
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

        {/* Conteo y limpiar */}
        <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b bg-muted/30">
          <span>{filtered.length} resultados · {value.length} seleccionadas</span>
          {value.length > 0 && (
            <button type="button" onClick={clearAll} className="text-destructive hover:underline">
              Limpiar
            </button>
          )}
        </div>

        {/* Lista — onWheel stopPropagation evita que Radix bloquee el scroll con rueda */}
        <div
          className="max-h-64 overflow-y-auto overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-sm text-muted-foreground gap-1">
              <Search className="h-4 w-4 opacity-40" />
              Sin resultados para &ldquo;{q}&rdquo;
            </div>
          ) : (
            <div role="listbox" aria-multiselectable="true">
              {filtered.map((s) => {
                const isSelected = selectedSet.has(s.id_sucursal);
                return (
                  <div
                    key={s.id_sucursal}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none",
                      "hover:bg-accent transition-colors",
                      isSelected && "bg-accent/50"
                    )}
                    onClick={() => toggle(s.id_sucursal)}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-sm border shrink-0 flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate flex-1">{s.nombre_sucursal}</span>
                    {s.alias_sucursal && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {s.alias_sucursal}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario?: UsuarioRow;
  roles: Rol[];
  sucursales: SucursalOption[];
  onSaved: () => void;
  currentUserId?: number;
}

export function UsuarioFormModal({ open, onOpenChange, usuario, roles, sucursales, onSaved, currentUserId }: Props) {
  const isEdit = !!usuario;
  // Bloqueo de auto-modificación: un usuario no puede cambiar su propio rol
  // (aplica a cualquier nivel, incluyendo SUPER_ADMIN)
  const esAutoEdicion = isEdit && !!currentUserId && currentUserId === usuario?.id_usuario;
  const [isPending, startTransition] = useTransition();
  const [loadingEdit, setLoadingEdit] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<AnyForm>({
    resolver: zodResolver(isEdit ? editSchema : (createSchema as any)),
    defaultValues: {
      nombre_completo: "",
      email: "",
      password: "",
      confirm_password: "",
      id_rol: "",
      ids_sucursales: [],
    },
  });

  useEffect(() => {
    if (!open) return;

    if (!isEdit || !usuario) {
      // Modo crear: limpiar todo
      reset({
        nombre_completo: "",
        email: "",
        password: "",
        confirm_password: "",
        id_rol: "",
        ids_sucursales: [],
      });
      return;
    }

    // Modo editar: pre-poblar con los datos del usuario primero (sincrónico)
    reset({
      nombre_completo: usuario.nombre_completo,
      email: usuario.email,
      password: "",
      confirm_password: "",
      id_rol: "",          // se actualiza tras fetch
      ids_sucursales: [],  // se actualiza tras fetch
    });

    // Luego traer id_rol e ids_sucursales de la BD
    setLoadingEdit(true);
    getDatosEdicion(usuario.id_usuario).then((res) => {
      if (res.success && res.data) {
        reset({
          nombre_completo: usuario.nombre_completo,
          email: usuario.email,
          password: "",
          confirm_password: "",
          id_rol: res.data.id_rol ? String(res.data.id_rol) : "",
          ids_sucursales: res.data.ids_sucursales,
        });
      } else {
        toast.error("No se pudieron cargar los datos actuales del usuario.");
      }
      setLoadingEdit(false);
    });
  }, [open, usuario?.id_usuario]);

  function onSubmit(values: AnyForm) {
    startTransition(async () => {
      const payload = {
        ...(isEdit ? { id_usuario: usuario!.id_usuario } : {}),
        nombre_completo: values.nombre_completo,
        email: values.email,
        password: (values as any).password || undefined,
        // Cuando id_rol === 0 significa auto-edición con campo oculto: no modificar rol
        id_rol: esAutoEdicion ? 0 : Number(values.id_rol),
        ids_sucursales: values.ids_sucursales ?? [],
      };

      const res = isEdit ? await editarUsuario(payload) : await crearUsuario(payload);

      if (res.success) {
        toast.success(isEdit ? "Usuario actualizado correctamente." : "Usuario creado correctamente.");
        onOpenChange(false);
        onSaved();
      } else if (res.fieldErrors) {
        Object.entries(res.fieldErrors).forEach(([field, msgs]) => {
          setError(field as any, { message: (msgs as string[])[0] });
        });
      } else {
        toast.error(res.error ?? "Error desconocido.");
      }
    });
  }

  const passwordValue = (watch("password") as string) ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los datos. Deja la contraseña vacía para no cambiarla."
              : "Completa los datos para crear un nuevo usuario en el sistema."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pt-2">
          {loadingEdit ? (
            // Skeleton mientras se cargan los datos de la BD
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ) : (
            <>
              {/* Nombre */}
              <FieldWrapper label="Nombre Completo" error={errors.nombre_completo?.message}>
                <Input placeholder="Ej: María García" {...register("nombre_completo")} />
              </FieldWrapper>

              {/* Email */}
              <FieldWrapper label="Correo Electrónico" error={errors.email?.message}>
                <Input type="email" placeholder="correo@empresa.com" {...register("email")} />
              </FieldWrapper>

              {/* Passwords */}
              <div className="grid grid-cols-2 gap-3">
                <FieldWrapper
                  label={isEdit ? "Nueva Contraseña" : "Contraseña"}
                  error={(errors as any).password?.message}
                >
                  <Input
                    type="password"
                    placeholder={isEdit ? "Dejar vacío para no cambiar" : "Mín. 8 caracteres"}
                    {...register("password")}
                  />
                </FieldWrapper>
                <FieldWrapper
                  label="Confirmar Contraseña"
                  error={(errors as any).confirm_password?.message}
                >
                  <Input type="password" placeholder="Repetir contraseña" {...register("confirm_password")} />
                </FieldWrapper>
              </div>

              {/* Checklist de política de contraseña */}
              {passwordValue ? (
                <PasswordChecklist password={passwordValue} />
              ) : (
                <p className="text-xs text-muted-foreground -mt-1">
                  {isEdit
                    ? "Deja vacío para no cambiarla. Si escribes algo, debe cumplir la política de seguridad."
                    : "Debe tener mayúscula, minúscula, número y símbolo especial (!@#$%…)."}
                </p>
              )}

              {/* Rol — deshabilitado si el usuario se está editando a sí mismo */}
              {!esAutoEdicion && (
                <FieldWrapper label="Rol" error={errors.id_rol?.message}>
                  <Controller
                    control={control}
                    name="id_rol"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
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
                    )}
                  />
                </FieldWrapper>
              )}

              {/* Sucursales */}
              <FieldWrapper
                label="Sucursales Asignadas"
                error={(errors as any).ids_sucursales?.message}
              >
                <Controller
                  control={control}
                  name="ids_sucursales"
                  render={({ field }) => (
                    <VirtualizedSucursalesSelect
                      sucursales={sucursales}
                      value={field.value ?? []}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FieldWrapper>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar Cambios" : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
