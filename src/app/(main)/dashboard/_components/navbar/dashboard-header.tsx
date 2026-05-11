"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { ReportFilters } from "./report-filters";
import type { MiSucursal } from "../../_actions/get-mis-sucursales";

// Rutas donde la navbar se oculta por completo
const CONFIG_ROUTES = [
  "/dashboard/usuarios",
  "/dashboard/sucursales",
  "/dashboard/perfil",
];

// Rutas de reportes donde aparecen los filtros
const REPORT_ROUTES = [
  "/dashboard/resumen-comercial",
  "/dashboard/cartera",
  "/dashboard/eficiencia",
  "/dashboard/clinico",
  "/dashboard/inventario",
];

interface Props {
  sucursales: MiSucursal[];
}

export function DashboardHeader({ sucursales }: Props) {
  const pathname = usePathname();

  const isConfig = CONFIG_ROUTES.some((r) => pathname.startsWith(r));
  const isReport = REPORT_ROUTES.some((r) => pathname.startsWith(r));

  // Ocultar en configuración o en rutas que no son de reporte
  if (isConfig || !isReport) return null;

  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
        "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0",
        "[html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden",
        "[html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50",
        "[html[data-navbar-style=sticky]_&]:backdrop-blur-md",
      )}
    >
      <div className="flex w-full items-center justify-end px-4 lg:px-6">
        <ReportFilters sucursales={sucursales} />
      </div>
    </header>
  );
}
