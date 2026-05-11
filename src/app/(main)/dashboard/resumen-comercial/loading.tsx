import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-1.5 h-3 w-16" />
    </div>
  );
}

function BarRowSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-3 w-4 shrink-0" />
      <Skeleton className="h-3 w-28 shrink-0" />
      <Skeleton className="h-2 flex-1 rounded-full" />
      <Skeleton className="h-3 w-20 shrink-0" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 overflow-hidden">
      {/* Fila 1: KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>

      {/* Fila 2: Sucursales + Medios de Pago */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <BarRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Skeleton className="h-44 w-44 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-8 shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fila 3: Gráfico de tendencia */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
