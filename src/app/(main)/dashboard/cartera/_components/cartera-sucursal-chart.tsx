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
import type { CarteraSucursal } from "../_actions/get-cartera-data";
import { SafeChartContainer } from "@/components/ui/safe-chart-container";

interface Props {
  data: CarteraSucursal[];
}

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "USD",
  }).format(v);

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">Saldo Pendiente</span>
          </div>
          <span className="font-semibold tabular-nums">
            {fmtCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CarteraSucursalChart({ data }: Props) {
  if (!data.length) {
    return (
      <SafeChartContainer height="h-[500px]">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      </SafeChartContainer>
    );
  }

  return (
    <SafeChartContainer height="h-[500px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="horizontal"
        margin={{ top: 20, right: 30, left: 20, bottom: 120 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={true}
          vertical={false}
          stroke="hsl(var(--border))"
          strokeOpacity={0.6}
        />
        <XAxis
          dataKey="nombre_sucursal"
          type="category"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          type="number"
          tickFormatter={fmtMoney}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }} content={<ChartTooltip />} />
        <Bar
          dataKey="saldo_pendiente"
          name="Saldo Pendiente"
          fill="var(--destructive)"
          radius={[4, 4, 0, 0]}
          barSize={24}
        />
      </BarChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
