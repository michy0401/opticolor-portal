"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import type { MarcaItem } from "../_actions/get-inventario-data";

// Rampa monocromática premium (consistente con medios-pago-chart)
const PALETTE = [
  "#0f172a",
  "#1e3a5f",
  "#1d4ed8",
  "#0891b2",
  "#0d9488",
  "#059669",
  "#047857",
  "#065f46",
  "#0c4a6e",
  "#1e40af",
];

interface Props {
  data: MarcaItem[];
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { marca: string; x: number; y: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
        {d.marca}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        <span className="text-muted-foreground">Stock Físico</span>
        <span className="text-right font-medium tabular-nums">
          {d.x.toLocaleString("en-US")}
        </span>
        <span className="text-muted-foreground">Und. Vendidas</span>
        <span className="text-right font-medium tabular-nums">
          {d.y.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}

export function DispersionChart({ data }: Props) {
  if (!data.length) {
    return (
      <SafeChartContainer height="h-[500px]">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      </SafeChartContainer>
    );
  }

  const scatterData = data.map((m, idx) => ({
    marca: m.marca,
    x: m.stockFisico,
    y: m.unidadesVendidas,
    idx,
  }));

  return (
    <SafeChartContainer height="h-[500px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 20, left: 8, bottom: 32 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            strokeOpacity={0.6}
          />

          <XAxis
            type="number"
            dataKey="x"
            name="Stock Físico"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v.toLocaleString("en-US", { notation: "compact" })
            }
            label={{
              value: "Stock Físico (unidades)",
              position: "insideBottom",
              offset: -16,
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))",
            }}
          />

          <YAxis
            type="number"
            dataKey="y"
            name="Und. Vendidas"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) =>
              v.toLocaleString("en-US", { notation: "compact" })
            }
            label={{
              value: "Und. Vendidas",
              angle: -90,
              position: "insideLeft",
              offset: 12,
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))",
            }}
          />

          <ZAxis range={[72, 72]} />

          <Tooltip
            content={<ScatterTooltip />}
            cursor={{ strokeDasharray: "4 4", stroke: "hsl(var(--border))" }}
          />

          <Scatter
            data={scatterData}
            shape={(props: {
              cx?: number;
              cy?: number;
              payload?: { idx: number };
            }) => {
              const { cx = 0, cy = 0, payload } = props;
              const color = PALETTE[(payload?.idx ?? 0) % PALETTE.length];
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={9}
                  fill={color}
                  fillOpacity={0.85}
                  stroke={color}
                  strokeWidth={0}
                />
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
