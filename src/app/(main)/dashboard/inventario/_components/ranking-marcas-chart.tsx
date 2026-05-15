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

import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import type { MarcaItem } from "../_actions/get-inventario-data";

interface Props {
  data: MarcaItem[];
}

const MAX_LABEL_LEN = 18;

function truncate(s: string) {
  return s.length > MAX_LABEL_LEN ? `${s.slice(0, MAX_LABEL_LEN - 1)}…` : s;
}

function RankingTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">Unidades Vendidas</span>
        <span className="font-medium tabular-nums">
          {payload[0].value.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}

export function RankingMarcasChart({ data }: Props) {
  if (!data.length) {
    return (
      <SafeChartContainer height="h-[500px]">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      </SafeChartContainer>
    );
  }

  // Tomar top 20 para no colapsar el eje Y con demasiadas marcas
  const chartData = data.slice(0, 20).map((m) => ({
    ...m,
    labelTrunc: truncate(m.marca),
  }));

  return (
    <SafeChartContainer height="h-[500px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            horizontal={false}
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            strokeOpacity={0.6}
          />

          {/* Eje Y: nombres de marca (truncados) con 120 px de ancho reservado */}
          <YAxis
            type="category"
            dataKey="labelTrunc"
            width={120}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />

          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v.toLocaleString("en-US", { notation: "compact" })
            }
          />

          {/* Tooltip muestra el nombre completo (desde el campo marca) */}
          <Tooltip
            content={({ active, payload }) => (
              <RankingTooltip
                active={active}
                payload={payload as Array<{ value: number }>}
                label={payload?.[0]?.payload?.marca}
              />
            )}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          />

          <Bar
            dataKey="unidadesVendidas"
            fill="#1d4ed8"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            opacity={0.9}
          />
        </BarChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
