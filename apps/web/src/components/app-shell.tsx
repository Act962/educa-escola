import type { AppRole } from "@educa-escola/auth";
import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Button } from "@educa-escola/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@educa-escola/ui/components/dropdown-menu";
import { Input } from "@educa-escola/ui/components/input";
import { Separator } from "@educa-escola/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@educa-escola/ui/components/sidebar";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Search, Settings, UserRound } from "lucide-react";
import { useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Astro } from "@/components/astro";
import { SeletorDeBimestre } from "@/components/seletor-de-bimestre";
import { authClient } from "@/lib/auth-client";
import { roleLabel } from "@/lib/navigation";
import { useSchoolContext } from "@/lib/school-context";

export interface CurrentUser {
  name: string;
  email: string;
  role: AppRole;
  schoolName: string;
}

interface AppShellProps {
  me: CurrentUser;
  pendingCalls?: number;
  /** Comunicados publicados que esta pessoa ainda não abriu. */
  unreadNotices?: number;
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
  const { year } = useSchoolContext();

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-control bg-card py-1 pr-1 pl-3 sm:gap-3 sm:pl-4">
      {/*
        O rótulo sai no celular, o ano fica. "ANO LETIVO" custa uns 60px de
        largura para dizer o que "2026" ao lado de "3º bimestre" já diz — e
        eram justamente esses 60px que faziam a barra medir 386px numa tela de
        375, empurrando **toda** página para o lado.
      */}
      <span className="hidden font-bold text-muted-foreground text-rotulo uppercase tracking-[0.7px] sm:inline">
        Ano letivo
      </span>
      <span className="shrink-0 font-extrabold text-corpo">{year}</span>
      <Separator orientation="vertical" className="h-4" />
      {/*
        `size="sm"` dentro do seletor para o cabeçalho ficar todo na mesma
        altura. O gatilho padrão tem 44px e, somado aos 4px de respiro da
        barra, deixava a barra de contexto com 52 contra os 44 do botão da
        sidebar, da busca e do menu da conta — quatro controles lado a lado,
        um mais alto que os outros.
      */}
      <SeletorDeBimestre className="border-none bg-transparent text-info" />
    </div>
  );
}

function MenuDoUsuario({ me, onSignOut }: { me: CurrentUser; onSignOut: () => void }) {
  // Mesma regra da barra lateral: quem não tem `organization: ["update"]`
  // esbarraria em "Esta área é da direção".
  const podeConfigurar = me.role === "owner" || me.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          // `h-11` fecha a altura em 44. O tamanho padrão do botão traz
          // `py-2`, e o avatar de 32px somado a ele dava 50 — o único
          // controle do cabeçalho fora da linha dos outros três. Altura fixa
          // em vez de `py-0` porque o respiro continua útil quando o nome
          // aparece, a partir de `sm`.
          <Button variant="outline" className="h-11 gap-3 px-3">
            <Avatar size="sm">
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {initialsOf(me.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden flex-col items-start sm:flex">
              <span className="font-extrabold text-corpo leading-tight">{me.name}</span>
              <span className="font-medium text-meta text-muted-foreground">
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
        {/* O `DropdownMenuLabel` é o rótulo de um grupo: fora de um
            `DropdownMenuGroup` o Base UI derruba a tela inteira procurando o
            contexto que falta. Aqui a identidade nomeia as ações da conta. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="font-extrabold text-corpo">{me.name}</span>
            <span className="font-medium text-meta text-muted-foreground">{me.email}</span>
          </DropdownMenuLabel>
          {/* Os dois já existem como tela. Ficaram desabilitados aqui por
              esquecimento quando a barra lateral foi ligada — e é neste menu
              que a pessoa procura a própria conta, não no rodapé. */}
          <DropdownMenuItem render={<Link to="/perfil" />}>
            <UserRound size={16} strokeWidth={1.7} aria-hidden />
            Meu perfil
          </DropdownMenuItem>
          {podeConfigurar ? (
            <DropdownMenuItem render={<Link to="/configuracoes" />}>
              <Settings size={16} strokeWidth={1.7} aria-hidden />
              Configurações
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
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
export function AppShell({ me, pendingCalls, unreadNotices, children }: AppShellProps) {
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
        unreadNotices={unreadNotices}
        onSignOut={sair}
      />

      {/*
        Respiro no topo só no celular.
        A casca já tinha `p-4`, e ainda assim a busca encostava na borda — 16px
        é pouco para a primeira coisa da tela num aparelho com entalhe. No
        desktop o espaçamento de sempre continua valendo.
      */}
      <SidebarInset className="pt-7 sm:pt-4 md:pt-5">
        <header className="flex flex-wrap items-center gap-3">
          <SidebarTrigger variant="outline" size="icon" className="shrink-0" />
          <BuscaDeAlunos role={me.role} />
          {/*
            Só no desktop. No celular estes dois controles disputavam a linha
            com o botão da barra e a busca — quatro coisas numa faixa de 375px,
            e a busca, que é o que se usa, era a que encolhia. O bimestre e a
            conta continuam alcançáveis pela barra lateral, que ali é um
            `Sheet` de tela inteira. O corte é em 768px, o mesmo ponto em que
            a barra vira `Sheet` — com limites diferentes havia uma faixa de
            tela em que os dois apareciam ao mesmo tempo, que é justamente a
            duplicação que isto veio eliminar.

            `min-w-0` para o grupo encolher em vez de empurrar a página: sem
            ele o `flex` respeita o conteúdo e o estouro vira rolagem
            horizontal.
          */}
          <div className="ml-auto hidden min-w-0 items-center gap-2 md:flex md:gap-3">
            <ContextBar />
            <MenuDoUsuario me={me} onSignOut={sair} />
          </div>
        </header>

        <main className="flex flex-col gap-5">{children}</main>

        {/* Só dentro da casca: no login não há escola ativa, e o assistente
            não teria de quem falar. */}
        <Astro />
      </SidebarInset>
    </SidebarProvider>
  );
}
