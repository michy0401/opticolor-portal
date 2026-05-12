import { Skeleton } from "@/components/ui/skeleton";

export default function ClinicaLoading() {
  return (
    <div className="flex flex-col gap-6 overflow-hidden pb-10">
      {/* ── Fila 1: KPIs ────────── */}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>

      {/* ── Fila 2: Tendencia y Conversión (Full Width) ────────── */}
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[580px] w-full rounded-2xl" />
        <Skeleton className="h-[580px] w-full rounded-2xl" />
      </div>

      {/* ── Fila 3: Género y Edad ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[580px] w-full rounded-2xl" />
        <Skeleton className="h-[580px] w-full rounded-2xl" />
      </div>

      {/* ── Fila 4: Sucursales ────────── */}
      <Skeleton className="h-[580px] w-full rounded-2xl" />
    </div>
  );
}
