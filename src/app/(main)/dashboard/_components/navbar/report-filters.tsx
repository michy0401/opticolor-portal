"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Layers, MapPin, Tag } from "lucide-react";

import { DateRangePicker } from "@/components/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MiSucursal } from "../../_actions/get-mis-sucursales";
import { getMarcasGrupos } from "../../inventario/_actions/get-inventario-filters";

interface Props {
  sucursales: MiSucursal[];
}

export function ReportFilters({ sucursales }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const fromParam     = searchParams.get("from");
  const toParam       = searchParams.get("to");
  const sucursalParam = searchParams.get("sucursal");
  const marcaParam    = searchParams.get("marca");
  const grupoParam    = searchParams.get("grupo");

  const isInventario = pathname.startsWith("/dashboard/inventario");

  // Opciones de Marca y Grupo — se cargan solo en la ruta de inventario
  const [marcas, setMarcas] = useState<string[]>([]);
  const [grupos, setGrupos] = useState<string[]>([]);

  useEffect(() => {
    if (!isInventario) return;
    getMarcasGrupos()
      .then(({ data }) => {
        if (data) {
          setMarcas(data.marcas);
          setGrupos(data.grupos);
        }
      })
      .catch(() => {/* fail silently — los selects simplemente no aparecen */});
  }, [isInventario]);

  const dateRange: DateRange = {
    from: fromParam ? new Date(fromParam) : startOfMonth(new Date()),
    to:   toParam   ? new Date(toParam)   : new Date(),
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDateChange = useCallback(
    (range: DateRange | undefined) => {
      if (!range?.from) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("from", range.from.toISOString());
      if (range.to) params.set("to", range.to.toISOString());
      else params.delete("to");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleSucursalChange = useCallback(
    (val: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (val === "all") params.delete("sucursal");
      else params.set("sucursal", val);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleMarcaChange = useCallback(
    (val: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (val === "all") params.delete("marca");
      else params.set("marca", val);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleGrupoChange = useCallback(
    (val: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (val === "all") params.delete("grupo");
      else params.set("grupo", val);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="flex w-full flex-wrap items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:pb-0">

      {/* ── Permanentes: siempre visibles en cualquier ruta de /dashboard ── */}
      <div className="shrink-0">
        <DateRangePicker value={dateRange} onChange={handleDateChange} />
      </div>

      <Select value={sucursalParam ?? "all"} onValueChange={handleSucursalChange}>
        <SelectTrigger className="h-9 min-w-[150px] flex-1 gap-1.5 text-sm sm:min-w-[160px] sm:flex-none">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Todas las sucursales" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="all">Todas las sucursales</SelectItem>
          {sucursales.map((s) => (
            <SelectItem key={s.id_sucursal} value={String(s.id_sucursal)}>
              {s.nombre_sucursal}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ── Dinámicos: solo en /dashboard/inventario, carga lazy ─────────── */}
      {isInventario && marcas.length > 0 && (
        <Select value={marcaParam ?? "all"} onValueChange={handleMarcaChange}>
          <SelectTrigger className="h-9 min-w-[130px] flex-1 gap-1.5 text-sm sm:min-w-[140px] sm:flex-none">
            <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Todas las marcas" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">Todas las marcas</SelectItem>
            {marcas.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isInventario && grupos.length > 0 && (
        <Select value={grupoParam ?? "all"} onValueChange={handleGrupoChange}>
          <SelectTrigger className="h-9 min-w-[130px] flex-1 gap-1.5 text-sm sm:min-w-[140px] sm:flex-none">
            <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Todos los grupos" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">Todos los grupos</SelectItem>
            {grupos.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
