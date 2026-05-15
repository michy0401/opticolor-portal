import { format, startOfMonth } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactNumber } from "@/lib/utils";

import { getClinicaData } from "./_actions/get-clinica-data";
import { KpiCard } from "../resumen-comercial/_components/kpi-card";
import { TendenciaExamenesChart } from "./_components/tendencia-examenes-chart";
import { VolumenConversionChart } from "./_components/volumen-conversion-chart";
import { GeneroChart } from "./_components/genero-chart";
import { EdadChart } from "./_components/edad-chart";
import { TopSucursalesClinicaChart } from "./_components/top-sucursales-clinica-chart";

type SearchParams = Promise<{ from?: string; to?: string; sucursal?: string }>;

const EMPTY_DATA = {
  kpis: {
    totalExamenes: 0,
    pctConversion: 0,
    examenesHoy: 0,
    promedioDiario: 0,
    convertidos: 0,
    noConvertidos: 0,
  },
  tendencia: [],
  volumenConversion: [],
  genero: [],
  edad: [],
  topSucursales: [],
};

export default async function ClinicaPage({
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

  const result = await getClinicaData({ startDate, endDate, sucursalId });
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
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Exámenes Hoy"
          value={kpis.examenesHoy.toLocaleString("en-US")}
          iconName="activity"
          highlight
        />
        <KpiCard
          title="Total Exámenes"
          value={formatCompactNumber(kpis.totalExamenes)}
          fullValue={kpis.totalExamenes.toLocaleString("en-US")}
          iconName="users"
        />
        <KpiCard
          title="% Conversión"
          value={`${kpis.pctConversion.toFixed(1)}%`}
          fullValue={`${kpis.pctConversion.toFixed(2)}%`}
          iconName="check-circle"
        />
        <KpiCard
          title="Promedio Diario"
          value={kpis.promedioDiario.toFixed(1)}
          fullValue={kpis.promedioDiario.toFixed(2)}
          iconName="calendar"
        />
        <KpiCard
          title="Convertidos"
          value={formatCompactNumber(kpis.convertidos)}
          fullValue={kpis.convertidos.toLocaleString("en-US")}
          iconName="clipboard"
        />
        <KpiCard
          title="No Convertidos"
          value={formatCompactNumber(kpis.noConvertidos)}
          fullValue={kpis.noConvertidos.toLocaleString("en-US")}
          iconName="x-circle"
        />
      </div>

      {/* ── Fila 4: Tendencia Full Width ────────── */}
      <Card className="overflow-hidden rounded-2xl shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Tendencia de Exámenes · Últimos 12 Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[500px]">
            <TendenciaExamenesChart data={data.tendencia} />
          </div>
        </CardContent>
      </Card>

      {/* ── Fila 3: Género y Edad ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Distribución por Género
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px]">
              <GeneroChart data={data.genero} />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Pacientes por Rango de Edad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px]">
              <EdadChart data={data.edad} />
            </div>
          </CardContent>
        </Card>
      </div>



      {/* ── Fila 2: Sucursales + Volumen vs Conversión ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Top Sucursales por Volumen de Exámenes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px]">
              <TopSucursalesClinicaChart data={data.topSucursales} />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Volumen vs Conversión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px]">
              <VolumenConversionChart data={data.volumenConversion} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
