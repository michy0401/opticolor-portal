"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TipoLenteDetalle } from "../_actions/get-eficiencia-data";
import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import { formatCompactNumber } from "@/lib/utils";

interface Props {
  data: TipoLenteDetalle[];
}

const truncateLabel = (value: string) => {
  if (value.length > 15) {
    return value.substring(0, 15) + "...";
  }
  return value;
};

function ChartTooltip({
  active,
  payload,
  label,
  totalVolumen,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  totalVolumen: number;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as TipoLenteDetalle;
  const pct = totalVolumen > 0 ? (data.volumen_ordenes / totalVolumen) * 100 : 0;

  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm min-w-[200px]">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-foreground border-b border-border pb-2">
        {data.tipo_lente_descripcion}
      </p>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Cantidad</span>
          <span className="font-semibold tabular-nums text-foreground">
            {new Intl.NumberFormat("en-US").format(data.volumen_ordenes)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">% Participación</span>
          <span className="font-semibold tabular-nums text-foreground">
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function TipoLenteChart({ data }: Props) {
  if (!data.length) {
    return (
      <SafeChartContainer height="h-[500px]">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      </SafeChartContainer>
    );
  }

  const totalVolumen = data.reduce((acc, curr) => acc + curr.volumen_ordenes, 0);

  return (
    <SafeChartContainer height="h-[500px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="horizontal"
          margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={true}
            vertical={false}
            stroke="hsl(var(--border))"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="tipo_lente_descripcion"
            type="category"
            tickFormatter={truncateLabel}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            angle={-45}
            textAnchor="end"
          />
          <YAxis
            type="number"
            tickFormatter={(value) => formatCompactNumber(value)}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
            content={<ChartTooltip totalVolumen={totalVolumen} />}
          />
          <Bar
            dataKey="volumen_ordenes"
            name="Volumen Órdenes"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            barSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
