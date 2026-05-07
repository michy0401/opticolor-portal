"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { MapPin } from "lucide-react";

import { DateRangePicker } from "@/components/date-range-picker";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { MiSucursal } from "../../_actions/get-mis-sucursales";

interface Props {
  sucursales: MiSucursal[];
}

export function ReportFilters({ sucursales }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");
  const sucursalParam = searchParams.get("sucursal");

  const dateRange: DateRange = {
    from: fromParam ? new Date(fromParam) : subDays(new Date(), 29),
    to:   toParam   ? new Date(toParam)   : new Date(),
  };

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

  return (
    <div className="flex items-center gap-2">
      <DateRangePicker value={dateRange} onChange={handleDateChange} />

      {sucursales.length > 0 && (
        <Select value={sucursalParam ?? "all"} onValueChange={handleSucursalChange}>
          <SelectTrigger className="h-9 gap-1.5 text-sm min-w-[160px]">
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
      )}
    </div>
  );
}
