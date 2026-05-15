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
import type { MixVenta } from "../_actions/get-cartera-data";
import { SafeChartContainer } from "@/components/ui/safe-chart-container";

interface Props {
  data: MixVenta[];
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
  totalVenta,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  totalVenta: number;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as MixVenta;
  const pct = totalVenta > 0 ? (data.venta_neta / totalVenta) * 100 : 0;

  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm min-w-[220px]">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-foreground border-b border-border pb-2">
        {data.categoria_agrupada}
      </p>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Venta Neta</span>
          <span className="font-semibold tabular-nums text-foreground">
            {fmtCurrency(data.venta_neta)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Total Facturas</span>
          <span className="font-semibold tabular-nums text-foreground">
            {new Intl.NumberFormat("en-US").format(data.facturas)}
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

export function MixVentasChart({ data }: Props) {
  if (!data.length) {
    return (
      <SafeChartContainer height="h-[500px]">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      </SafeChartContainer>
    );
  }

  const totalVenta = data.reduce((acc, curr) => acc + curr.venta_neta, 0);

  return (
    <SafeChartContainer height="h-[500px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 20, right: 30, left: 80, bottom: 20 }}
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
          tickFormatter={fmtMoney}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          dataKey="categoria_agrupada"
          type="category"
          tickFormatter={truncateLabel}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }} content={<ChartTooltip totalVenta={totalVenta} />} />
        <Bar
          dataKey="venta_neta"
          name="Venta Neta"
          fill="var(--chart-1)"
          radius={[0, 4, 4, 0]}
          barSize={24}
        />
      </BarChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
