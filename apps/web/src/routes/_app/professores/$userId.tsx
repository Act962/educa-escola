import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, ClipboardList, Sparkles, Users } from "lucide-react";

import { inteiro, percentualCurto } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/professores/$userId")({
  component: FichaDoProfessor,
});

const SITUACOES = {
  em_dia: { rotulo: "Em dia", variante: "success" },
  atencao: { rotulo: "Atenção", variante: "warning" },
  atrasado: { rotulo: "Atrasado", variante: "danger" },
  sem_turma: { rotulo: "Sem turma", variante: "info" },
} as const;

/**
 * A ficha de um professor.
 *
 * Junta o que quatro módulos sabem sobre a mesma pessoa: turmas e disciplinas
 * (da agenda de aulas), pendências de chamada e nota, frequência das turmas
 * dele, e a pontuação que ele acumulou no ano.
 *
 * A frequência aparece como **contexto, não como nota do professor**. Turma
 * com muita falta é informação que a coordenação precisa, e a mesma §10.6 que
 * proíbe ranking de docentes é o motivo de ela não virar um selo de
 * desempenho aqui.
 */
function FichaDoProfessor() {
  const { userId } = Route.useParams();
  const trpc = useTRPC();
  const { year } = useSchoolContext();

  const ficha = useQuery(trpc.teacher.byId.queryOptions({ userId, academicYear: year }));

  // O placar de docentes já existe na tela de Pontuação; reaproveitá-lo é
  // melhor que criar uma segunda consulta que pode discordar dela.
  const placar = useQuery({
    ...trpc.score.rankingDeProfessores.queryOptions({ academicYear: year }),
    retry: false,
  });
  const pontos = placar.data?.find((linha) => linha.subjectId === userId);

  if (ficha.isLoading) {
    return (
      <Card>
        <ListSkeleton rows={5} />
      </Card>
    );
  }

  if (ficha.isError || !ficha.data) {
    return (
      <Card>
        <ErrorState
          title="Professor não encontrado"
          description="Ele pode ter perdido o vínculo com esta escola."
          action={
            <Button variant="secondary" nativeButton={false} render={<Link to="/professores" />}>
              Voltar à lista
            </Button>
          }
        />
      </Card>
    );
  }

  const docente = ficha.data;
  const situacao = SITUACOES[docente.situacao];

  return (
    <>
      <div>
        <Link
          to="/professores"
          className="flex w-fit items-center gap-1.5 font-bold text-meta text-muted-foreground"
        >
          <ChevronLeft size={16} strokeWidth={1.7} aria-hidden />
          Professores
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback>{initialsOf(docente.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-extrabold text-2xl tracking-[-0.6px]">{docente.name}</h1>
          <p className="text-corpo text-muted-foreground">{docente.email}</p>
        </div>
        <Badge variant={situacao.variante} className="ml-auto">
          {situacao.rotulo}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Alunos alcançados" hint={`em ${year}`}>
          {inteiro(docente.alunos)}
        </StatCard>
        <StatCard
          icon={BookOpen}
          label="Aulas no ano"
          hint={`${inteiro(docente.aulasRegistradas)} com chamada`}
        >
          {inteiro(docente.aulas)}
        </StatCard>
        <StatCard
          icon={ClipboardList}
          label="Pendências"
          hint="chamada e nota em aberto"
          tone={docente.chamadasPendentes + docente.notasPendentes > 0 ? "warning" : undefined}
        >
          {inteiro(docente.chamadasPendentes + docente.notasPendentes)}
        </StatCard>
        <StatCard
          icon={Sparkles}
          label="Pontos"
          hint={pontos ? `${pontos.posicao}º entre os docentes` : "ainda sem apuração"}
        >
          {pontos ? inteiro(pontos.pontos) : "—"}
        </StatCard>
      </div>

      <Card className="flex flex-col gap-3">
        <CardEyebrow>Turmas e disciplinas</CardEyebrow>
        {docente.turmas.length === 0 ? (
          <EmptyState
            title={`Sem turma em ${year}`}
            description="Não há aula deste professor na agenda deste ano letivo."
          />
        ) : (
          <ul className="flex flex-col">
            {docente.turmas.map((turma) => (
              <li
                key={turma.classroomId}
                className="flex flex-wrap items-center gap-3 border-border border-t py-2.5 text-corpo first:border-t-0"
              >
                <span className="min-w-20 font-bold">{turma.nome}</span>
                <span className="min-w-0 flex-1 text-muted-foreground">
                  {turma.disciplinas.join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <CardEyebrow>Frequência das turmas</CardEyebrow>
        <p className="font-extrabold text-2xl">
          {docente.frequenciaDasTurmas === null
            ? "—"
            : percentualCurto(docente.frequenciaDasTurmas)}
        </p>
        <p className="text-meta text-muted-foreground">
          {docente.frequenciaDasTurmas === null
            ? "Sem chamada registrada nas turmas dele neste ano."
            : "Contexto da coordenação, não avaliação do professor: quem falta é o aluno, e a §10.6 do requisito é clara sobre indicador pedagógico não virar ranking de docente."}
        </p>
      </Card>
    </>
  );
}
