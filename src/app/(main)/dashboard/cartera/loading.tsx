"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CarteraLoading() {
  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* ── Fila 1: KPIs ────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-xl" />
        ))}
      </div>

      {/* ── Fila 2: GAP de Cobro ────────── */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>

      {/* ── Fila 3: Mix de Ventas y Cartera por Sucursal ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* ── Fila 4: Top Clientes Deudores ────────── */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
