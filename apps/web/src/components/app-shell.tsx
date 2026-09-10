import type { AppRole } from "@educa-escola/auth";
import { InitialsAvatar } from "@educa-escola/ui/integra/initials-avatar";
import { Eyebrow } from "@educa-escola/ui/integra/panel";
import { cn } from "@educa-escola/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, GraduationCap, LogOut, Search, Settings, UserRound } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { navigationFor, roleLabel } from "@/lib/navigation";
import { TERMS, type Term, useSchoolContext } from "@/lib/school-context";

export interface CurrentUser {
  name: string;
  email: string;
  role: AppRole;
  schoolName: string;
}

interface AppShellProps {
  me: CurrentUser;
  pendingCalls?: number;
  children: React.ReactNode;
}

function SidebarNav({ role, pendingCalls }: { role: AppRole; pendingCalls?: number }) {
  const entries = navigationFor(role);

  return (
    <nav className="flex flex-col gap-1" aria-label="Menu principal">
      <Eyebrow className="px-3 pt-2 pb-1">Menu</Eyebrow>
      {entries.map((entry) => {
        const badge = entry.badge === "chamadasPendentes" ? pendingCalls : undefined;
        const content = (
          <>
            <entry.icon size={18} strokeWidth={1.7} aria-hidden />
            <span className="flex-1 truncate">{entry.label}</span>
            {badge ? (
              <span className="rounded-full bg-danger-soft px-1.5 font-bold text-[11px] text-danger">
                {badge}
              </span>
            ) : null}
            {entry.soon ? (
              <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.7px]">
                em breve
              </span>
            ) : null}
          </>
        );

        if (!entry.to) {
          return (
            <span
              key={entry.label}
              aria-disabled="true"
              title="Módulo previsto no requisito, ainda não construído"
              className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-control px-3 font-medium text-[13px] text-muted-foreground opacity-70"
            >
              {content}
            </span>
          );
        }

        return (
          <Link
            key={entry.label}
            to={entry.to}
            className="flex min-h-11 items-center gap-3 rounded-control px-3 font-semibold text-[13px] text-sidebar-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground"
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Busca do topo.
 *
 * Só aparece para quem tem a listagem de alunos, e leva até ela com o termo
 * já aplicado. Uma caixa de busca decorativa é pior que caixa nenhuma: alguém
 * digita, aperta Enter e conclui que o produto está quebrado.
 */
function BuscaDeAlunos({ role }: { role: AppRole }) {
  const navigate = useNavigate();
  const [termo, setTermo] = useState("");

  if (role !== "owner" && role !== "admin") return null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        navigate({ to: "/alunos", search: { busca: termo.trim() || undefined } });
      }}
      className="flex w-full min-w-0 items-center gap-2.5 rounded-control bg-card px-4 py-2.5 text-muted-foreground sm:w-auto sm:flex-1"
    >
      <Search size={18} strokeWidth={1.7} aria-hidden />
      <input
        type="search"
        value={termo}
        onChange={(event) => setTermo(event.target.value)}
        placeholder="Buscar aluno por nome, matrícula ou responsável"
        aria-label="Buscar aluno"
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
      />
    </form>
  );
}

/** Instituição, ano letivo e bimestre — visível em toda tela, inclusive mobile. */
function ContextBar() {
  const { year, term, setTerm } = useSchoolContext();

  return (
    <div className="flex items-center gap-3 rounded-control bg-card px-4 py-2.5">
      <Eyebrow>Ano letivo</Eyebrow>
      <span className="font-extrabold text-[13px]">{year}</span>
      <span className="h-4 w-px bg-border" aria-hidden />
      <label className="sr-only" htmlFor="bimestre">
        Bimestre
      </label>
      <select
        id="bimestre"
        value={term}
        onChange={(event) => setTerm(Number(event.target.value) as Term)}
        className="rounded-field bg-transparent font-extrabold text-[13px] text-info focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        {TERMS.map((option) => (
          <option key={option} value={option}>
            {option}º bimestre
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * A casca do app: sidebar, barra de contexto e topo.
 *
 * O leiaute segue os mockups de `docs/design/`: fundo azul, cascas brancas de
 * 24px de raio e nenhuma sombra. No mobile a sidebar sai da tela e a navegação
 * vai para a barra inferior — é lá que a chamada acontece.
 */
export function AppShell({ me, pendingCalls, children }: AppShellProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sair = async () => {
    await authClient.signOut();
    // Limpar o cache é parte de sair: sem isso o próximo login reaproveita as
    // respostas da pessoa anterior até elas expirarem — inclusive `me`, que
    // decide o menu e o painel. Vazamento entre contas, não só tela errada.
    queryClient.clear();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-svh bg-background p-4 lg:p-5">
      <div className="mx-auto flex w-full max-w-[1440px] gap-5">
        <aside className="sticky top-5 hidden h-[calc(100svh-2.5rem)] w-64 shrink-0 flex-col gap-5 overflow-y-auto rounded-shell bg-card p-4 lg:flex">
          <Link to="/inicio" className="flex items-center gap-2 px-2 py-1">
            <GraduationCap size={26} strokeWidth={1.7} className="text-primary" aria-hidden />
            <span className="font-extrabold text-lg tracking-[-0.4px]">
              Integra<span className="text-primary">Edu</span>
            </span>
          </Link>

          <div className="flex items-center gap-3 rounded-control bg-muted p-3">
            <InitialsAvatar name={me.schoolName} size="sm" />
            <span className="flex min-w-0 flex-col">
              <Eyebrow>Instituição</Eyebrow>
              <span className="truncate font-extrabold text-[13px]">{me.schoolName}</span>
            </span>
            <ChevronsUpDown size={16} strokeWidth={1.7} className="ml-auto text-muted-foreground" />
          </div>

          <SidebarNav role={me.role} pendingCalls={pendingCalls} />

          <div className="mt-auto flex flex-col gap-1">
            <Eyebrow className="px-3 pt-2 pb-1">Outros</Eyebrow>
            <span
              aria-disabled="true"
              className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-control px-3 font-medium text-[13px] text-muted-foreground opacity-70"
            >
              <UserRound size={18} strokeWidth={1.7} aria-hidden />
              Meu perfil
            </span>
            <span
              aria-disabled="true"
              className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-control px-3 font-medium text-[13px] text-muted-foreground opacity-70"
            >
              <Settings size={18} strokeWidth={1.7} aria-hidden />
              Configurações
            </span>
            <button
              type="button"
              onClick={sair}
              className="flex min-h-11 items-center gap-3 rounded-control px-3 font-semibold text-[13px] text-sidebar-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              <LogOut size={18} strokeWidth={1.7} aria-hidden />
              Sair
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5 pb-20 lg:pb-0">
          <header className="flex flex-wrap items-center gap-3">
            <BuscaDeAlunos role={me.role} />

            <ContextBar />

            <div className="ml-auto flex items-center gap-3 rounded-control bg-card px-3 py-2">
              <InitialsAvatar name={me.name} size="sm" tone="neutral" />
              <span className="flex flex-col">
                <span className="font-extrabold text-[13px] leading-tight">{me.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {roleLabel(me.role)} · {me.schoolName}
                </span>
              </span>
              {/* No celular a sidebar não existe, e é lá que mora o "Sair" do
                  desktop: sem este botão não haveria como encerrar a sessão. */}
              <button
                type="button"
                onClick={sair}
                aria-label="Sair"
                className="flex size-9 items-center justify-center rounded-control text-muted-foreground hover:bg-secondary lg:hidden"
              >
                <LogOut size={18} strokeWidth={1.7} aria-hidden />
              </button>
            </div>
          </header>

          <main className="flex flex-col gap-5">{children}</main>
        </div>
      </div>

      <MobileNav role={me.role} pendingCalls={pendingCalls} />
    </div>
  );
}

/** No celular a sidebar vira barra inferior — alvos de 44px, sem "em breve". */
function MobileNav({ role, pendingCalls }: { role: AppRole; pendingCalls?: number }) {
  const entries = navigationFor(role)
    .filter((entry) => entry.to)
    .slice(0, 4);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-10 flex items-stretch gap-1 border-border border-t bg-card px-2 py-1.5 lg:hidden"
    >
      {entries.map((entry) => (
        <Link
          key={entry.label}
          to={entry.to as string}
          className={cn(
            "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-1 py-1 font-semibold text-[11px] text-muted-foreground",
            "data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground",
          )}
        >
          <span className="relative">
            <entry.icon size={20} strokeWidth={1.7} aria-hidden />
            {entry.badge === "chamadasPendentes" && pendingCalls ? (
              <span className="absolute -top-1 -right-2 rounded-full bg-danger px-1 font-bold text-[10px] text-card">
                {pendingCalls}
              </span>
            ) : null}
          </span>
          <span className="truncate">{entry.label}</span>
        </Link>
      ))}
    </nav>
  );
}
