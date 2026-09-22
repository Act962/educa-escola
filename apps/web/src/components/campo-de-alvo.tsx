import type { EventScope } from "@educa-escola/api/modules/calendar/schema";
import { Label } from "@educa-escola/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";

export interface Turma {
  id: string;
  name: string;
}

/** O `Select` não aceita valor vazio, então "toda a escola" precisa de rótulo. */
const INSTITUCIONAL = "institucional";

/**
 * A quem o evento do calendário pertence: a escola inteira ou uma turma.
 *
 * Um `Select` só, e não uma caixa de marcar mais um campo de turma: as duas
 * opções são exclusivas, e separá-las permitiria representar o estado sem
 * sentido de "toda a escola, turma 9º C" — que é exatamente o que o servidor
 * recusa. Aqui esse estado não chega a existir.
 */
export function CampoDeAlvo({
  id,
  turmas,
  valor,
  aoMudar,
  rotulo = "Vale para",
}: {
  id: string;
  turmas: Turma[];
  /** `null` é a escola inteira. */
  valor: string | null;
  aoMudar: (turmaId: string | null) => void;
  rotulo?: string;
}) {
  const opcoes = [
    { label: "Toda a escola", value: INSTITUCIONAL },
    ...turmas.map((turma) => ({ label: turma.name, value: turma.id })),
  ];

  return (
    <div className="flex min-w-44 flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Select
        value={valor ?? INSTITUCIONAL}
        onValueChange={(v) => aoMudar(!v || v === INSTITUCIONAL ? null : v)}
        items={opcoes}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((opcao) => (
            <SelectItem key={opcao.value} value={opcao.value}>
              {opcao.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * `null` -> escola inteira; id -> turma.
 *
 * Uma tradução só, usada pelos três lugares que criam ou editam evento. Cada
 * um montando o par `scope`/`classroomId` à mão seria três chances de mandar
 * escopo de turma sem turma, que o servidor recusa com razão.
 */
export function alvoDe(turmaId: string | null): { scope: EventScope; classroomId?: string } {
  return turmaId ? { scope: "turma", classroomId: turmaId } : { scope: "institucional" };
}
