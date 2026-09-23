import { cn } from "@educa-escola/ui/lib/utils";

interface PassosProps {
  /** 1-based: a etapa que está aberta agora. */
  atual: number;
  total: number;
  /** Nome da etapa atual, lido junto com o número. */
  label: string;
  className?: string;
}

/**
 * Indicador de etapa de formulário longo.
 *
 * O design brief pede a matrícula como formulário em etapas, e o shadcn não
 * traz um stepper. São barras e não bolinhas numeradas porque em tela estreita
 * a fileira de números quebra, e o que importa é o progresso, não o rótulo de
 * cada passo.
 *
 * O `role="progressbar"` é o que faz o leitor de tela anunciar "2 de 3" — sem
 * ele a informação existiria só como cor, que o brief §8 proíbe.
 */
export function Passos({ atual, total, label, className }: PassosProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className="flex items-center gap-2"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={atual}
        aria-valuetext={`Etapa ${atual} de ${total}: ${label}`}
      >
        {Array.from({ length: total }, (_, indice) => indice + 1).map((passo) => (
          <span
            key={passo}
            aria-hidden
            className={cn(
              "h-1.5 flex-1 rounded-full",
              passo === atual && "bg-primary",
              passo < atual && "bg-accent",
              passo > atual && "bg-secondary",
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-meta text-muted-foreground">
        <span>
          Etapa {atual} de {total}
        </span>
        <span className="font-bold text-info">{label}</span>
      </div>
    </div>
  );
}
