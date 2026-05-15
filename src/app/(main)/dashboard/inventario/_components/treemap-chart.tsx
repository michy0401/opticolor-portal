"use client";

import { ResponsiveContainer, Tooltip, Treemap } from "recharts";

import { SafeChartContainer } from "@/components/ui/safe-chart-container";
import { formatCurrency } from "@/lib/utils";
import type { GrupoMix } from "../_actions/get-inventario-data";

const PALETTE = [
  "#0f172a",
  "#1e3a5f",
  "#1d4ed8",
  "#0891b2",
  "#0d9488",
  "#059669",
  "#047857",
];

interface Props {
  data: GrupoMix[];
}

// Tooltip personalizado para el Treemap
function TreemapTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: GrupoMix }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const d = item.payload;
  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
        {item.name ?? d.name}
      </p>
      <div className="space-y-0.5 text-xs">
        <div className="flex items-center justify-between gap-5">
          <span className="text-muted-foreground">Venta Neta</span>
          <span className="font-medium tabular-nums">{formatCurrency(d.size)}</span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="text-muted-foreground">Participación</span>
          <span className="font-medium tabular-nums">{d.porcentaje.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

// Contenido personalizado para cada celda del Treemap
function TreemapCell(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  size?: number;
  porcentaje?: number;
  index?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, depth = 0, name = "", porcentaje = 0, index = 0 } = props;

  // El nodo raíz (depth=0) no se renderiza
  if (depth === 0) return <g />;

  const color = PALETTE[index % PALETTE.length];
  const showLabel = width > 64 && height > 44;
  const showPct   = width > 64 && height > 66;

  return (
    <g>
      <rect
        x={x + 2}
        y={y + 2}
        width={width - 4}
        height={height - 4}
        rx={6}
        fill={color}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showPct ? -8 : 5)}
          textAnchor="middle"
          fill="white"
          fontSize={12}
          fontWeight={600}
          className="select-none"
        >
          {name.length > 14 ? `${name.slice(0, 13)}…` : name}
        </text>
      )}
      {showPct && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          fill="rgba(255,255,255,0.75)"
          fontSize={11}
          className="select-none"
        >
          {porcentaje.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

export function TreemapChart({ data }: Props) {
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
        <Treemap
          data={data}
          dataKey="size"
          aspectRatio={4 / 3}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={<TreemapCell />}
        >
          <Tooltip content={<TreemapTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}
