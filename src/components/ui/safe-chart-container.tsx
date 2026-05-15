"use client";

import { useEffect, useState } from "react";

interface SafeChartContainerProps {
  /** Height applied to both the skeleton and the live chart wrapper. */
  height?: string;
  /** Extra Tailwind classes merged into the outer div (e.g. 'w-52 shrink-0'). */
  className?: string;
  children: React.ReactNode;
}

/**
 * SafeChartContainer
 *
 * Recharts' ResponsiveContainer reads its parent's pixel dimensions via the
 * ResizeObserver API, which is unavailable during SSR and may report
 * width=-1 / height=-1 on the first client render before the browser has
 * painted the layout.
 *
 * This wrapper:
 *  1. Renders a placeholder skeleton during SSR and before hydration.
 *  2. Swaps in the real chart (with an explicit pixel-height container) only
 *     after the component is mounted on the client — guaranteeing that the
 *     ResizeObserver will always find non-zero dimensions.
 *  3. Uses a subtle fade-in so the transition feels intentional, not jarring.
 */
export function SafeChartContainer({
  height = "h-[350px]",
  className = "",
  children,
}: SafeChartContainerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        className={`${height} ${className} animate-pulse rounded-xl bg-muted`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`${height} ${className} transition-opacity duration-300 ease-in`}
      style={{ opacity: 1 }}
    >
      {children}
    </div>
  );
}
