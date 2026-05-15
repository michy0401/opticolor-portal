"use client";

import {
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { VolumenConversion } from "../_actions/get-clinica-data";
import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import { formatCompactNumber } from "@/lib/utils";

interface Props {
  data: VolumenConversion[];
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as VolumenConversion;

  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm min-w-[220px]">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-foreground border-b border-border pb-2">
        {data.mes_examen_nombre}
      </p>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Convertidos</span>
          <span className="font-semibold tabular-nums text-primary">
            {new Intl.NumberFormat("en-US").format(data.convertidos)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">No Convertidos</span>
          <span className="font-semibold tabular-nums text-destructive">
            {new Intl.NumberFormat("en-US").format(data.no_convertidos)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 mt-1 border-t border-border pt-2">
          <span className="text-muted-foreground">% Conversión</span>
          <span className="font-semibold tabular-nums text-foreground">
            {data.pct_conversion.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function VolumenConversionChart({ data }: Props) {
  if (!data.length) {
    return (
      <SafeChartContainer height="h-[350px]">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      </SafeChartContainer>
    );
  }

  return (
    <SafeChartContainer height="h-[350px]">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
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
          dataKey="mes_examen_nombre"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <YAxis
          yAxisId="left"
          tickFormatter={(value) => formatCompactNumber(value)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
          content={<ChartTooltip />}
        />
        <Legend 
          verticalAlign="top" 
          height={36} 
          iconType="circle"
          wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
        />
        
        {/* Barras Apiladas */}
        <Bar
          yAxisId="left"
          dataKey="convertidos"
          name="Convertidos"
          stackId="a"
          fill="var(--chart-2)"
          radius={[0, 0, 4, 4]}
          barSize={40}
        />
        <Bar
          yAxisId="left"
          dataKey="no_convertidos"
          name="No Convertidos"
          stackId="a"
          fill="hsl(var(--muted-foreground)/0.3)"
          radius={[4, 4, 0, 0]}
          barSize={40}
        />

        {/* Línea de Conversión */}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="pct_conversion"
          name="% Conversión"
          stroke="var(--chart-1)"
          strokeWidth={3}
          dot={{ r: 4, fill: "var(--background)", strokeWidth: 2 }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </ComposedChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
