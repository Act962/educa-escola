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
} from "@educa-escola/ui/components/sidebar";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { Link } from "@tanstack/react-router";
import { GraduationCap, LogOut, Settings, UserRound } from "lucide-react";

import { navigationFor } from "@/lib/navigation";

interface AppSidebarProps {
  role: AppRole;
  schoolName: string;
  pendingCalls?: number;
  onSignOut: () => void;
}

/**
 * Navegação lateral do app, sobre o `Sidebar` do shadcn.
 *
 * Em tela estreita a mesma barra vira um `Sheet` — não existe barra inferior
 * de app mobile: o produto é web, e a navegação continua sendo a lateral.
 */
export function AppSidebar({ role, schoolName, pendingCalls, onSignOut }: AppSidebarProps) {
  const entries = navigationFor(role);
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
            <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.7px]">
              Instituição
            </span>
            <span className="truncate font-extrabold text-[13px]">{schoolName}</span>
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
                    render={<Link to={entry.to as string} />}
                  >
                    <entry.icon strokeWidth={1.7} aria-hidden />
                    <span>{entry.label}</span>
                  </SidebarMenuButton>
                  {entry.badge === "chamadasPendentes" && pendingCalls ? (
                    <SidebarMenuBadge>{pendingCalls}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
            <SidebarMenuButton aria-disabled="true" tooltip="Meu perfil">
              <UserRound strokeWidth={1.7} aria-hidden />
              <span>Meu perfil</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton aria-disabled="true" tooltip="Configurações">
              <Settings strokeWidth={1.7} aria-hidden />
              <span>Configurações</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
