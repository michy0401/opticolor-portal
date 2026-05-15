"use client";

import {
  Archive,
  BarChart2,
  BarChart3,
  CreditCard,
  DollarSign,
  Eye,
  type LucideIcon,
  ShoppingCart,
  Tag,
  TrendingUp,
  UserPlus,
  Wallet,
  Percent,
  AlertTriangle,
  ClipboardList,
  FileText,
  PackageCheck,
  Package,
  Activity,
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  Clipboard,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  "archive":        Archive,
  "bar-chart-2":    BarChart2,
  "dollar-sign":    DollarSign,
  "trending-up":    TrendingUp,
  "credit-card":    CreditCard,
  "bar-chart-3":    BarChart3,
  "shopping-cart":  ShoppingCart,
  "eye":            Eye,
  "tag":            Tag,
  "user-plus":      UserPlus,
  "wallet":         Wallet,
  "percent":        Percent,
  "alert-triangle": AlertTriangle,
  "clipboard-list": ClipboardList,
  "file-text":      FileText,
  "package-check":  PackageCheck,
  "package":        Package,
  "activity":       Activity,
  "users":          Users,
  "check-circle":   CheckCircle,
  "x-circle":       XCircle,
  "calendar":       Calendar,
  "clipboard":      Clipboard,
};

// Premium grayscale theme for icons using design system tokens
const ICON_THEME = "bg-secondary text-secondary-foreground";

interface KpiCardProps {
  title: string;
  value: string;
  fullValue?: string;
  subtitle?: string;
  iconName?: string;
  className?: string;
  highlight?: boolean;
}

export function KpiCard({
  title,
  value,
  fullValue,
  subtitle,
  iconName,
  className,
  highlight = false,
}: KpiCardProps) {
  const Icon = iconName ? ICON_MAP[iconName] : undefined;

  const iconClass = highlight
    ? "bg-primary text-primary-foreground"
    : ICON_THEME;

  const ValueEl = (
    <p
      className={cn(
        "mt-4 text-2xl font-bold tabular-nums leading-none",
        fullValue && "cursor-default underline decoration-dashed decoration-muted-foreground/40 underline-offset-4",
        highlight && "text-foreground",
      )}
    >
      {value}
    </p>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/50",
        highlight && "border-primary/50 bg-primary/5 shadow-md",
        className,
      )}
    >
      {/* Cabecera: label + ícono circular */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
          {title}
        </p>
        {Icon && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", iconClass)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Valor con Tooltip opcional */}
      {fullValue ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{ValueEl}</TooltipTrigger>
            <TooltipContent side="bottom" className="font-medium">
              {fullValue}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        ValueEl
      )}

      {subtitle && (
        <p className="mt-2 text-[11px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
