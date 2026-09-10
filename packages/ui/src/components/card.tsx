import { cn } from "@educa-escola/ui/lib/utils";
import type * as React from "react";

/**
 * Card do shadcn, ajustado à identidade do Integra Edu.
 *
 * O que muda em relação ao componente original: raio de 22px em vez de
 * `rounded-none`, padding de 24px e **nenhuma sombra ou anel**. A separação
 * vem do azul do fundo contra o branco do card — é a decisão do mockup, e um
 * `ring-1` aqui já descaracteriza a tela inteira.
 *
 * A API (Card, CardHeader, CardTitle…) é a do shadcn de propósito: quem já
 * conhece o componente não precisa aprender outro.
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) rounded-card bg-card p-(--card-spacing) text-card-foreground [--card-spacing:--spacing(6)] data-[size=sm]:[--card-spacing:--spacing(4)]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header flex flex-wrap items-center justify-between gap-x-3 gap-y-2",
        className,
      )}
      {...props}
    />
  );
}

/** 16px, extrabold, tracking negativo: o "Título de card" da escala do UI kit. */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-extrabold text-base tracking-[-0.2px]", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-[13px] text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("min-w-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3 border-border border-t pt-4", className)}
      {...props}
    />
  );
}

/** Rótulo caixa-alta de 10px — `INSTITUIÇÃO`, `ALUNO`, `ANO LETIVO`. */
function CardEyebrow({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="card-eyebrow"
      className={cn(
        "font-bold text-[10px] text-muted-foreground uppercase tracking-[0.7px]",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
};
