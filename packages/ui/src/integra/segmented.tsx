import type { BadgeTone } from "@educa-escola/ui/components/badge";
import { cn } from "@educa-escola/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useId } from "react";

const ACTIVE_TONE: Partial<Record<BadgeTone, string>> = {
  success: "peer-checked:bg-success peer-checked:text-card",
  warning: "peer-checked:bg-warning-soft peer-checked:text-warning",
  danger: "peer-checked:bg-danger peer-checked:text-card",
  info: "peer-checked:bg-info peer-checked:text-card",
  neutral: "peer-checked:bg-secondary-foreground peer-checked:text-card",
};

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  tone: BadgeTone;
  /**
   * Quantidade ao lado do rótulo — "Pendentes 5".
   *
   * Campo próprio, e não um `label` já concatenado: emendado no texto ele
   * quebra no meio quando falta largura ("Pendentes" numa linha, "· 5" na
   * outra), e o leitor de tela anuncia o separador como se fosse nome.
   */
  count?: number;
  /** Só com `apenasIcone`. O rótulo vira nome acessível e dica. */
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  /** Rótulo do grupo para leitor de tela: "Presença de Alice Barreto". */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /**
   * Mostra só o ícone de cada opção.
   *
   * Para escolhas em que a opção **não** é o assunto da tela — lista contra
   * quadro é sobre como olhar, não sobre o que se está olhando. Escolha de
   * conteúdo continua em palavras: ícone de "Pendentes" seria adivinhação.
   */
  apenasIcone?: boolean;
  className?: string;
}

/**
 * Trilho de opções mutuamente exclusivas — presente/falta/atraso na chamada.
 *
 * Não usa o `ToggleGroup` do shadcn de propósito: toggle é estado ligado ou
 * desligado, e aqui a escolha é exclusiva e obrigatória. Por baixo são
 * `input[type=radio]` de verdade, escondidos visualmente, então a navegação
 * por seta, o agrupamento e o anúncio "1 de 3" vêm do navegador em vez de
 * serem reimplementados.
 *
 * Visualmente segue o trilho das `Tabs`: mesmo raio, mesma altura.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  apenasIcone,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();

  return (
    /*
     * `flex-wrap` porque o trilho não cabe num celular quando tem quatro
     * opções com contador. O que quebra é a linha entre opções, nunca o texto
     * dentro de uma: "Pendent…" — ou "Pendentes" com "· 5" embaixo — numa
     * escolha obrigatória é pior que uma segunda linha, porque a pessoa
     * precisa ler as opções inteiras para escolher.
     */
    <fieldset
      className={cn(
        "flex flex-wrap gap-1 rounded-control bg-muted p-1",
        apenasIcone && "shrink-0 flex-nowrap",
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const Icone = option.icon;

        return (
          <label
            key={option.value}
            /*
             * `flex-1` sem `min-w-0`: a opção cresce para dividir a linha, e
             * `min-width: auto` — que aqui é justamente o que se quer — a
             * impede de ficar menor que o próprio rótulo.
             */
            className={cn(
              "relative flex cursor-pointer items-center has-disabled:cursor-not-allowed has-disabled:opacity-50",
              apenasIcone ? "flex-none" : "flex-1 sm:flex-none",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
              aria-label={apenasIcone ? option.label : undefined}
            />
            <span
              title={apenasIcone ? option.label : undefined}
              className={cn(
                "flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-field font-bold text-corpo text-muted-foreground transition-colors sm:min-h-9",
                apenasIcone ? "px-3.5" : "px-3",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2",
                ACTIVE_TONE[option.tone],
              )}
            >
              {Icone ? <Icone size={18} strokeWidth={1.8} aria-hidden /> : null}
              {apenasIcone ? <span className="sr-only">{option.label}</span> : option.label}
              {/*
                O contador herda a cor do estado ativo com opacidade, em vez de
                uma cor própria: no trilho selecionado o fundo muda, e um tom
                fixo aqui ficaria ilegível em metade das variantes.
              */}
              {!apenasIcone && option.count !== undefined ? (
                <span className="font-extrabold tabular-nums opacity-60">{option.count}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
