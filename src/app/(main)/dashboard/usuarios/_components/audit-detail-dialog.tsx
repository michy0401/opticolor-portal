"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type AuditoriaRow } from "../_actions/get-usuario-detalle";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro: AuditoriaRow | null;
}

function tryParse(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function JsonDisplay({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="rounded-lg border bg-muted/40 p-3">
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(data).map(([key, val]) => (
              <tr key={key} className="border-b last:border-0">
                <td className="py-1.5 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {key}
                </td>
                <td className="py-1.5 font-medium break-all">
                  {val === null || val === undefined ? (
                    <span className="italic text-muted-foreground">null</span>
                  ) : Array.isArray(val) ? (
                    <span className="text-primary">[{(val as unknown[]).join(", ")}]</span>
                  ) : typeof val === "boolean" ? (
                    <Badge variant={val ? "default" : "secondary"} className="text-xs">
                      {String(val)}
                    </Badge>
                  ) : (
                    String(val)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AuditDetailDialog({ open, onOpenChange, registro }: Props) {
  if (!registro) return null;

  const anterior = tryParse(registro.valores_anteriores);
  const nuevo = tryParse(registro.valores_nuevos);
  const tieneDetalle = anterior || nuevo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalle de Auditoría
            <Badge variant="outline" className="text-xs font-mono">
              {registro.accion}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Valores capturados en el momento de la acción.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-4 pb-1">
            {!tieneDetalle ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                No hay detalles de cambios registrados para esta acción.
              </p>
            ) : (
              <>
                <JsonDisplay label="Valores Anteriores" data={anterior} />
                <JsonDisplay label="Valores Nuevos" data={nuevo} />
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
