"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import type { SucursalExamen } from "../_actions/get-clinica-data";
import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import { formatCompactNumber } from "@/lib/utils";

interface Props {
  data: SucursalExamen[];
}

const truncateLabel = (value: string) => {
  if (value.length > 12) {
    return value.substring(0, 12) + "...";
  }
  return value;
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as SucursalExamen;

  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm min-w-[200px]">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-foreground border-b border-border pb-2">
        {data.nombre_sucursal}
      </p>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Exámenes</span>
          <span className="font-semibold tabular-nums text-foreground">
            {new Intl.NumberFormat("en-US").format(data.total_examenes)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TopSucursalesClinicaChart({ data }: Props) {
  if (!data.length) {
    return (
      <SafeChartContainer height="h-[500px]">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      </SafeChartContainer>
    );
  }

  // Calcular promedio dinámico
  const total = data.reduce((acc, curr) => acc + curr.total_examenes, 0);
  const promedio = data.length > 0 ? total / data.length : 0;

  return (
    <SafeChartContainer height="h-[500px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          vertical={true}
          stroke="hsl(var(--border))"
          strokeOpacity={0.6}
        />
        <XAxis
          type="number"
          tickFormatter={(value) => formatCompactNumber(value)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <YAxis
          dataKey="nombre_sucursal"
          type="category"
          tickFormatter={truncateLabel}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", textAnchor: "end" }}
          tickLine={false}
          axisLine={false}
          width={120}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
          content={<ChartTooltip />}
        />
        <ReferenceLine
          x={promedio}
          stroke="hsl(var(--destructive))"
          strokeDasharray="3 3"
          strokeOpacity={0.8}
          label={{
            position: "top",
            value: `Promedio: ${formatCompactNumber(promedio)}`,
            fill: "hsl(var(--destructive))",
            fontSize: 10,
          }}
        />
        <Bar
          dataKey="total_examenes"
          name="Total Exámenes"
          fill="var(--chart-2)"
          radius={[0, 4, 4, 0]}
          barSize={16}
        />
      </BarChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
