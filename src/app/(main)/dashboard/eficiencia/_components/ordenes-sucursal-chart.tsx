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
import type { OrdenesSucursal } from "../_actions/get-eficiencia-data";
import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import { formatCompactNumber } from "@/lib/utils";

interface Props {
  data: OrdenesSucursal[];
}

const truncateLabel = (value: string) => {
  if (value.length > 20) {
    return value.substring(0, 20) + "...";
  }
  return value;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as OrdenesSucursal;

  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm min-w-[200px]">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-foreground border-b border-border pb-2">
        {data.nombre_sucursal}
      </p>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Volumen</span>
          <span className="font-semibold tabular-nums text-foreground">
            {new Intl.NumberFormat("en-US").format(data.volumen_ordenes)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function OrdenesSucursalChart({ data }: Props) {
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
  const totalVolumen = data.reduce((acc, curr) => acc + curr.volumen_ordenes, 0);
  const promedio = data.length > 0 ? totalVolumen / data.length : 0;

  return (
    <SafeChartContainer height="h-[500px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 20, right: 40, left: 80, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={true}
            vertical={false}
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
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={80}
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
            dataKey="volumen_ordenes"
            name="Volumen Órdenes"
            fill="var(--chart-2)"
            radius={[0, 4, 4, 0]}
            barSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
