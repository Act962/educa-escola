import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@educa-escola/ui/components/table";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Search, TriangleAlert, Users } from "lucide-react";
import { useState } from "react";

import { inteiro } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/professores/")({
  component: Professores,
});

/**
 * Rótulo e tom de cada situação.
 *
 * **O tom vem da pendência, nunca da pessoa.** "Sem turma" é `info` e não
 * `danger`: não ter aula alocada não é falha do docente, é a grade que não
 * foi montada — e pintar de vermelho faria a direção cobrar a pessoa errada.
 */
const SITUACOES = {
  em_dia: { rotulo: "Em dia", variante: "success" },
  atencao: { rotulo: "Atenção", variante: "warning" },
  atrasado: { rotulo: "Atrasado", variante: "danger" },
  sem_turma: { rotulo: "Sem turma", variante: "info" },
} as const;

/**
 * O corpo docente, para a direção.
 *
 * Mostra o que cada professor está devendo em registro — chamada e nota — e
 * nada sobre desempenho. Média da turma e taxa de aprovação ficam de fora de
 * propósito: §10.6 do requisito diz que indicador pedagógico é apoio, não
 * ranking de docentes, e uma tela de gestão de pessoal é justamente onde esse
 * limite seria atravessado sem querer.
 */
function Professores() {
  const trpc = useTRPC();
  const { year } = useSchoolContext();
  const [busca, setBusca] = useState("");
  const [soPendencias, setSoPendencias] = useState(false);

  const docentes = useQuery({
    ...trpc.teacher.list.queryOptions({
      academicYear: year,
      search: busca.trim() || undefined,
      comPendencia: soPendencias || undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const resumo = docentes.data?.resumo;

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Instituição</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Professores</h1>
        <p className="text-corpo text-muted-foreground">
          Quem leciona em {year}, com o que está pendente de registro.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard icon={Users} label="No corpo docente" hint={`vínculo ativo em ${year}`}>
          {resumo ? inteiro(resumo.total) : "—"}
        </StatCard>
        <StatCard
          icon={TriangleAlert}
          label="Com pendência"
          hint="chamada ou nota em aberto"
          tone={resumo && resumo.comPendencia > 0 ? "warning" : undefined}
        >
          {resumo ? inteiro(resumo.comPendencia) : "—"}
        </StatCard>
        <StatCard icon={ClipboardList} label="Chamadas em aberto" hint="aulas já encerradas">
          {resumo ? inteiro(resumo.chamadasPendentes) : "—"}
        </StatCard>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search
              size={16}
              strokeWidth={1.8}
              aria-hidden
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="pl-9"
              aria-label="Buscar professor"
            />
          </div>
          {/* Mesmo padrão do "Alerta de frequência" da lista de alunos:
              botão com `aria-pressed`, e não um toggle — o design system não
              tem esse primitivo, e inventar um aqui abriria duas linguagens
              para o mesmo gesto. */}
          <Button
            variant={soPendencias ? "warning" : "secondary"}
            aria-pressed={soPendencias}
            onClick={() => setSoPendencias((atual) => !atual)}
          >
            Só com pendência
          </Button>
        </div>

        {docentes.isLoading ? (
          <ListSkeleton rows={6} />
        ) : docentes.isError ? (
          <ErrorState
            title="Não foi possível carregar o corpo docente"
            description="Atualize a página em instantes."
          />
        ) : docentes.data?.items.length === 0 ? (
          <EmptyState
            title={soPendencias ? "Ninguém com pendência" : "Nenhum professor encontrado"}
            description={
              soPendencias
                ? "Todas as chamadas e notas do ano estão registradas."
                : "Ajuste a busca, ou vincule professores à escola."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Professor</TableHead>
                <TableHead>Turmas</TableHead>
                <TableHead>Disciplinas</TableHead>
                <TableHead>Aulas</TableHead>
                <TableHead>Pendências</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docentes.data?.items.map((docente) => {
                const situacao = SITUACOES[docente.situacao];
                const pendencias = docente.chamadasPendentes + docente.notasPendentes;

                return (
                  <TableRow key={docente.userId}>
                    <TableCell>
                      <Link
                        to="/professores/$userId"
                        params={{ userId: docente.userId }}
                        className="flex items-center gap-3"
                      >
                        <Avatar>
                          <AvatarFallback>{initialsOf(docente.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-bold">{docente.name}</p>
                          <p className="truncate text-meta text-muted-foreground">
                            {docente.email}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>{inteiro(docente.turmas)}</TableCell>
                    <TableCell>{inteiro(docente.disciplinas)}</TableCell>
                    <TableCell>{inteiro(docente.aulas)}</TableCell>
                    <TableCell>
                      {pendencias === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        // Chamada e nota separadas: são cobranças diferentes,
                        // e um número só não diz à coordenação o que pedir.
                        <span className="text-meta">
                          {docente.chamadasPendentes > 0
                            ? `${inteiro(docente.chamadasPendentes)} chamada${docente.chamadasPendentes > 1 ? "s" : ""}`
                            : null}
                          {docente.chamadasPendentes > 0 && docente.notasPendentes > 0 ? " · " : ""}
                          {docente.notasPendentes > 0
                            ? `${inteiro(docente.notasPendentes)} nota${docente.notasPendentes > 1 ? "s" : ""}`
                            : null}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={situacao.variante}>{situacao.rotulo}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <p className="text-meta text-muted-foreground">
        A lista é ordenada por nome, nunca por pendência: uma lista que se reordena conforme alguém
        atrasa vira ranking de docentes por acidente. Tudo aqui é sobre registro — nada sobre nota
        da turma ou taxa de aprovação.
      </p>
    </>
  );
}
