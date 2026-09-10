import { cn } from "@educa-escola/ui/lib/utils";

export interface ComparisonRow {
  label: string;
  /** Série em destaque (lavanda). `null` quando não há nota lançada. */
  value: number | null;
  /** Série de comparação (amarelo): bimestre anterior ou média da turma. */
  reference: number | null;
  /** Marca o valor em vermelho quando está abaixo do esperado. */
  alert?: boolean;
}

interface BarComparisonProps {
  rows: ComparisonRow[];
  /** Nome das duas séries, para a legenda e para o leitor de tela. */
  series: [string, string];
  max?: number;
  className?: string;
}

const TICKS = [0, 2, 4, 6, 8, 10];

/**
 * Duas barras por linha, na ordem de cor definida pelos tokens `--chart-*`:
 * lavanda para o período atual, amarelo para o de comparação.
 *
 * Cada linha também expõe o número à direita — a barra é reforço visual, não a
 * única forma de ler o dado.
 */
export function BarComparison({ rows, series, max = 10, className }: BarComparisonProps) {
  const width = (value: number | null) =>
    value === null ? "0%" : `${Math.min(100, (value / max) * 100)}%`;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3">
            <span className="truncate font-bold text-[13px]">{row.label}</span>
            {/* As barras são reforço visual. O conteúdo textual abaixo é o que
                o leitor de tela anuncia — comprimento de div não se lê. */}
            <span className="flex flex-col gap-1.5" aria-hidden>
              <span className="h-2.5 rounded-full bg-chart-1" style={{ width: width(row.value) }} />
              <span
                className="h-2.5 rounded-full bg-chart-2"
                style={{ width: width(row.reference) }}
              />
            </span>
            <span className="sr-only">
              {series[0]}: {row.value ?? "sem nota"}. {series[1]}: {row.reference ?? "sem nota"}.
            </span>
            <span
              className={cn(
                "text-right font-extrabold text-sm",
                row.alert ? "text-danger" : "text-foreground",
              )}
            >
              {row.value === null ? "—" : row.value.toFixed(1).replace(".", ",")}
            </span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-[7rem_1fr_3rem] gap-3">
        <span />
        <span className="flex justify-between font-bold text-[11px] text-muted-foreground">
          {TICKS.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </span>
        <span />
      </div>
    </div>
  );
}

export function ChartLegend({ series }: { series: [string, string] }) {
  return (
    <span className="flex items-center gap-4 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-chart-1" aria-hidden />
        {series[0]}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-chart-2" aria-hidden />
        {series[1]}
      </span>
    </span>
  );
}
