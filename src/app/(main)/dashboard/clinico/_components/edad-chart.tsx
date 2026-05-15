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
import type { EdadExamen } from "../_actions/get-clinica-data";
import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import { formatCompactNumber } from "@/lib/utils";

interface Props {
  data: EdadExamen[];
}

function ChartTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  total: number;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as EdadExamen;
  const pct = total > 0 ? (data.total_examenes / total) * 100 : 0;

  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm min-w-[200px]">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-foreground border-b border-border pb-2">
        Rango: {data.rango_edad_descripcion}
      </p>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Pacientes</span>
          <span className="font-semibold tabular-nums text-foreground">
            {new Intl.NumberFormat("en-US").format(data.total_examenes)}
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

export function EdadChart({ data }: Props) {
  if (!data.length) {
    return (
      <SafeChartContainer height="h-[350px]">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      </SafeChartContainer>
    );
  }

  const total = data.reduce((acc, curr) => acc + curr.total_examenes, 0);

  return (
    <SafeChartContainer height="h-[350px]">
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
          dataKey="rango_edad_descripcion"
          type="category"
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
          content={<ChartTooltip total={total} />}
        />
        <Bar
          dataKey="total_examenes"
          name="Total Exámenes"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
          barSize={40}
        />
      </BarChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
