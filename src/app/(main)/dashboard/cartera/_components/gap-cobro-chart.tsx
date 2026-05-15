"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GapCobro } from "../_actions/get-cartera-data";
import { SafeChartContainer } from "@/components/ui/safe-chart-container";

interface Props {
  data: GapCobro[];
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
        <div key={p.name} className="flex items-center justify-between gap-6 text-xs mb-1 last:mb-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">
              {p.name === "monto_total" ? "Monto Pedidos" : "Saldo Pendiente"}
            </span>
          </div>
          <span className="font-semibold tabular-nums">
            {fmtCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function GapCobroChart({ data }: Props) {
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
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="fillMonto" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillSaldo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="hsl(var(--border))"
          strokeOpacity={0.6}
        />
        <XAxis
          dataKey="mes_pedido_nombre"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={fmtMoney}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.1 }} />
        
        <Area
          type="linear"
          dataKey="monto_total"
          name="monto_total"
          stroke="var(--primary)"
          fill="url(#fillMonto)"
          strokeWidth={2}
          fillOpacity={0.2}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
        <Area
          type="linear"
          dataKey="saldo_pendiente"
          name="saldo_pendiente"
          stroke="var(--destructive)"
          fill="url(#fillSaldo)"
          strokeWidth={2}
          fillOpacity={0.6}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
