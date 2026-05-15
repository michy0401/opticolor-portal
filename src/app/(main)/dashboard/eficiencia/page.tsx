import { format, startOfMonth } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
} from "@/lib/utils";

import { getEficienciaData } from "./_actions/get-eficiencia-data";
import { KpiCard } from "../resumen-comercial/_components/kpi-card";
import { TendenciaOrdenesChart } from "./_components/tendencia-ordenes-chart";
import { TipoLenteChart } from "./_components/tipo-lente-chart";
import { OrdenesSucursalChart } from "./_components/ordenes-sucursal-chart";
import { DetalleCristalesTable } from "./_components/detalle-cristales-table";

type SearchParams = Promise<{ from?: string; to?: string; sucursal?: string }>;

const EMPTY_DATA = {
  kpis: {
    ordenesHoy: 0,
    volumenOrdenes: 0,
    promedioDiario: 0,
    montoTotal: 0,
  },
  tendencia: [],
  tipoLente: [],
  ordenesSucursal: [],
};

export default async function EficienciaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { from, to, sucursal } = await searchParams;

  const startDate = from
    ? format(new Date(from), "yyyy-MM-dd")
    : format(startOfMonth(new Date()), "yyyy-MM-dd");
  const endDate = to
    ? format(new Date(to), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  const sucursalId =
    sucursal && sucursal !== "all" ? parseInt(sucursal, 10) : null;

  const result = await getEficienciaData({ startDate, endDate, sucursalId });
  const data = result.data ?? EMPTY_DATA;
  const { kpis } = data;

  return (
    <div className="flex flex-col gap-6 overflow-hidden pb-10">
      {/* Banner de error no crítico */}
      {!result.success && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {result.error ?? "No se pudieron cargar los datos. Intenta de nuevo."}
        </div>
      )}

      {/* ── Fila 1: KPIs ────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Órdenes Hoy"
          value={kpis.ordenesHoy.toLocaleString("en-US")}
          fullValue={kpis.ordenesHoy.toLocaleString("en-US")}
          iconName="shopping-cart"
          highlight
        />
        <KpiCard
          title="Volumen de Órdenes"
          value={formatCompactNumber(kpis.volumenOrdenes)}
          fullValue={kpis.volumenOrdenes.toLocaleString("en-US")}
          iconName="package"
        />
        <KpiCard
          title="Promedio Órdenes Diario"
          value={kpis.promedioDiario.toFixed(1)}
          fullValue={kpis.promedioDiario.toFixed(2)}
          iconName="trending-up"
        />
        <KpiCard
          title="Monto Total Órdenes"
          value={formatCompactCurrency(kpis.montoTotal)}
          fullValue={formatCurrency(kpis.montoTotal)}
          iconName="dollar-sign"
        />
      </div>

      {/* ── Fila 2: Tendencia de Órdenes ────────── */}
      <Card className="overflow-hidden rounded-2xl shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Tendencia de Órdenes · Últimos 12 Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
            <TendenciaOrdenesChart data={data.tendencia} />
          </CardContent>
      </Card>

      {/* ── Fila 3: Detalle por Tipo y Órdenes por Sucursal ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Detalle de Órdenes por Tipo de Lente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TipoLenteChart data={data.tipoLente} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Órdenes Ejecutadas por Sucursal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OrdenesSucursalChart data={data.ordenesSucursal} />
          </CardContent>
        </Card>
      </div>

      {/* ── Fila 4: Detalle de Cristales ────────── */}
      <Card className="overflow-hidden rounded-2xl shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Detalle de Órdenes de Cristales por Tipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DetalleCristalesTable data={data.tipoLente} />
        </CardContent>
      </Card>
    </div>
  );
}
