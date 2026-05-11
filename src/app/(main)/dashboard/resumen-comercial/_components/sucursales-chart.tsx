"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/utils";
import type { VentaSucursal } from "../_actions/get-resumen-data";

interface Props {
  data: VentaSucursal[];
}

const fmtCompact = (v: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "USD",
  }).format(v);

export function SucursalesChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Sin datos para el período seleccionado
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => Math.max(d.ventaNeta, d.estimadoCierre)));
  const hasEstimado = data.some((d) => d.estimadoCierre > 0);

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-2.5">
        {data.map((item, i) => {
          const ventaPct = maxValue > 0 ? (item.ventaNeta / maxValue) * 100 : 0;
          const estimadoPct =
            hasEstimado && maxValue > 0 ? (item.estimadoCierre / maxValue) * 100 : 0;

          return (
            <Tooltip key={item.idSucursal}>
              <TooltipTrigger asChild>
                <div className="flex cursor-default items-center gap-3">
                  {/* Rank */}
                  <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>

                  {/* Name */}
                  <span
                    className="w-28 shrink-0 truncate text-xs font-medium sm:w-36"
                    title={item.nombreSucursal}
                  >
                    {item.nombreSucursal}
                  </span>

                  {/* Progress bars */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${ventaPct}%` }}
                      />
                    </div>
                    {hasEstimado && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/30 transition-all duration-500"
                          style={{ width: `${estimadoPct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Value */}
                  <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums sm:w-24">
                    {fmtCompact(item.ventaNeta)}
                  </span>
                </div>
              </TooltipTrigger>

              <TooltipContent side="top" align="start" className="text-xs">
                <p className="mb-1.5 font-semibold">{item.nombreSucursal}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span className="text-muted-foreground">Venta Neta</span>
                  <span className="text-right tabular-nums font-medium">
                    {formatCurrency(item.ventaNeta)}
                  </span>
                  {item.estimadoCierre > 0 && (
                    <>
                      <span className="text-muted-foreground">Proyección Cierre</span>
                      <span className="text-right tabular-nums font-medium">
                        {formatCurrency(item.estimadoCierre)}
                      </span>
                    </>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {hasEstimado && (
          <div className="mt-1 flex items-center gap-4 border-t pt-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 rounded-full bg-primary" />
              <span>Venta Neta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-4 rounded-full bg-primary/30" />
              <span>Proyección Cierre</span>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
