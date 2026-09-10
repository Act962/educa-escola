import { longDate } from "@educa-escola/api/dates";
import { InitialsAvatar } from "@educa-escola/ui/integra/initials-avatar";
import { Eyebrow, Panel, PanelHeader } from "@educa-escola/ui/integra/panel";
import { SegmentedControl, type SegmentedOption } from "@educa-escola/ui/integra/segmented";
import { ErrorState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { StatusBadge } from "@educa-escola/ui/integra/status-badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { percentual } from "@/lib/format";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/chamada/$lessonId")({
  component: FolhaDeChamada,
});

type Presenca = "presente" | "falta" | "atraso";

const OPCOES: SegmentedOption<Presenca>[] = [
  { value: "presente", label: "Presente", tone: "success" },
  { value: "falta", label: "Falta", tone: "danger" },
  { value: "atraso", label: "Atraso", tone: "warning" },
];

/**
 * A tela mais usada do professor — meta de projeto: chamada em menos de 60s.
 *
 * Por isso a turma inteira já entra como presente e só as exceções são
 * marcadas. O contador ao lado acompanha em tempo real, então o professor
 * confere o número antes de salvar em vez de recontar a lista.
 */
function FolhaDeChamada() {
  const { lessonId } = Route.useParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const folha = useQuery(trpc.lesson.attendanceSheet.queryOptions({ id: lessonId }));

  const [marcacoes, setMarcacoes] = useState<Record<string, Presenca>>({});
  const [conteudo, setConteudo] = useState("");
  const [tarefa, setTarefa] = useState("");
  const [justificativa, setJustificativa] = useState("");

  // O servidor é a fonte da verdade da folha; o estado local só existe entre
  // abrir a tela e salvar.
  useEffect(() => {
    if (!folha.data) return;
    setMarcacoes(
      Object.fromEntries(folha.data.entries.map((linha) => [linha.studentId, linha.status])),
    );
    setConteudo(folha.data.lesson.content ?? "");
    setTarefa(folha.data.lesson.homework ?? "");
  }, [folha.data]);

  const salvar = useMutation(
    trpc.lesson.saveAttendance.mutationOptions({
      onSuccess: (resultado) => {
        toast.success(
          `Chamada salva: ${resultado.summary.presentes} presentes, ${resultado.summary.faltas} faltas.`,
        );
        queryClient.invalidateQueries();
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (folha.isLoading) {
    return (
      <Panel>
        <ListSkeleton rows={6} />
      </Panel>
    );
  }

  if (folha.error) {
    const negado = folha.error.data?.code === "FORBIDDEN";
    return (
      <Panel>
        {negado ? (
          <PermissionState
            title="Seu perfil não registra chamada"
            description="O registro de presença é do professor da turma. Fale com a coordenação se precisa deste acesso."
          />
        ) : (
          <ErrorState title="Não foi possível abrir a chamada" description={folha.error.message} />
        )}
      </Panel>
    );
  }

  if (!folha.data) return null;

  const { lesson, entries, deadline, requiresJustification } = folha.data;

  const contagem = entries.reduce(
    (total, linha) => {
      const status = marcacoes[linha.studentId] ?? linha.status;
      total[status] += 1;
      return total;
    },
    { presente: 0, falta: 0, atraso: 0 },
  );
  const totalAlunos = entries.length;
  const frequencia = totalAlunos === 0 ? null : (contagem.presente + contagem.atraso) / totalAlunos;

  const marcar = (studentId: string, status: Presenca) =>
    setMarcacoes((atual) => ({ ...atual, [studentId]: status }));

  const todosPresentes = () =>
    setMarcacoes(Object.fromEntries(entries.map((linha) => [linha.studentId, "presente"])));

  const enviar = () =>
    salvar.mutate({
      lessonId,
      entries: entries.map((linha) => ({
        studentId: linha.studentId,
        status: marcacoes[linha.studentId] ?? linha.status,
      })),
      content: conteudo.trim() || null,
      homework: tarefa.trim() || null,
      justification: justificativa.trim() || null,
    });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <nav className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Link to="/chamada" className="font-bold text-info hover:underline">
              Chamada
            </Link>
            <span aria-hidden>›</span>
            <span className="font-bold">{lesson.classroomName}</span>
          </nav>
          <h1 className="font-extrabold text-2xl tracking-[-0.6px]">
            Chamada — {lesson.classroomName} · {lesson.subjectName}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {lesson.startsAt}–{lesson.endsAt} · {longDate(lesson.date)}
            {lesson.room ? ` · ${lesson.room}` : ""}
          </p>
        </div>

        <span className="flex items-center gap-2 rounded-control bg-warning-soft px-4 py-2.5 font-bold text-[13px] text-warning">
          <Clock size={18} strokeWidth={1.7} aria-hidden />
          Prazo para registrar: {deadline.slice(-5)} de{" "}
          {lesson.date.split("-").reverse().slice(0, 2).join("/")}
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <Panel>
          <PanelHeader
            title="Alunos"
            hint={`${totalAlunos} na turma`}
            action={
              <button
                type="button"
                onClick={todosPresentes}
                className="flex min-h-11 items-center gap-2 rounded-control bg-success-soft px-4 font-bold text-[13px] text-success"
              >
                <Check size={18} strokeWidth={1.7} aria-hidden />
                Redefinir todos como presentes
              </button>
            }
          />

          <p className="mb-4 flex items-start gap-2 rounded-field bg-muted p-3 text-[13px] text-muted-foreground">
            <Info size={18} strokeWidth={1.7} className="mt-px shrink-0" aria-hidden />
            <span>
              Todos entram como <strong className="text-foreground">presentes</strong> — marque
              apenas as exceções. O contador atualiza sozinho.
            </span>
          </p>

          <ul className="flex flex-col gap-2">
            {entries.map((linha) => {
              const status = marcacoes[linha.studentId] ?? linha.status;
              const excecao = status !== "presente";

              return (
                <li
                  key={linha.studentId}
                  className={`flex flex-col gap-3 rounded-field p-3 sm:flex-row sm:items-center ${
                    status === "falta"
                      ? "bg-danger-soft"
                      : status === "atraso"
                        ? "bg-warning-soft"
                        : "bg-muted"
                  }`}
                >
                  {/* No celular a linha empilha: nome em cima, trilho de
                      presença embaixo, ocupando a largura toda. Lado a lado,
                      o trilho não cabe e o nome fica ilegível. */}
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <InitialsAvatar
                      name={linha.name}
                      size="sm"
                      tone={excecao ? (status === "falta" ? "danger" : "warning") : "info"}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-extrabold text-sm">{linha.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        Matrícula {linha.registration} ·{" "}
                        {linha.absencesInTerm === 0
                          ? "sem faltas"
                          : `${linha.absencesInTerm} falta${linha.absencesInTerm > 1 ? "s" : ""} no ano`}
                      </span>
                    </span>
                  </span>
                  <SegmentedControl
                    label={`Presença de ${linha.name}`}
                    options={OPCOES}
                    value={status}
                    onChange={(novo) => marcar(linha.studentId, novo)}
                    className="w-full sm:w-auto"
                  />
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader title="Resumo da chamada" />

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-field bg-success-soft p-3 text-center">
                <p className="font-extrabold text-2xl text-success tabular-nums">
                  {contagem.presente}
                </p>
                <p className="font-bold text-[11px] text-success">Presentes</p>
              </div>
              <div className="rounded-field bg-danger-soft p-3 text-center">
                <p className="font-extrabold text-2xl text-danger tabular-nums">{contagem.falta}</p>
                <p className="font-bold text-[11px] text-danger">Faltas</p>
              </div>
              <div className="rounded-field bg-warning-soft p-3 text-center">
                <p className="font-extrabold text-2xl text-warning tabular-nums">
                  {contagem.atraso}
                </p>
                <p className="font-bold text-[11px] text-warning">Atrasos</p>
              </div>
            </div>

            <p className="mt-4 text-[13px] text-muted-foreground">
              Frequência da aula:{" "}
              <strong className="text-foreground">{percentual(frequencia)}</strong> —{" "}
              {contagem.presente + contagem.atraso} de {totalAlunos}. Atrasos contam como presença.
            </p>
          </Panel>

          <Panel>
            <PanelHeader title="Conteúdo da aula" />
            <label className="sr-only" htmlFor="conteudo">
              Conteúdo da aula
            </label>
            <textarea
              id="conteudo"
              value={conteudo}
              onChange={(event) => setConteudo(event.target.value)}
              rows={4}
              placeholder="O que foi trabalhado nesta aula"
              className="w-full rounded-field bg-muted p-3 text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-ring"
            />

            <label className="mt-4 mb-2 block font-bold text-[13px]" htmlFor="tarefa">
              Tarefa de casa
            </label>
            <textarea
              id="tarefa"
              value={tarefa}
              onChange={(event) => setTarefa(event.target.value)}
              rows={2}
              placeholder="Opcional — descreva a tarefa"
              className="w-full rounded-field bg-muted p-3 text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-ring"
            />
          </Panel>

          {requiresJustification ? (
            <Panel className="bg-warning-soft">
              <Eyebrow className="text-warning">Fora do prazo</Eyebrow>
              <p className="mt-1 mb-3 text-[13px]">
                Esta aula já passou do prazo de registro. A alteração vira correção de histórico e
                exige justificativa.
              </p>
              <label className="sr-only" htmlFor="justificativa">
                Justificativa
              </label>
              <textarea
                id="justificativa"
                value={justificativa}
                onChange={(event) => setJustificativa(event.target.value)}
                rows={3}
                placeholder="Descreva o motivo do registro fora do prazo"
                className="w-full rounded-field bg-card p-3 text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-ring"
              />
            </Panel>
          ) : null}

          <Panel>
            <button
              type="button"
              onClick={enviar}
              disabled={salvar.isPending}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 font-bold text-primary-foreground text-sm disabled:opacity-60"
            >
              <Check size={20} strokeWidth={1.7} aria-hidden />
              {salvar.isPending ? "Salvando…" : "Salvar chamada"}
            </button>

            {lesson.attendanceRecordedAt ? (
              <p className="mt-3 text-center">
                <StatusBadge tone="success">Chamada já registrada</StatusBadge>
              </p>
            ) : null}

            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Você pode editar até o fim do dia da aula. Depois disso, a alteração exige
              justificativa.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
