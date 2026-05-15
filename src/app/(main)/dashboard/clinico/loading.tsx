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

      {/* ── Fila 2: Tendencia (Full Width) ────────── */}
      <Skeleton className="h-[560px] w-full rounded-2xl" />

      {/* ── Fila 3: Género y Edad ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[560px] w-full rounded-2xl" />
        <Skeleton className="h-[560px] w-full rounded-2xl" />
      </div>

      {/* ── Fila 4: Top Sucursales y Volumen vs Conversión ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[560px] w-full rounded-2xl" />
        <Skeleton className="h-[560px] w-full rounded-2xl" />
      </div>
    </div>
  );
}
