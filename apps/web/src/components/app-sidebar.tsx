import type { AppRole } from "@educa-escola/auth";
import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@educa-escola/ui/components/sidebar";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GraduationCap, LogOut, Settings, UserRound } from "lucide-react";

import { appOrbitaDe } from "@/lib/apps-orbita";
import { navigationFor } from "@/lib/navigation";
import { useTRPC } from "@/utils/trpc";

/**
 * Recolhe a barra depois de navegar.
 *
 * Em tela estreita a barra é um `Sheet` por cima do conteúdo: deixá-la aberta
 * esconde justamente a tela para onde a pessoa acabou de ir. Em tela larga ela
 * recolhe para os ícones — o caminho de volta continua visível, e o conteúdo
 * ganha a largura, que é o que a pessoa foi buscar ao clicar.
 *
 * Fica num hook porque três listas de itens precisam do mesmo gesto, e um
 * `onClick` esquecido em uma delas seria um item que se comporta diferente dos
 * outros sem ninguém saber por quê.
 */
function useRecolherAoNavegar() {
  const { isMobile, setOpen, setOpenMobile } = useSidebar();
  return () => (isMobile ? setOpenMobile(false) : setOpen(false));
}

interface AppSidebarProps {
  role: AppRole;
  schoolName: string;
  pendingCalls?: number;
  unreadNotices?: number;
  onSignOut: () => void;
}

/**
 * Navegação lateral do app, sobre o `Sidebar` do shadcn.
 *
 * Em tela estreita a mesma barra vira um `Sheet` — não existe barra inferior
 * de app mobile: o produto é web, e a navegação continua sendo a lateral.
 */
export function AppSidebar({
  role,
  schoolName,
  pendingCalls,
  unreadNotices,
  onSignOut,
}: AppSidebarProps) {
  const entries = navigationFor(role);
  const recolher = useRecolherAoNavegar();
  const podeConfigurar = role === "owner" || role === "admin";
  const disponiveis = entries.filter((entry) => entry.to);
  const previstos = entries.filter((entry) => !entry.to);

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader className="gap-4 p-0">
        <Link
          to="/inicio"
          className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <GraduationCap
            size={26}
            strokeWidth={1.7}
            className="shrink-0 text-primary"
            aria-hidden
          />
          <span className="truncate font-extrabold text-lg tracking-[-0.4px] group-data-[collapsible=icon]:hidden">
            Integra<span className="text-primary">Edu</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 rounded-control bg-muted p-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <Avatar size="sm">
            <AvatarFallback>{initialsOf(schoolName)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-muted-foreground text-rotulo uppercase tracking-[0.7px]">
              Instituição
            </span>
            <span className="truncate font-extrabold text-corpo">{schoolName}</span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-4 overflow-x-hidden">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {disponiveis.map((entry) => (
                <SidebarMenuItem key={entry.label}>
                  <SidebarMenuButton
                    tooltip={entry.label}
                    onClick={recolher}
                    render={<Link to={entry.to as string} params={entry.params ?? {}} />}
                  >
                    <entry.icon
                      strokeWidth={1.7}
                      aria-hidden
                      className={entry.destaque ? "text-primary" : undefined}
                    />
                    <span>{entry.label}</span>
                  </SidebarMenuButton>
                  {/* O contador só aparece quando há o que fazer: um "0"
                      permanente ao lado do item vira ruído e some da vista. */}
                  {entry.badge === "chamadasPendentes" && pendingCalls ? (
                    <SidebarMenuBadge>{pendingCalls}</SidebarMenuBadge>
                  ) : entry.badge === "comunicadosNaoLidos" && unreadNotices ? (
                    <SidebarMenuBadge>{unreadNotices}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <AppsInstalados />

        {previstos.length > 0 ? (
          <SidebarGroup className="p-0 group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Em breve</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/*
                 * Módulo previsto no requisito e ainda não construído. Aparece
                 * desabilitado em vez de sumir: esconder o roadmap faz o
                 * produto parecer menor, e link que não leva a lugar nenhum é
                 * pior que item honestamente inativo.
                 */}
                {previstos.map((entry) => (
                  <SidebarMenuItem key={entry.label}>
                    <SidebarMenuButton
                      aria-disabled="true"
                      className="text-muted-foreground"
                      title="Módulo previsto no requisito, ainda não construído"
                    >
                      <entry.icon strokeWidth={1.7} aria-hidden />
                      <span>{entry.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="mt-auto p-0">
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Meu perfil"
              onClick={recolher}
              render={<Link to="/perfil" />}
            >
              <UserRound strokeWidth={1.7} aria-hidden />
              <span>Meu perfil</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/*
            Configurações é da instituição, não da conta: o servidor exige
            `organization: ["update"]`, que professor e aluno não têm. Mostrar
            o item para eles levaria a uma tela de "sem permissão" — esconder
            aqui é conforto, e a barreira continua sendo o `permitted()`.
          */}
          {podeConfigurar ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Configurações"
                onClick={recolher}
                render={<Link to="/configuracoes" />}
              >
                <Settings strokeWidth={1.7} aria-hidden />
                <span>Configurações</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSignOut} tooltip="Sair">
              <LogOut strokeWidth={1.7} aria-hidden />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * Os apps do Órbita que a escola instalou, na barra lateral.
 *
 * É o que torna "aba própria dentro do Integra" verdade: sem isso o app existe,
 * mas só se chega a ele passando pela grade. Usa `orbita.installed`, que lê só
 * a tabela local — `overview` chama o Órbita para resolver preço e saldo, e
 * pagar isso em toda navegação para desenhar três itens seria caro.
 */
function AppsInstalados() {
  const trpc = useTRPC();
  const recolher = useRecolherAoNavegar();
  const instalados = useQuery({
    ...trpc.orbita.installed.queryOptions(),
    // Quem não tem `app: ["read"]` recebe 403; é resposta esperada, não falha
    // que mereça repetição.
    retry: false,
  });

  const apps = (instalados.data ?? [])
    .map((linha) => appOrbitaDe(linha.appKey))
    .filter((app): app is NonNullable<typeof app> => app !== null);

  if (apps.length === 0) return null;

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel>Apps instalados</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {apps.map((app) => (
            <SidebarMenuItem key={app.key}>
              <SidebarMenuButton
                tooltip={app.nome}
                onClick={recolher}
                render={<Link to="/apps/$appKey" params={{ appKey: app.key }} />}
              >
                <app.icon strokeWidth={1.7} aria-hidden />
                <span>{app.nome}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
