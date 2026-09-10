import { longDate, shortDate } from "@educa-escola/api/dates";
import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@educa-escola/ui/components/breadcrumb";
import { Button } from "@educa-escola/ui/components/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@educa-escola/ui/components/card";
import { Label } from "@educa-escola/ui/components/label";
import { Textarea } from "@educa-escola/ui/components/textarea";
import { SegmentedControl, type SegmentedOption } from "@educa-escola/ui/integra/segmented";
import { ErrorState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { cn } from "@educa-escola/ui/lib/utils";
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
      <Card>
        <ListSkeleton rows={6} />
      </Card>
    );
  }

  if (folha.error) {
    return (
      <Card>
        {folha.error.data?.code === "FORBIDDEN" ? (
          <PermissionState
            title="Seu perfil não registra chamada"
            description="O registro de presença é do professor da turma. Fale com a coordenação se precisa deste acesso."
          />
        ) : (
          <ErrorState title="Não foi possível abrir a chamada" description={folha.error.message} />
        )}
      </Card>
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
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to="/chamada">Chamada</Link>} />
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{lesson.classroomName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="font-extrabold text-2xl tracking-[-0.6px]">
            Chamada — {lesson.classroomName} · {lesson.subjectName}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {lesson.startsAt}–{lesson.endsAt} · {longDate(lesson.date)}
            {lesson.room ? ` · ${lesson.room}` : ""}
          </p>
        </div>

        <Badge variant="warning" className="gap-2 px-4 py-2.5 text-[13px]">
          <Clock strokeWidth={1.7} aria-hidden />
          Prazo para registrar: {deadline.slice(-5)} de {shortDate(lesson.date)}
        </Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <CardTitle>Alunos</CardTitle>
              <CardDescription>{totalAlunos} na turma</CardDescription>
            </div>
            <CardAction>
              <Button variant="success" onClick={todosPresentes}>
                <Check strokeWidth={1.7} aria-hidden />
                Redefinir todos como presentes
              </Button>
            </CardAction>
          </CardHeader>

          <Alert>
            <Info strokeWidth={1.7} aria-hidden />
            <AlertDescription className="text-muted-foreground">
              Todos entram como <strong className="text-foreground">presentes</strong> — marque
              apenas as exceções. O contador atualiza sozinho.
            </AlertDescription>
          </Alert>

          <ul className="flex flex-col gap-2">
            {entries.map((linha) => {
              const status = marcacoes[linha.studentId] ?? linha.status;
              const excecao = status !== "presente";

              return (
                <li
                  key={linha.studentId}
                  className={cn(
                    "flex flex-col gap-3 rounded-field p-3 sm:flex-row sm:items-center",
                    status === "falta" && "bg-danger-soft",
                    status === "atraso" && "bg-warning-soft",
                    !excecao && "bg-muted",
                  )}
                >
                  {/* No celular a linha empilha: nome em cima, trilho de
                      presença embaixo, ocupando a largura toda. Lado a lado,
                      o trilho não cabe e o nome fica ilegível. */}
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback
                        className={cn(
                          status === "falta" && "bg-danger-soft text-danger",
                          status === "atraso" && "bg-warning-soft text-warning",
                        )}
                      >
                        {initialsOf(linha.name)}
                      </AvatarFallback>
                    </Avatar>
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
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Resumo da chamada</CardTitle>
            </CardHeader>

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

            <p className="text-[13px] text-muted-foreground">
              Frequência da aula:{" "}
              <strong className="text-foreground">{percentual(frequencia)}</strong> —{" "}
              {contagem.presente + contagem.atraso} de {totalAlunos}. Atrasos contam como presença.
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conteúdo da aula</CardTitle>
            </CardHeader>
            <Label htmlFor="conteudo" className="sr-only">
              Conteúdo da aula
            </Label>
            <Textarea
              id="conteudo"
              value={conteudo}
              onChange={(event) => setConteudo(event.target.value)}
              rows={4}
              placeholder="O que foi trabalhado nesta aula"
            />

            <Label htmlFor="tarefa">Tarefa de casa</Label>
            <Textarea
              id="tarefa"
              value={tarefa}
              onChange={(event) => setTarefa(event.target.value)}
              rows={2}
              className="min-h-14"
              placeholder="Opcional — descreva a tarefa"
            />
          </Card>

          {requiresJustification ? (
            <Alert variant="warning">
              <Clock strokeWidth={1.7} aria-hidden />
              <AlertTitle>Fora do prazo</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                Esta aula já passou do prazo de registro. A alteração vira correção de histórico e
                exige justificativa.
                <Label htmlFor="justificativa" className="sr-only">
                  Justificativa
                </Label>
                <Textarea
                  id="justificativa"
                  value={justificativa}
                  onChange={(event) => setJustificativa(event.target.value)}
                  rows={3}
                  className="bg-card"
                  placeholder="Descreva o motivo do registro fora do prazo"
                />
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <Button size="lg" onClick={enviar} disabled={salvar.isPending} className="w-full">
              <Check strokeWidth={1.7} aria-hidden />
              {salvar.isPending ? "Salvando…" : "Salvar chamada"}
            </Button>

            {lesson.attendanceRecordedAt ? (
              <p className="text-center">
                <Badge variant="success">Chamada já registrada</Badge>
              </p>
            ) : null}

            <p className="text-center text-[11px] text-muted-foreground">
              Você pode editar até o fim do dia da aula. Depois disso, a alteração exige
              justificativa.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
