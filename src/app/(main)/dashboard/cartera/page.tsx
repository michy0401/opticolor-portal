import { format, subDays, startOfMonth } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
} from "@/lib/utils";

import { getCarteraData } from "./_actions/get-cartera-data";
import { KpiCard } from "../resumen-comercial/_components/kpi-card";
import { GapCobroChart } from "./_components/gap-cobro-chart";
import { MixVentasChart } from "./_components/mix-ventas-chart";
import { CarteraSucursalChart } from "./_components/cartera-sucursal-chart";
import { ClientesDeudoresTable } from "./_components/clientes-deudores-table";

type SearchParams = Promise<{ from?: string; to?: string; sucursal?: string }>;

const EMPTY_DATA = {
  kpis: {
    montoPedidos: 0,
    recaudado: 0,
    saldoPendiente: 0,
    pedidosLiquidar: 0,
    pctCobroInmediato: 0,
    pctNivelAbono: 0,
  },
  gapCobro: [],
  mixVentas: [],
  carteraSucursal: [],
  clientesDeudores: [],
};

export default async function CarteraPage({
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

  const result = await getCarteraData({ startDate, endDate, sucursalId });
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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Monto Ordenes"
          value={formatCompactCurrency(kpis.montoPedidos)}
          fullValue={formatCurrency(kpis.montoPedidos)}
          iconName="dollar-sign"
        />
        <KpiCard
          title="Recaudado en Ordenes"
          value={formatCompactCurrency(kpis.recaudado)}
          fullValue={formatCurrency(kpis.recaudado)}
          iconName="wallet"
        />
        <KpiCard
          title="Monto Saldo Pendiente"
          value={formatCompactCurrency(kpis.saldoPendiente)}
          fullValue={formatCurrency(kpis.saldoPendiente)}
          iconName="alert-triangle"
          highlight
        />
        <KpiCard
          title="Ordenes por Liquidar"
          value={formatCompactNumber(kpis.pedidosLiquidar)}
          fullValue={kpis.pedidosLiquidar.toLocaleString("en-US")}
          iconName="clipboard-list"
        />
        <KpiCard
          title="% Primer Abono"
          value={`${kpis.pctCobroInmediato.toFixed(1)}%`}
          fullValue={`${kpis.pctCobroInmediato.toFixed(2)}%`}
          iconName="percent"
        />
        <KpiCard
          title="% Pago Total"
          value={`${kpis.pctNivelAbono.toFixed(1)}%`}
          fullValue={`${kpis.pctNivelAbono.toFixed(2)}%`}
          iconName="percent"
        />
      </div>

      {/* ── Fila 2: GAP de Cobro ────────── */}
      <Card className="overflow-hidden rounded-2xl shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Tendencia de la Cartera · GAP de Cobro
          </CardTitle>
        </CardHeader>
        <CardContent>
            <GapCobroChart data={data.gapCobro} />
          </CardContent>
      </Card>

      {/* ── Fila 3: Mix de Ventas y Cartera por Sucursal ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Mix de Ventas · Participación y Monto Neto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MixVentasChart data={data.mixVentas} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Cartera Pendiente por Sucursal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CarteraSucursalChart data={data.carteraSucursal} />
          </CardContent>
        </Card>
      </div>

      {/* ── Fila 4: Top Clientes Deudores ────────── */}
      <Card className="overflow-hidden rounded-2xl shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Top 10 de Clientes Deudores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ClientesDeudoresTable data={data.clientesDeudores} />
        </CardContent>
      </Card>
    </div>
  );
}
