"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import type { VentaDiaria } from "../_actions/get-resumen-data";

interface Props {
  data: VentaDiaria[];
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

// Tooltip personalizado
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
        <div key={p.name} className="flex items-center gap-2.5 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">
            {p.name === "ventaNeta" ? "Venta Neta" : "Tráfico"}
          </span>
          <span className="ml-auto font-semibold tabular-nums">
            {p.name === "ventaNeta"
              ? fmtCurrency(p.value)
              : p.value.toLocaleString("en-US")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function VentasChart({ data }: Props) {
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
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="hsl(var(--border))"
          strokeOpacity={0.6}
        />

        {/* Eje X: etiqueta mensual ("Ene", "Feb"…) */}
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />

        {/* Eje Y izquierdo: montos (barras) */}
        <YAxis
          yAxisId="left"
          tickFormatter={fmtMoney}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={60}
        />

        {/* Eje Y derecho: tráfico (línea) — discreto */}
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={36}
          tickFormatter={(v: number) =>
            v.toLocaleString("en-US", { notation: "compact" })
          }
        />

        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
        />

        {/* Barras redondeadas: Venta Neta — azul profundo */}
        <Bar
          yAxisId="left"
          dataKey="ventaNeta"
          name="ventaNeta"
          fill="var(--primary)"
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
          opacity={0.9}
        />

        {/* Línea suave con puntos: Tráfico — gris medio */}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="trafico"
          name="trafico"
          stroke="var(--chart-2)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "var(--chart-2)", strokeWidth: 0 }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </ComposedChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
