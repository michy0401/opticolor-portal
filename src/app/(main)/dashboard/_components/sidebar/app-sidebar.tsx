"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useSession } from "next-auth/react";
import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { cn } from "@/lib/utils";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

// ─── Botón de colapso interno ────────────────────────────────────────────────
function SidebarToggle() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Expandir menú" : "Contraer menú"}
          >
            {isCollapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft  className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {isCollapsed ? "Expandir" : "Contraer"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Sidebar principal ────────────────────────────────────────────────────────
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant:    s.sidebarVariant,
      sidebarCollapsible: s.sidebarCollapsible,
      isSynced:          s.isSynced,
    })),
  );

  const { data: session } = useSession();
  const isSupervisor = session?.user?.nivel === 4 || session?.user?.rol === "SUPERVISOR";

  const filteredSidebarItems = sidebarItems.filter((group) => {
    if (isSupervisor && group.label === "Configuración") return false;
    return true;
  });

  const variant    = isSynced ? sidebarVariant    : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Contenedor con transición suave al colapsar */}
            <div
              className={cn(
                "flex items-center transition-all duration-300",
                isCollapsed ? "justify-center flex-col gap-2 py-1" : "justify-between gap-1",
              )}
            >
              {/* Logo + título (oculto en modo icono) */}
              {!isCollapsed ? (
                <SidebarMenuButton asChild size="lg" className="flex-1 overflow-hidden">
                  <Link
                    prefetch={false}
                    href="/dashboard/resumen-comercial"
                    className="flex items-center gap-3"
                  >
                    <Image
                      src="/favicon.ico"
                      alt="Opticolor Logo"
                      width={24}
                      height={24}
                      className="rounded-sm shrink-0"
                    />
                    <span className="font-semibold text-lg truncate">OPTICOLOR - BI</span>
                  </Link>
                </SidebarMenuButton>
              ) : (
                // Solo favicon cuando está contraído
                <Link prefetch={false} href="/dashboard/resumen-comercial">
                  <Image
                    src="/favicon.ico"
                    alt="Opticolor Logo"
                    width={24}
                    height={24}
                    className="rounded-sm"
                  />
                </Link>
              )}

              {/* Toggle siempre visible */}
              <SidebarToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={filteredSidebarItems} />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
