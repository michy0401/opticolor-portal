"use client";

import {
  Archive,
  BarChart2,
  DollarSign,
  type LucideIcon,
  Tag,
  TrendingUp,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  "archive":      Archive,
  "dollar-sign":  DollarSign,
  "trending-up":  TrendingUp,
  "bar-chart-2":  BarChart2,
  "tag":          Tag,
};

const COLOR_VARIANTS = {
  blue:    "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  amber:   "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  violet:  "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
  orange:  "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  cyan:    "bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
  rose:    "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  slate:   "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  muted:   "bg-muted text-muted-foreground",
} as const;

type ColorVariant = keyof typeof COLOR_VARIANTS;

interface KpiCardProps {
  title: string;
  value: string;
  fullValue?: string;
  subtitle?: string;
  iconName?: string;
  color?: ColorVariant;
  className?: string;
  highlight?: boolean;
}

export function KpiCard({
  title,
  value,
  fullValue,
  subtitle,
  iconName,
  color = "muted",
  className,
  highlight = false,
}: KpiCardProps) {
  const Icon = iconName ? ICON_MAP[iconName] : undefined;

  const iconClass = highlight
    ? "bg-primary/15 text-primary"
    : COLOR_VARIANTS[color];

  const ValueEl = (
    <p
      className={cn(
        "mt-4 text-2xl font-bold tabular-nums leading-none",
        fullValue && "cursor-default underline decoration-dashed decoration-muted-foreground/40 underline-offset-4",
        highlight && "text-primary",
      )}
    >
      {value}
    </p>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card p-5 shadow-md transition-shadow hover:shadow-lg",
        highlight && "border-primary/30 bg-primary/5",
        className,
      )}
    >
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
