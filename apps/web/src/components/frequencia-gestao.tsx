import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PermissionState,
} from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCheck, Users } from "lucide-react";
import { useState } from "react";

import { inteiro, percentual, percentualCurto, turno } from "@/lib/format";
import { useTRPC } from "@/utils/trpc";

const TODOS = "todos";

/** Quantos alunos abaixo do mínimo a tela mostra antes de "ver todos". */
const VISIVEIS = 8;

/**
 * Panorama de frequência da direção.
 *
 * Monta sobre a chamada que o professor já faz — não depende de catraca. O
 * mínimo legal aparece como marca na própria barra, porque informação que
 * existe só como cor não é informação (design brief §8).
 */
export function FrequenciaGestao() {
  const trpc = useTRPC();
  const [turnoFiltro, setTurnoFiltro] = useState<string>(TODOS);
  const [verTodos, setVerTodos] = useState(false);

  const panorama = useQuery(trpc.student.attendanceOverview.queryOptions());

  if (panorama.error) {
    return (
      <Card>
        {panorama.error.data?.code === "FORBIDDEN" ? (
          <PermissionState
            title="Seu perfil não abre esta tela"
            description="A frequência da escola é da direção e da coordenação."
          />
        ) : (
          <ErrorState
            title="Não foi possível carregar a frequência"
            description={panorama.error.message}
            action={
              <Button variant="secondary" onClick={() => panorama.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        )}
      </Card>
    );
  }

  if (panorama.isLoading || !panorama.data) {
    return (
      <Card>
        <ListSkeleton rows={6} />
      </Card>
    );
  }

  const dados = panorama.data;
  const minimo = dados.minimumRate;

  const turmas = dados.classrooms.filter(
    (turma) => turnoFiltro === TODOS || turma.shift === turnoFiltro,
  );
  const abaixo = dados.below.filter(
    (aluno) => turnoFiltro === TODOS || aluno.shift === turnoFiltro,
  );
  const emAlerta = turmas.filter((turma) => turma.rate !== null && turma.rate < 0.85).length;

  if (dados.rate === null) {
    return (
      <Card>
        <EmptyState
          title="Ainda não há aula registrada"
          description="A frequência aparece assim que a primeira chamada for feita. Sem aula, não existe percentual — nem 0%."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={ClipboardCheck}
          label="Frequência média"
          hint={`mínimo de ${percentualCurto(minimo)}`}
        >
          {percentual(dados.rate)}
        </StatCard>
        <StatCard
          icon={AlertTriangle}
          label="Abaixo do mínimo"
          hint={`de ${inteiro(dados.students)} alunos ativos`}
          tone={dados.belowMinimum > 0 ? "warning" : "neutral"}
        >
          {inteiro(dados.belowMinimum)}
        </StatCard>
        <StatCard
          icon={Users}
          label="Turmas em alerta"
          hint="média da turma abaixo de 85%"
          tone={emAlerta > 0 ? "warning" : "neutral"}
        >
          {inteiro(emAlerta)}
        </StatCard>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardEyebrow>Por turma</CardEyebrow>
            <h2 className="font-extrabold text-base tracking-[-0.2px]">Da pior para a melhor</h2>
          </div>
          <div className="flex gap-2">
            {[
              { value: TODOS, label: "Todos" },
              { value: "manha", label: "Manhã" },
              { value: "tarde", label: "Tarde" },
              { value: "noite", label: "Noite" },
            ].map((opcao) => (
              <Button
                key={opcao.value}
                size="sm"
                variant={turnoFiltro === opcao.value ? "default" : "secondary"}
                aria-pressed={turnoFiltro === opcao.value}
                onClick={() => setTurnoFiltro(opcao.value)}
              >
                {opcao.label}
              </Button>
            ))}
          </div>
        </div>

        {turmas.length === 0 ? (
          <EmptyState
            title="Nenhuma turma neste turno"
            description="Troque o filtro para ver as demais."
          />
        ) : (
          <ul className="flex flex-col">
            {turmas.map((turma) => (
              <li
                key={turma.classroomId ?? turma.classroomName}
                className={
                  turma.rate !== null && turma.rate < minimo
                    ? "grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3 rounded-field bg-danger-soft px-3 py-2.5 sm:grid-cols-[5rem_1fr_3.5rem_9rem]"
                    : "grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3 rounded-field px-3 py-2.5 odd:bg-muted sm:grid-cols-[5rem_1fr_3.5rem_9rem]"
                }
              >
                <span className="font-bold text-corpo">{turma.classroomName}</span>
                <Barra rate={turma.rate} minimo={minimo} />
                <span
                  className={
                    turma.rate !== null && turma.rate < minimo
                      ? "text-right font-extrabold text-corpo text-danger tabular-nums"
                      : "text-right font-extrabold text-corpo tabular-nums"
                  }
                >
                  {percentualCurto(turma.rate)}
                </span>
                <span className="hidden text-right text-meta text-muted-foreground sm:block">
                  {turma.belowMinimum === 0
                    ? "nenhum abaixo"
                    : `${inteiro(turma.belowMinimum)} ${turma.belowMinimum === 1 ? "aluno" : "alunos"} abaixo`}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-meta text-muted-foreground">
          A marca na barra é o mínimo de {percentualCurto(minimo)} das aulas dadas — LDB, art. 24,
          VI. Atraso conta como presença.
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardEyebrow>Abaixo do mínimo</CardEyebrow>
            <h2 className="font-extrabold text-base tracking-[-0.2px]">
              Quem está mais longe primeiro
            </h2>
          </div>
          {abaixo.length > VISIVEIS ? (
            <Button variant="secondary" size="sm" onClick={() => setVerTodos((atual) => !atual)}>
              {verTodos ? "Ver menos" : `Ver todos os ${inteiro(abaixo.length)}`}
            </Button>
          ) : null}
        </div>

        {abaixo.length === 0 ? (
          <EmptyState
            title="Ninguém abaixo do mínimo"
            description="Todos os alunos deste recorte estão acima de 75% das aulas dadas."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {(verTodos ? abaixo : abaixo.slice(0, VISIVEIS)).map((aluno) => (
              <li
                key={aluno.studentId}
                className="flex items-center gap-3 rounded-field bg-danger-soft px-3 py-2.5"
              >
                <Avatar className="size-9">
                  <AvatarFallback className="text-meta">
                    {initialsOf(aluno.studentName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-corpo">{aluno.studentName}</p>
                  <p className="text-meta text-muted-foreground">
                    {aluno.classroomName ?? "Sem turma"} · {turno(aluno.shift)} ·{" "}
                    <span className="tabular-nums">{aluno.registration}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-danger text-sm tabular-nums">
                    {percentualCurto(aluno.rate)}
                  </p>
                  <p className="text-meta text-muted-foreground">
                    faltam {Math.ceil((minimo - aluno.rate) * 100)} pontos
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/**
 * Barra com a marca do mínimo legal.
 *
 * Decorativa (`aria-hidden`): o percentual e a contagem de alunos abaixo estão
 * em texto ao lado. Dar papel de medidor à barra faria o leitor de tela
 * anunciar o mesmo número duas vezes.
 *
 * A marca é um traço na posição dos 75%, não só a cor da barra: em impressão
 * preto e branco, e para quem não distingue vermelho, a cor sozinha não diz
 * nada.
 */
function Barra({ rate, minimo }: { rate: number | null; minimo: number }) {
  if (rate === null) {
    return <span className="text-meta text-muted-foreground">sem aula registrada</span>;
  }

  const abaixo = rate < minimo;

  return (
    <div className="relative h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
      <span
        className={
          abaixo ? "block h-full rounded-full bg-danger" : "block h-full rounded-full bg-primary"
        }
        style={{ width: `${Math.min(rate * 100, 100)}%` }}
      />
      <span
        aria-hidden
        className="absolute top-0 bottom-0 w-0.5 bg-foreground/45"
        style={{ left: `${minimo * 100}%` }}
      />
    </div>
  );
}
