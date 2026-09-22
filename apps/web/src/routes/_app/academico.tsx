import { STAGE_LABEL, type Stage } from "@educa-escola/api/modules/academic/schema";
import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Check, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";

import { integerText } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/academico")({
  component: Academico,
});

const TIPOS = {
  obrigatoria: { rotulo: "Obrigatória", variante: "info" },
  eletiva: { rotulo: "Eletiva", variante: "secondary" },
  complementar: { rotulo: "Complementar", variante: "secondary" },
} as const;

/**
 * Catálogo de disciplinas e grade curricular (§5.6).
 *
 * A grade é montada **por série, não por turma**: 8º A e 8º B cursam a mesma
 * coisa. Amarrar por turma obrigaria a secretaria a repetir a montagem para
 * cada turma da série, e as duas divergiriam no primeiro esquecimento.
 */
function Academico() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { year } = useSchoolContext();
  const [nova, setNova] = useState("");
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);

  const disciplinas = useQuery(trpc.academic.subjects.queryOptions());
  const grade = useQuery(trpc.academic.curriculum.queryOptions({ academicYear: year }));

  const recarregar = () => queryClient.invalidateQueries({ queryKey: [["academic"]] });
  const criar = useMutation(
    trpc.academic.createSubject.mutationOptions({
      onSuccess: () => {
        setNova("");
        recarregar();
      },
    }),
  );
  const renomear = useMutation(
    trpc.academic.updateSubject.mutationOptions({
      onSuccess: () => {
        setEditando(null);
        recarregar();
      },
    }),
  );
  const excluir = useMutation(
    trpc.academic.removeSubject.mutationOptions({ onSuccess: recarregar }),
  );
  const por = useMutation(trpc.academic.setCurriculum.mutationOptions({ onSuccess: recarregar }));
  const tirar = useMutation(
    trpc.academic.removeFromCurriculum.mutationOptions({ onSuccess: recarregar }),
  );

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Instituição</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Acadêmico</h1>
        <p className="text-corpo text-muted-foreground">
          O catálogo de disciplinas e o que cada série cursa em {year}.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <CardEyebrow>Disciplinas</CardEyebrow>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-56 flex-1 flex-col gap-2">
            <Label htmlFor="nova-disciplina">Nova disciplina</Label>
            <Input
              id="nova-disciplina"
              value={nova}
              onChange={(evento) => setNova(evento.target.value)}
              placeholder="Educação Física"
              maxLength={80}
            />
          </div>
          <Button
            onClick={() =>
              criar.mutate({
                name: nova,
                kind: "obrigatoria",
                composesAverage: true,
                tracksAttendance: true,
              })
            }
            disabled={criar.isPending || nova.trim().length < 2}
          >
            <Plus size={18} strokeWidth={1.8} aria-hidden />
            Acrescentar
          </Button>
        </div>

        {criar.isError || renomear.isError || excluir.isError ? (
          <Alert variant="danger">
            <AlertTitle>Não foi possível salvar</AlertTitle>
            <AlertDescription>
              {(criar.error ?? renomear.error ?? excluir.error)?.message}
            </AlertDescription>
          </Alert>
        ) : null}

        {disciplinas.isLoading ? (
          <ListSkeleton rows={3} />
        ) : disciplinas.isError ? (
          <ErrorState
            title="Não foi possível carregar as disciplinas"
            description="Atualize a página em instantes."
          />
        ) : disciplinas.data?.length === 0 ? (
          <EmptyState
            title="Nenhuma disciplina no catálogo"
            description="Crie as disciplinas antes de montar a grade de cada série."
          />
        ) : (
          <ul className="flex flex-col">
            {disciplinas.data?.map((disciplina) => (
              <li
                key={disciplina.id}
                className="flex flex-wrap items-center gap-3 border-border border-t py-2.5 text-corpo first:border-t-0"
              >
                {editando?.id === disciplina.id ? (
                  <>
                    <Input
                      value={editando.nome}
                      onChange={(e) => setEditando({ id: disciplina.id, nome: e.target.value })}
                      className="max-w-64"
                      aria-label={`Novo nome de ${disciplina.name}`}
                    />
                    <Button
                      size="sm"
                      onClick={() => renomear.mutate({ id: disciplina.id, name: editando.nome })}
                      disabled={renomear.isPending || editando.nome.trim().length < 2}
                    >
                      <Check size={16} strokeWidth={1.8} aria-hidden />
                      Salvar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditando(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate font-bold">{disciplina.name}</span>
                    <Badge variant={TIPOS[disciplina.kind].variante}>
                      {TIPOS[disciplina.kind].rotulo}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Renomear ${disciplina.name}`}
                      onClick={() => setEditando({ id: disciplina.id, nome: disciplina.name })}
                    >
                      <Pencil size={16} strokeWidth={1.8} aria-hidden />
                    </Button>
                    {/* Excluir é recusado pelo servidor quando há aula dada —
                        a mensagem manda tirar da grade, que é reversível. */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir ${disciplina.name}`}
                      onClick={() => excluir.mutate({ id: disciplina.id })}
                      disabled={excluir.isPending}
                    >
                      <X size={16} strokeWidth={1.8} aria-hidden />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {grade.isLoading ? (
        <Card>
          <ListSkeleton rows={4} />
        </Card>
      ) : grade.isError ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar a grade"
            description="Atualize a página em instantes."
          />
        </Card>
      ) : grade.data?.length === 0 ? (
        <Card>
          <EmptyState
            title={`Nenhuma série com turma em ${year}`}
            description="A grade se monta para série que tem turma. Crie turmas e informe a série de cada uma."
          />
        </Card>
      ) : (
        grade.data?.map((serie) => (
          <SerieDaGrade
            key={`${serie.stage}-${serie.gradeLevel}`}
            serie={serie}
            ano={year}
            disciplinas={disciplinas.data ?? []}
            aoPor={(subjectId, weeklyHours) =>
              por.mutate({
                academicYear: year,
                stage: serie.stage,
                gradeLevel: serie.gradeLevel,
                subjectId,
                weeklyHours,
              })
            }
            aoTirar={(id) => tirar.mutate({ id })}
            ocupado={por.isPending || tirar.isPending}
          />
        ))
      )}
    </>
  );
}

interface SerieProps {
  serie: {
    stage: Stage;
    gradeLevel: number;
    turmas: number;
    aulasPorSemana: number;
    disciplinas: {
      id: string;
      subjectId: string;
      nome: string;
      sigla: string | null;
      tipo: string;
      aulasPorSemana: number;
    }[];
  };
  ano: number;
  disciplinas: { id: string; name: string }[];
  aoPor: (subjectId: string, weeklyHours: number) => void;
  aoTirar: (id: string) => void;
  ocupado: boolean;
}

/** A grade de uma série: o que ela cursa e quantas aulas de cada coisa. */
function SerieDaGrade({ serie, disciplinas, aoPor, aoTirar, ocupado }: SerieProps) {
  const [escolhida, setEscolhida] = useState("");
  const [aulas, setAulas] = useState("2");

  const jaNaGrade = new Set(serie.disciplinas.map((d) => d.subjectId));
  const disponiveis = disciplinas.filter((d) => !jaNaGrade.has(d.id));

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <CardEyebrow>
          {serie.gradeLevel}º ano · {STAGE_LABEL[serie.stage]}
        </CardEyebrow>
        <span className="text-meta text-muted-foreground">
          {integerText(serie.turmas)} turma{serie.turmas > 1 ? "s" : ""}
        </span>
        <span className="ml-auto font-bold text-corpo">
          {integerText(serie.aulasPorSemana)} aulas por semana
        </span>
      </div>

      {serie.disciplinas.length === 0 ? (
        <EmptyState
          title="Grade em branco"
          description="Acrescente as disciplinas que esta série cursa."
        />
      ) : (
        <ul className="flex flex-col">
          {serie.disciplinas.map((disciplina) => (
            <li
              key={disciplina.id}
              className="flex items-center gap-3 border-border border-t py-2.5 text-corpo first:border-t-0"
            >
              <BookOpen size={16} strokeWidth={1.7} aria-hidden className="text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-bold">{disciplina.nome}</span>
              <span className="text-muted-foreground">
                {integerText(disciplina.aulasPorSemana)} aula
                {disciplina.aulasPorSemana > 1 ? "s" : ""}/semana
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Tirar ${disciplina.nome} da grade`}
                onClick={() => aoTirar(disciplina.id)}
                disabled={ocupado}
              >
                <X size={16} strokeWidth={1.8} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {disponiveis.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-48 flex-1 flex-col gap-2">
            <Label htmlFor={`disciplina-${serie.gradeLevel}-${serie.stage}`}>Acrescentar</Label>
            {/* `items` é exigência do Base UI: sem ele o gatilho mostra o
                valor cru (o id) em vez do nome da disciplina. */}
            <Select
              value={escolhida}
              onValueChange={(valor) => setEscolhida(valor ?? "")}
              items={disponiveis.map((d) => ({ label: d.name, value: d.id }))}
            >
              <SelectTrigger id={`disciplina-${serie.gradeLevel}-${serie.stage}`}>
                <SelectValue placeholder="Escolha a disciplina" />
              </SelectTrigger>
              <SelectContent>
                {disponiveis.map((disciplina) => (
                  <SelectItem key={disciplina.id} value={disciplina.id}>
                    {disciplina.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-32 flex-col gap-2">
            <Label htmlFor={`aulas-${serie.gradeLevel}-${serie.stage}`}>Aulas/semana</Label>
            <Input
              id={`aulas-${serie.gradeLevel}-${serie.stage}`}
              type="number"
              min={1}
              max={40}
              value={aulas}
              onChange={(evento) => setAulas(evento.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              aoPor(escolhida, Number(aulas) || 1);
              setEscolhida("");
            }}
            disabled={ocupado || !escolhida}
          >
            <Plus size={18} strokeWidth={1.8} aria-hidden />
            Pôr na grade
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
