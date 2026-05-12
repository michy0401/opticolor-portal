import { Skeleton } from "@/components/ui/skeleton";

export default function EficienciaLoading() {
  return (
    <div className="flex flex-col gap-6 overflow-hidden pb-10">
      {/* ── Fila 1: KPIs ────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>

      {/* ── Fila 2: Tendencia de Órdenes ────────── */}
      <Skeleton className="h-[350px] w-full rounded-2xl" />

      {/* ── Fila 3: Gráficos ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[580px] w-full rounded-2xl" />
        <Skeleton className="h-[580px] w-full rounded-2xl" />
      </div>

      {/* ── Fila 4: Tabla ────────── */}
      <Skeleton className="h-[400px] w-full rounded-2xl" />
    </div>
  );
}
