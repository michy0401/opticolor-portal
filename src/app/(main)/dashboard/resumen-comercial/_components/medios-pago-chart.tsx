"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import { formatCurrency } from "@/lib/utils";
import type { MedioPago } from "../_actions/get-resumen-data";

// Rampa usando los tokens del sistema de diseño (Light/Dark mode compatible)
const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
  "var(--accent)",
];

interface Props {
  data: MedioPago[];
}

// Tooltip personalizado para el donut
function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: MedioPago }>;
}) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: item } = payload[0];
  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
        {name}
      </p>
      <div className="space-y-0.5 text-xs">
        <div className="flex items-center justify-between gap-5">
          <span className="text-muted-foreground">Total cobrado</span>
          <span className="font-medium tabular-nums">{formatCurrency(value)}</span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="text-muted-foreground">Participación</span>
          <span className="font-medium tabular-nums">{item.porcentaje.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

// Leyenda: solo nombre + porcentaje (sin montos)
function LegendList({ data }: { data: MedioPago[] }) {
  return (
    <ul className="flex w-full flex-col gap-2">
      {data.map((item, i) => (
        <li key={i} className="flex min-w-0 items-center gap-2 text-xs">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
          />
          <span
            className="min-w-0 flex-1 truncate text-muted-foreground"
            title={item.medioPago}
          >
            {item.medioPago}
          </span>
          <span className="shrink-0 font-semibold tabular-nums">
            {item.porcentaje.toFixed(1)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MediosPagoChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Sin datos para el período seleccionado
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      {/* Donut — anillo más grueso y prominente */}
      <SafeChartContainer height="h-52" className="w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="32%"
              outerRadius="82%"
              dataKey="monto"
              nameKey="medioPago"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              content={<DonutTooltip />}
              cursor={false}
            />
          </PieChart>
        </ResponsiveContainer>
      </SafeChartContainer>

      {/* Leyenda: nombre + porcentaje */}
      <div className="min-w-0 flex-1">
        <LegendList data={data} />
      </div>
    </div>
  );
}
