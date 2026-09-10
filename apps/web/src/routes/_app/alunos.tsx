import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@educa-escola/ui/components/table";
import { EmptyState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { cn } from "@educa-escola/ui/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

import { inteiro, percentualCurto, situacaoMatricula, turno } from "@/lib/format";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/alunos")({
  component: Alunos,
  // A busca do topo do app cai aqui com o termo na URL — assim o resultado é
  // linkável e sobrevive a um recarregamento.
  validateSearch: (search: Record<string, unknown>) => ({
    busca: typeof search.busca === "string" ? search.busca : undefined,
  }),
});

/** `TODAS` em vez de "" porque o Select do shadcn não aceita valor vazio. */
const TODAS = "TODAS";

const SITUACOES = [
  { value: TODAS, label: "Todas as situações" },
  { value: "ativo", label: "Ativos" },
  { value: "documentacao_pendente", label: "Documentação pendente" },
  { value: "transferido", label: "Transferidos" },
] as const;

const TURNOS = [
  { value: TODAS, label: "Todos os turnos" },
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
] as const;

type Situacao = (typeof SITUACOES)[number]["value"];
type Turno = (typeof TURNOS)[number]["value"];

/**
 * Lista de alunos da Gestão.
 *
 * Densidade é deliberada: aqui a secretaria trabalha em desktop, com filtro
 * combinável. A `Table` do shadcn rola dentro do próprio contêiner, então a
 * página nunca rola na horizontal — regra do design brief.
 */
function Alunos() {
  const trpc = useTRPC();
  const { busca } = Route.useSearch();
  const [search, setSearch] = useState(busca ?? "");
  const [status, setStatus] = useState<Situacao>(TODAS);
  const [shift, setShift] = useState<Turno>(TODAS);
  const [atRisk, setAtRisk] = useState(false);

  const alunos = useQuery({
    ...trpc.student.list.queryOptions({
      search: search.trim() || undefined,
      status: status === TODAS ? undefined : status,
      shift: shift === TODAS ? undefined : shift,
      atRisk: atRisk || undefined,
      limit: 50,
      offset: 0,
    }),
    // Sem isto a tabela pisca em branco a cada tecla digitada na busca.
    placeholderData: keepPreviousData,
  });

  if (alunos.error) {
    return (
      <Card>
        {alunos.error.data?.code === "FORBIDDEN" ? (
          <PermissionState
            title="Seu perfil não abre esta tela"
            description="A lista de alunos é da secretaria e da direção. Se você precisa dela, peça a alteração do seu papel."
          />
        ) : (
          <EmptyState title="Não foi possível carregar" description={alunos.error.message} />
        )}
      </Card>
    );
  }

  const itens = alunos.data?.items ?? [];

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Alunos</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Alunos</h1>
        <p className="text-[13px] text-muted-foreground">
          {alunos.data ? `${inteiro(alunos.data.total)} matriculados` : "Carregando…"}
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1">
            <Search
              size={18}
              strokeWidth={1.7}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, matrícula ou responsável"
              aria-label="Buscar por nome, matrícula ou responsável"
              className="pl-11"
            />
          </div>

          <Select
            items={SITUACOES.map((opcao) => ({ value: opcao.value, label: opcao.label }))}
            value={status}
            onValueChange={(value) => setStatus(value as Situacao)}
          >
            <SelectTrigger aria-label="Situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SITUACOES.map((opcao) => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={TURNOS.map((opcao) => ({ value: opcao.value, label: opcao.label }))}
            value={shift}
            onValueChange={(value) => setShift(value as Turno)}
          >
            <SelectTrigger aria-label="Turno">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TURNOS.map((opcao) => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={atRisk ? "destructive" : "secondary"}
            aria-pressed={atRisk}
            onClick={() => setAtRisk((current) => !current)}
          >
            Alerta de frequência
          </Button>
        </div>

        {alunos.isLoading ? (
          <ListSkeleton rows={6} />
        ) : itens.length === 0 ? (
          <EmptyState
            title="Nenhum aluno encontrado"
            description={
              atRisk
                ? "Nenhum aluno desta página está abaixo dos 75% de frequência."
                : "Ajuste a busca ou os filtros para encontrar a matrícula."
            }
          />
        ) : (
          <Table className="min-w-[52rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Frequência</TableHead>
                <TableHead className="text-right">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((aluno) => {
                const situacao = situacaoMatricula(aluno.status);
                const alerta = aluno.belowMinimumAttendance;

                return (
                  <TableRow key={aluno.id} className={alerta ? "bg-danger-soft" : undefined}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <Avatar size="sm">
                          <AvatarFallback className={cn(alerta && "bg-danger-soft text-danger")}>
                            {initialsOf(aluno.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex flex-col">
                          <span className="font-extrabold">{aluno.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {aluno.registration}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="font-bold">{aluno.classroomName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{turno(aluno.shift)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {aluno.guardianName ?? "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-extrabold tabular-nums",
                        alerta && "text-danger",
                      )}
                    >
                      {percentualCurto(aluno.attendanceRate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {alerta ? (
                        <Badge variant="danger">Alerta de frequência</Badge>
                      ) : (
                        <Badge variant={situacao.tone}>{situacao.label}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {alunos.data ? (
              <TableCaption>
                Mostrando {itens.length} de {inteiro(alunos.data.total)} alunos. Dado sensível
                (saúde, laudo, financeiro) não aparece em listagem, nem para a direção.
              </TableCaption>
            ) : null}
          </Table>
        )}
      </Card>
    </>
  );
}
