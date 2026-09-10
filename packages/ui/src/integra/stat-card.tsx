import { Card } from "@educa-escola/ui/components/card";
import { cn } from "@educa-escola/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

const iconBox = cva("flex size-[34px] items-center justify-center rounded-control", {
  variants: {
    tone: {
      info: "bg-info-soft text-info",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
      neutral: "bg-secondary text-secondary-foreground",
    },
  },
  defaultVariants: { tone: "info" },
});

const value = cva("font-extrabold text-3xl tracking-[-0.6px]", {
  variants: {
    tone: {
      info: "text-foreground",
      success: "text-foreground",
      warning: "text-warning",
      danger: "text-danger",
      neutral: "text-foreground",
    },
  },
  defaultVariants: { tone: "info" },
});

interface StatCardProps extends VariantProps<typeof iconBox> {
  icon: LucideIcon;
  /** O número, já formatado. O card não sabe formatar nada. */
  children: React.ReactNode;
  label: string;
  hint?: string;
  className?: string;
}

/**
 * Número em destaque do painel: caixa de ícone, valor e rótulo.
 *
 * Composição sobre o `Card` do shadcn — não é um primitivo novo, é o mesmo
 * card com um arranjo que se repete em todas as três visões.
 *
 * O `tone` colore o valor quando ele é uma pendência (chamada em atraso,
 * inadimplência), mas o rótulo continua dizendo o que é: a cor só reforça.
 */
export function StatCard({ icon: Icon, children, label, hint, tone, className }: StatCardProps) {
  return (
    <Card className={cn("gap-3", className)}>
      <span className={cn(iconBox({ tone }))}>
        <Icon size={18} strokeWidth={1.7} aria-hidden />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className={cn(value({ tone }))}>{children}</span>
        <span className="text-[13px] text-muted-foreground">{label}</span>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
    </Card>
  );
}
