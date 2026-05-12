"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/utils";
import type { ClienteDeudor } from "../_actions/get-cartera-data";

interface Props {
  data: ClienteDeudor[];
}

export function ClientesDeudoresTable({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground border rounded-xl bg-card">
        No hay clientes deudores en el período seleccionado
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Sucursal</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Cliente</TableHead>
            <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">Monto Órdenes</TableHead>
            <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">Recaudado</TableHead>
            <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">Saldo Pendiente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((cliente, index) => {
            const pctPagado = cliente.monto_total > 0 
              ? (cliente.monto_pagado / cliente.monto_total) * 100 
              : 0;

            return (
              <TableRow key={index} className="group transition-colors">
                <TableCell className="font-medium text-sm truncate max-w-[150px] text-muted-foreground">
                  {cliente.nombre_sucursal}
                </TableCell>
                <TableCell className="font-medium text-sm truncate max-w-[200px]">
                  {cliente.nombre_completo}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {formatCurrency(cliente.monto_total)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default underline decoration-dashed decoration-muted-foreground/40 underline-offset-4">
                          {formatCurrency(cliente.monto_pagado)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {pctPagado.toFixed(1)}% del total
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm font-semibold text-destructive">
                  {formatCurrency(cliente.saldo_pendiente)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
