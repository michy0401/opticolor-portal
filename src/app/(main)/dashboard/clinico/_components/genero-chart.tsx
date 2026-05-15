"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { GeneroExamen } from "../_actions/get-clinica-data";
import { SafeChartContainer } from "@/components/ui/safe-chart-container";

interface Props {
  data: GeneroExamen[];
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "hsl(var(--muted-foreground)/0.4)", "hsl(var(--muted-foreground)/0.8)"];

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

  const data = payload[0].payload;
  const pct = total > 0 ? (data.total_examenes / total) * 100 : 0;

  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm min-w-[180px]">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-foreground border-b border-border pb-2">
        {data.genero_label}
      </p>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Cantidad</span>
          <span className="font-semibold tabular-nums text-foreground">
            {new Intl.NumberFormat("en-US").format(data.total_examenes)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">% del Total</span>
          <span className="font-semibold tabular-nums text-foreground">
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function GeneroChart({ data }: Props) {
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
      <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={80}
          outerRadius={140}
          paddingAngle={2}
          dataKey="total_examenes"
          nameKey="genero_label"
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip total={total} />} />
        <Legend 
          verticalAlign="bottom" 
          height={36} 
          iconType="circle"
          wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }}
        />
      </PieChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
