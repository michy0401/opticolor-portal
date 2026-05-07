"use client";

import { useState } from "react";
import { EllipsisVertical, LogOut, Monitor, Moon, Settings, Sun, UserCircle } from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { persistPreference } from "@/lib/preferences/preferences-storage";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { getInitials } from "@/lib/utils";

import { LayoutControlsContent } from "./layout-controls";

const THEME_CYCLE = ["light", "dark", "system"] as const;
type ThemeMode = (typeof THEME_CYCLE)[number];

const THEME_LABELS: Record<ThemeMode, string> = {
  light:  "Claro",
  dark:   "Oscuro",
  system: "Sistema",
};

export function NavUser() {
  const { isMobile } = useSidebar();
  const { data: session } = useSession();
  const [prefsOpen, setPrefsOpen] = useState(false);

  const themeMode  = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

  const user   = session?.user;
  const name   = user?.name  || "Usuario";
  const email  = user?.email || "";
  const avatar = user?.image || "";

  const cycleTheme = () => {
    const idx       = THEME_CYCLE.indexOf(themeMode as ThemeMode);
    const nextTheme = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setThemeMode(nextTheme);
    void persistPreference("theme_mode", nextTheme);
  };

  const ThemeIcon =
    themeMode === "system" ? Monitor :
    themeMode === "dark"   ? Sun     : Moon;

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg grayscale">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="rounded-lg">{getInitials(name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-muted-foreground text-xs">{email}</span>
                </div>
                <EllipsisVertical className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              {/* Cabecera con avatar */}
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="rounded-lg">{getInitials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-muted-foreground text-xs">{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {/* Opciones de cuenta */}
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/perfil" prefetch={false} className="w-full cursor-pointer">
                    <UserCircle />
                    Mi Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPrefsOpen(true)} className="cursor-pointer">
                  <Settings />
                  Configuración de Cuenta
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              {/* Alternar Tema */}
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  onClick={cycleTheme}
                  className="cursor-pointer"
                >
                  <ThemeIcon />
                  Alternar Tema
                  <span className="ml-auto text-xs text-muted-foreground">
                    {THEME_LABELS[themeMode as ThemeMode] ?? themeMode}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="cursor-pointer"
              >
                <LogOut />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Diálogo de preferencias de visualización */}
      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configuración de Cuenta</DialogTitle>
            <DialogDescription>
              Personaliza las preferencias de visualización del portal.
            </DialogDescription>
          </DialogHeader>
          <LayoutControlsContent />
        </DialogContent>
      </Dialog>
    </>
  );
}
