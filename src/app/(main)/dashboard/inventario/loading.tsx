import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card p-5 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 overflow-hidden">
      {/* Fila 1: 5 KPI Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>

      {/* Fila 2: Tabla + Dispersión */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-32 shrink-0" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-20 shrink-0" />
                <Skeleton className="h-3 w-24 shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[500px] w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Fila 3: Ranking + Treemap */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[500px] w-full" />
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[500px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
