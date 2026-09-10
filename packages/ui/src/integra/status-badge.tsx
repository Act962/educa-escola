import { cn } from "@educa-escola/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

/**
 * Etiqueta de situação.
 *
 * A cor nunca é a única portadora do sentido: o texto dentro do badge diz o
 * que está acontecendo ("Chamada pendente", "Recuperação"). É requisito de
 * acessibilidade e é também o que faz a tela funcionar impressa em preto.
 */
const statusBadge = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-bold text-xs",
  {
    variants: {
      tone: {
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        neutral: "bg-secondary text-secondary-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type StatusTone = NonNullable<VariantProps<typeof statusBadge>["tone"]>;

export function StatusBadge({
  tone,
  className,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusBadge>) {
  return <span className={cn(statusBadge({ tone, className }))} {...props} />;
}
