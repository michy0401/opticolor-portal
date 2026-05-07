"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Rule {
  label: string;
  test: (v: string) => boolean;
}

const RULES: Rule[] = [
  { label: "Mínimo 8 caracteres",          test: (v) => v.length >= 8 },
  { label: "Al menos una letra mayúscula", test: (v) => /[A-Z]/.test(v) },
  { label: "Al menos una letra minúscula", test: (v) => /[a-z]/.test(v) },
  { label: "Al menos un número",           test: (v) => /[0-9]/.test(v) },
  { label: "Al menos un símbolo (!@#$%…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

interface Props {
  password: string;
  className?: string;
}

export function PasswordChecklist({ password, className }: Props) {
  if (!password) return null;

  return (
    <ul className={cn("flex flex-col gap-1 mt-1.5", className)}>
      {RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors duration-150",
              met
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            )}
          >
            {met
              ? <Check className="h-3 w-3 shrink-0" />
              : <X className="h-3 w-3 shrink-0 opacity-40" />
            }
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
