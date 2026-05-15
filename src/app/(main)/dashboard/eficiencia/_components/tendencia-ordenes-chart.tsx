"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TendenciaOrden } from "../_actions/get-eficiencia-data";
import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import { formatCompactNumber } from "@/lib/utils";

interface Props {
  data: TendenciaOrden[];
}

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

  const data = payload[0].payload as TendenciaOrden;

  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm min-w-[150px]">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-foreground border-b border-border pb-2">
        {data.mes_nombre}
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

export function TendenciaOrdenesChart({ data }: Props) {
  if (!data.length) {
    return (
      <SafeChartContainer height="h-72">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      </SafeChartContainer>
    );
  }

  return (
    <SafeChartContainer height="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={true}
            vertical={false}
            stroke="hsl(var(--border))"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="mes_nombre"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <YAxis
            tickFormatter={(value) => formatCompactNumber(value)}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--muted))", strokeWidth: 2 }}
            content={<ChartTooltip />}
          />
          <Line
            type="linear"
            dataKey="volumen_ordenes"
            stroke="var(--chart-1)"
            strokeWidth={3}
            dot={{ r: 4, fill: "var(--background)", strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
