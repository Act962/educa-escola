import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";

import { TERMS, type Term, useSchoolContext } from "@/lib/school-context";

/**
 * O seletor de bimestre, num lugar só.
 *
 * Ele aparece em dois pontos — no cabeçalho do desktop e dentro do `Sheet` no
 * celular — e as duas cópias precisavam concordar sobre o rótulo, os valores e
 * o nome acessível. Duas listas de bimestre divergiriam no dia em que a escola
 * passasse a ter trimestre, e a divergência apareceria como "no celular tem 4,
 * no computador tem 3".
 *
 * `items` faz o gatilho mostrar o rótulo ("3º bimestre") em vez do valor cru
 * ("3") — é como o Base UI resolve o texto do selecionado.
 */
export function TermSelector({ className }: { className?: string }) {
  const { term, setTerm } = useSchoolContext();

  return (
    <Select
      items={TERMS.map((option) => ({ value: String(option), label: `${option}º bimestre` }))}
      value={String(term)}
      onValueChange={(value) => setTerm(Number(value) as Term)}
    >
      <SelectTrigger size="sm" aria-label="Bimestre" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TERMS.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {option}º bimestre
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
