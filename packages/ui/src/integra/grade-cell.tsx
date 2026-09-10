import { cn } from "@educa-escola/ui/lib/utils";

interface GradeCellProps {
  label: string;
  value: number | null;
  onChange?: (value: number | null) => void;
  /** Avaliação já publicada: a célula vira leitura, sem virar cinza ilegível. */
  locked?: boolean;
  /** Falta lançar e o lançamento é obrigatório para publicar. */
  required?: boolean;
}

/** "7,5" e "7.5" chegam do teclado; o domínio só conhece número. */
function parseScore(raw: string): number | null {
  const normalized = raw.replace(",", ".").trim();
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatScore(value: number | null): string {
  return value === null ? "" : value.toFixed(1).replace(".", ",");
}

/**
 * Célula da grade de notas.
 *
 * Quatro estados visuais, e o que os distingue nunca é só a cor: a célula
 * vazia obrigatória tem borda tracejada, a travada perde a borda de campo e
 * ganha `readOnly` (o leitor de tela anuncia). Aceita vírgula, que é como
 * professor digita nota no Brasil.
 */
export function GradeCell({ label, value, onChange, locked, required }: GradeCellProps) {
  const empty = value === null;

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      readOnly={locked || !onChange}
      defaultValue={formatScore(value)}
      onBlur={(event) => {
        if (!onChange) return;
        const parsed = parseScore(event.target.value);
        event.target.value = formatScore(parsed);
        onChange(parsed);
      }}
      className={cn(
        "h-9 w-20 rounded-field text-center font-bold text-[13px] tabular-nums",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
        locked && "bg-muted text-muted-foreground",
        !locked && !empty && "border border-input bg-card",
        !locked && empty && required && "border border-warning border-dashed bg-warning-soft",
        !locked && empty && !required && "border border-input border-dashed bg-card",
      )}
      placeholder={empty ? "—" : undefined}
    />
  );
}
