import { cn } from "@educa-escola/ui/lib/utils";
import type * as React from "react";

/**
 * O card do Integra: 22px de raio, fundo branco, **sem sombra**.
 *
 * A separação vem do azul do fundo contra o branco do card — é a decisão do
 * mockup. Um `shadow-sm` aqui já descaracteriza a identidade inteira, por isso
 * a elevação não é uma variante deste componente.
 */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-card bg-card p-6", className)} {...props} />;
}

// `title` do DOM é string (o tooltip do navegador); aqui é conteúdo renderado,
// então a propriedade nativa sai do tipo em vez de brigar com ela.
interface PanelHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode;
  /** Texto de apoio ao lado do título, no tom de metadado. */
  hint?: React.ReactNode;
  action?: React.ReactNode;
}

export function PanelHeader({ title, hint, action, className, ...props }: PanelHeaderProps) {
  return (
    <div
      className={cn("mb-4 flex flex-wrap items-center justify-between gap-3", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-extrabold text-base tracking-[-0.2px]">{title}</h2>
        {hint ? <span className="text-[13px] text-muted-foreground">{hint}</span> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Rótulo caixa-alta de 10px — `INSTITUIÇÃO`, `ALUNO`, `ANO LETIVO`. */
export function Eyebrow({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "font-bold text-[10px] text-muted-foreground uppercase tracking-[0.7px]",
        className,
      )}
      {...props}
    />
  );
}
