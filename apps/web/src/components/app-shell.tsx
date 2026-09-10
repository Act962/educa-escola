import type { AppRole } from "@educa-escola/auth";
import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Button } from "@educa-escola/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@educa-escola/ui/components/dropdown-menu";
import { Input } from "@educa-escola/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import { Separator } from "@educa-escola/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@educa-escola/ui/components/sidebar";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Search, Settings, UserRound } from "lucide-react";
import { useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { authClient } from "@/lib/auth-client";
import { roleLabel } from "@/lib/navigation";
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

/**
 * Busca do topo.
 *
 * Só aparece para quem tem a listagem de alunos, e leva até ela com o termo já
 * aplicado. Uma caixa de busca decorativa é pior que caixa nenhuma: alguém
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
      className="relative min-w-0 flex-1 md:max-w-md"
    >
      <Search
        size={18}
        strokeWidth={1.7}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={termo}
        onChange={(event) => setTermo(event.target.value)}
        placeholder="Buscar aluno por nome, matrícula ou responsável"
        aria-label="Buscar aluno"
        className="bg-card pl-11"
      />
    </form>
  );
}

/**
 * Instituição, ano letivo e bimestre — visível em toda tela.
 *
 * O bimestre usa o `Select` do shadcn, e não o `<select>` nativo: o nativo
 * herda a caixa do sistema operacional, então a mesma tela ficava diferente no
 * Windows, no macOS e no Android.
 */
function ContextBar() {
  const { year, term, setTerm } = useSchoolContext();

  return (
    <div className="flex items-center gap-3 rounded-control bg-card py-1 pr-1 pl-4">
      <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.7px]">
        Ano letivo
      </span>
      <span className="font-extrabold text-[13px]">{year}</span>
      <Separator orientation="vertical" className="h-4" />
      {/* `items` faz o gatilho mostrar o rótulo ("3º bimestre") em vez do valor
          cru ("3") — é como o Base UI resolve o texto do selecionado. */}
      <Select
        items={TERMS.map((option) => ({ value: String(option), label: `${option}º bimestre` }))}
        value={String(term)}
        onValueChange={(value) => setTerm(Number(value) as Term)}
      >
        <SelectTrigger aria-label="Bimestre" className="border-none bg-transparent text-info">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TERMS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}º bimestre
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MenuDoUsuario({ me, onSignOut }: { me: CurrentUser; onSignOut: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="gap-3 px-3">
            <Avatar size="sm">
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {initialsOf(me.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden flex-col items-start sm:flex">
              <span className="font-extrabold text-[13px] leading-tight">{me.name}</span>
              <span className="font-medium text-[11px] text-muted-foreground">
                {roleLabel(me.role)}
              </span>
            </span>
            <ChevronDown
              size={16}
              strokeWidth={1.7}
              className="text-muted-foreground"
              aria-hidden
            />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-extrabold text-[13px]">{me.name}</span>
          <span className="font-medium text-[11px] text-muted-foreground">{me.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserRound size={16} strokeWidth={1.7} aria-hidden />
          Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings size={16} strokeWidth={1.7} aria-hidden />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut size={16} strokeWidth={1.7} aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A casca do app: sidebar do shadcn + topo com contexto e conta.
 *
 * O leiaute segue os mockups de `docs/design/`: fundo azul, cascas brancas de
 * 24px de raio e nenhuma sombra.
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
    <SidebarProvider>
      <AppSidebar
        role={me.role}
        schoolName={me.schoolName}
        pendingCalls={pendingCalls}
        onSignOut={sair}
      />

      <SidebarInset>
        <header className="flex flex-wrap items-center gap-3">
          <SidebarTrigger variant="outline" size="icon" className="shrink-0" />
          <BuscaDeAlunos role={me.role} />
          <div className="ml-auto flex items-center gap-3">
            <ContextBar />
            <MenuDoUsuario me={me} onSignOut={sair} />
          </div>
        </header>

        <main className="flex flex-col gap-5">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
