import { InitialsAvatar } from "@educa-escola/ui/integra/initials-avatar";
import { Eyebrow, Panel } from "@educa-escola/ui/integra/panel";
import { EmptyState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { StatusBadge } from "@educa-escola/ui/integra/status-badge";
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

const SITUACOES = [
  { value: "", label: "Todas as situações" },
  { value: "ativo", label: "Ativos" },
  { value: "documentacao_pendente", label: "Documentação pendente" },
  { value: "transferido", label: "Transferidos" },
] as const;

const TURNOS = [
  { value: "", label: "Todos os turnos" },
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
 * combinável. Em telas estreitas a tabela vira lista de cartões — o conteúdo
 * rola dentro do próprio contêiner, a página nunca rola na horizontal.
 */
function Alunos() {
  const trpc = useTRPC();
  const { busca } = Route.useSearch();
  const [search, setSearch] = useState(busca ?? "");
  const [status, setStatus] = useState<Situacao>("");
  const [shift, setShift] = useState<Turno>("");
  const [atRisk, setAtRisk] = useState(false);

  const alunos = useQuery({
    ...trpc.student.list.queryOptions({
      search: search.trim() || undefined,
      status: status || undefined,
      shift: shift || undefined,
      atRisk: atRisk || undefined,
      limit: 50,
      offset: 0,
    }),
    // Sem isto a tabela pisca em branco a cada tecla digitada na busca.
    placeholderData: keepPreviousData,
  });

  if (alunos.error) {
    const negado = alunos.error.data?.code === "FORBIDDEN";
    return (
      <Panel>
        {negado ? (
          <PermissionState
            title="Seu perfil não abre esta tela"
            description="A lista de alunos é da secretaria e da direção. Se você precisa dela, peça a alteração do seu papel."
          />
        ) : (
          <EmptyState title="Não foi possível carregar" description={alunos.error.message} />
        )}
      </Panel>
    );
  }

  const itens = alunos.data?.items ?? [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Eyebrow>Alunos</Eyebrow>
          <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Alunos</h1>
          <p className="text-[13px] text-muted-foreground">
            {alunos.data ? `${inteiro(alunos.data.total)} matriculados` : "Carregando…"}
          </p>
        </div>
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="flex min-w-64 flex-1 items-center gap-2.5 rounded-control bg-muted px-4 py-2.5">
            <Search size={18} strokeWidth={1.7} className="text-muted-foreground" aria-hidden />
            <span className="sr-only">Buscar por nome, matrícula ou responsável</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, matrícula ou responsável"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </label>

          <label className="sr-only" htmlFor="filtro-situacao">
            Situação
          </label>
          <select
            id="filtro-situacao"
            value={status}
            onChange={(event) => setStatus(event.target.value as Situacao)}
            className="min-h-11 rounded-control bg-muted px-3 font-bold text-[13px]"
          >
            {SITUACOES.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="filtro-turno">
            Turno
          </label>
          <select
            id="filtro-turno"
            value={shift}
            onChange={(event) => setShift(event.target.value as Turno)}
            className="min-h-11 rounded-control bg-muted px-3 font-bold text-[13px]"
          >
            {TURNOS.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setAtRisk((current) => !current)}
            aria-pressed={atRisk}
            className={`min-h-11 rounded-control px-4 font-bold text-[13px] ${
              atRisk ? "bg-danger text-card" : "bg-muted text-secondary-foreground"
            }`}
          >
            Alerta de frequência
          </button>
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse">
              <thead>
                <tr className="text-left">
                  <th scope="col" className="pb-2 pl-3">
                    <Eyebrow>Aluno</Eyebrow>
                  </th>
                  <th scope="col" className="pb-2">
                    <Eyebrow>Turma</Eyebrow>
                  </th>
                  <th scope="col" className="pb-2">
                    <Eyebrow>Turno</Eyebrow>
                  </th>
                  <th scope="col" className="pb-2">
                    <Eyebrow>Responsável</Eyebrow>
                  </th>
                  <th scope="col" className="pb-2 text-right">
                    <Eyebrow>Frequência</Eyebrow>
                  </th>
                  <th scope="col" className="pr-3 pb-2 text-right">
                    <Eyebrow>Situação</Eyebrow>
                  </th>
                </tr>
              </thead>
              <tbody>
                {itens.map((aluno) => {
                  const situacao = situacaoMatricula(aluno.status);
                  const alerta = aluno.belowMinimumAttendance;

                  return (
                    <tr key={aluno.id} className={alerta ? "bg-danger-soft" : undefined}>
                      <td className="rounded-l-field py-3 pl-3">
                        <span className="flex items-center gap-3">
                          <InitialsAvatar
                            name={aluno.name}
                            size="sm"
                            tone={alerta ? "danger" : "info"}
                          />
                          <span className="flex flex-col">
                            <span className="font-extrabold text-[13px]">{aluno.name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {aluno.registration}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="font-bold text-[13px]">{aluno.classroomName ?? "—"}</td>
                      <td className="text-[13px] text-muted-foreground">{turno(aluno.shift)}</td>
                      <td className="text-[13px] text-muted-foreground">
                        {aluno.guardianName ?? "—"}
                      </td>
                      <td
                        className={`text-right font-extrabold text-[13px] tabular-nums ${
                          alerta ? "text-danger" : "text-foreground"
                        }`}
                      >
                        {percentualCurto(aluno.attendanceRate)}
                      </td>
                      <td className="rounded-r-field py-3 pr-3 text-right">
                        {alerta ? (
                          <StatusBadge tone="danger">Alerta de frequência</StatusBadge>
                        ) : (
                          <StatusBadge tone={situacao.tone}>{situacao.label}</StatusBadge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {alunos.data ? (
          <p className="mt-4 text-[11px] text-muted-foreground">
            Mostrando {itens.length} de {inteiro(alunos.data.total)} alunos. Dado sensível (saúde,
            laudo, financeiro) não aparece em listagem, nem para a direção.
          </p>
        ) : null}
      </Panel>
    </>
  );
}
