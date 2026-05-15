import { format, startOfMonth } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
} from "@/lib/utils";

import { getInventarioData } from "./_actions/get-inventario-data";
import { DetalleTable } from "./_components/detalle-table";
import { DispersionChart } from "./_components/dispersion-chart";
import { KpiCard } from "./_components/kpi-card";
import { RankingMarcasChart } from "./_components/ranking-marcas-chart";
import { TreemapChart } from "./_components/treemap-chart";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  sucursal?: string;
  marca?: string;
  grupo?: string;
}>;

const EMPTY_DATA = {
  kpis: {
    stockFisico: 0,
    capitalInvertido: 0,
    unidadesVendidas: 0,
    ventaNetaProducto: 0,
    cantidadFacturas: 0,
  },
  marcasDetalle: [],
  gruposMix: [],
};

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { from, to, sucursal, marca, grupo } = await searchParams;

  const startDate = from
    ? format(new Date(from), "yyyy-MM-dd")
    : format(startOfMonth(new Date()), "yyyy-MM-dd");
  const endDate = to
    ? format(new Date(to), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  const sucursalId =
    sucursal && sucursal !== "all" ? parseInt(sucursal, 10) : null;
  const marcaFilter = marca && marca !== "all" ? marca : null;
  const grupoFilter = grupo && grupo !== "all" ? grupo : null;

  const result = await getInventarioData({
    startDate,
    endDate,
    sucursalId,
    marcaFilter,
    grupoFilter,
  });
  const data = result.data ?? EMPTY_DATA;
  const { kpis } = data;

  // Métricas derivadas
  const upt =
    kpis.cantidadFacturas > 0 ? kpis.unidadesVendidas / kpis.cantidadFacturas : 0;
  const asp =
    kpis.unidadesVendidas > 0 ? kpis.ventaNetaProducto / kpis.unidadesVendidas : 0;

  return (
    <div className="flex flex-col gap-6 overflow-hidden">
      {/* Banner de error no crítico */}
      {!result.success && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {result.error ?? "No se pudieron cargar los datos. Intenta de nuevo."}
        </div>
      )}

      {/* ── Fila 1: 5 KPI Cards ────────────────────────────────────────────────
          grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-3 → xl:grid-cols-5       */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          title="Stock Físico"
          value={formatCompactNumber(kpis.stockFisico)}
          fullValue={kpis.stockFisico.toLocaleString("en-US")}
          subtitle="Snapshot · hasta hoy"
          iconName="archive"
          highlight
        />
        <KpiCard
          title="Capital Invertido"
          value={formatCompactCurrency(kpis.capitalInvertido)}
          fullValue={formatCurrency(kpis.capitalInvertido)}
          subtitle="Snapshot · hasta hoy"
          iconName="dollar-sign"
        />
        <KpiCard
          title="Unidades Vendidas"
          value={formatCompactNumber(kpis.unidadesVendidas)}
          fullValue={kpis.unidadesVendidas.toLocaleString("en-US")}
          iconName="trending-up"
        />
        <KpiCard
          title="UPT"
          value={upt.toFixed(2)}
          subtitle="Unidades por ticket"
          iconName="bar-chart-2"
        />
        <KpiCard
          title="ASP"
          value={formatCompactCurrency(asp)}
          fullValue={formatCurrency(asp)}
          subtitle="Precio promedio de venta"
          iconName="tag"
        />
      </div>

      {/* ── Fila 2: Tabla Detalle (izq) | Dispersión (der) ────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* La tabla comparte la misma altura que el gráfico adyacente */}
        <Card className="flex flex-col overflow-hidden rounded-2xl shadow-md lg:h-[572px]">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Detalle por Marca
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto px-6 py-0 pb-4">
            <DetalleTable data={data.marcasDetalle} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Eficiencia de Inventario · Stock vs Ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DispersionChart data={data.marcasDetalle} />
        </CardContent>
        </Card>
      </div>

      {/* ── Fila 3: Ranking Marcas (izq) | Mix Grupos (der) ───────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Ranking de Marcas · Unidades Vendidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RankingMarcasChart data={data.marcasDetalle} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Mix de Venta · Por Grupo Comercial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TreemapChart data={data.gruposMix} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
