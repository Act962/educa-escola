import type { BadgeTone } from "@educa-escola/ui/components/badge";
import { cn } from "@educa-escola/ui/lib/utils";
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
}

interface SegmentedControlProps<T extends string> {
  /** Rótulo do grupo para leitor de tela: "Presença de Alice Barreto". */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
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
  className,
}: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <fieldset className={cn("flex gap-1 rounded-control bg-muted p-1", className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="relative flex flex-1 cursor-pointer items-center has-disabled:cursor-not-allowed has-disabled:opacity-50 sm:flex-none"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex min-h-11 w-full items-center justify-center rounded-field px-3 font-bold text-[13px] text-muted-foreground transition-colors sm:min-h-9",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2",
              ACTIVE_TONE[option.tone],
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
