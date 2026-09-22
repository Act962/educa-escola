import type { AppRole } from "@educa-escola/auth";
import {
  BarChart3,
  Blocks,
  BookOpen,
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  FileText,
  FolderOpen,
  GraduationCap,
  Home,
  IdCard,
  LayoutGrid,
  type LucideIcon,
  MessageCircle,
  Sparkles,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

export interface NavEntry {
  label: string;
  to?: string;
  icon: LucideIcon;
  /**
   * Item previsto no requisito e ainda não construído. Aparece desabilitado em
   * vez de sumir: esconder o roadmap faz o produto parecer menor do que é, e
   * um link que leva a lugar nenhum é pior que um item honestamente inativo.
   */
  /**
   * Parâmetros da rota, quando `to` é um padrão dinâmico.
   *
   * Existe por causa do Financeiro, que não é tela nativa: ele aponta para a
   * aba de um app do Órbita (`/apps/$appKey`). Resolver o caminho à mão
   * (`/apps/payment`) funcionaria por acidente — o roteador casa por padrão,
   * não por string pronta.
   */
  params?: Record<string, string>;
  soon?: boolean;
  badge?: "chamadasPendentes";
}

const GESTAO: NavEntry[] = [
  { label: "Início", to: "/inicio", icon: Home },
  { label: "Alunos", to: "/alunos", icon: GraduationCap },
  { label: "Turmas", to: "/turmas", icon: LayoutGrid },
  { label: "Apps", to: "/apps", icon: Blocks },
  { label: "Professores", to: "/professores", icon: Users },
  { label: "Matrículas", to: "/matriculas", icon: IdCard },
  { label: "Acadêmico", to: "/academico", icon: BookOpen },
  { label: "Frequência", to: "/frequencia", icon: ClipboardCheck },
  /**
   * O financeiro é o app Payment do Órbita, não uma tela daqui.
   *
   * DECISÃO-JOÃO: isto tira o financeiro do banco da escola.
   * Quebra se: a escola esperar cruzar inadimplência com matrícula e
   *   frequência — os relatórios da §15.3 do requisito passam a depender de
   *   dado que mora no Órbita, e não há junção possível entre os dois bancos.
   * Fiz assim: item de menu apontando para a aba do app, que é reversível em
   *   três linhas se um financeiro nativo entrar no roadmap.
   * Alternativas: módulo financeiro nativo (§14 do requisito) · Payment como
   *   é agora, com um resumo lido por API para os relatórios daqui.
   */
  { label: "Financeiro", to: "/apps/$appKey", params: { appKey: "payment" }, icon: Wallet },
  { label: "Comunicados", icon: MessageCircle, soon: true },
  { label: "Calendário", icon: CalendarDays, soon: true },
  { label: "Pontuação", to: "/pontuacao", icon: Sparkles },
  { label: "Placar entre escolas", to: "/placar-escolas", icon: Trophy },
  { label: "Relatórios", icon: BarChart3, soon: true },
];

const PROFESSOR: NavEntry[] = [
  { label: "Início", to: "/inicio", icon: Home },
  { label: "Minhas turmas", to: "/turmas", icon: Users },
  { label: "Chamada", to: "/chamada", icon: CircleCheck, badge: "chamadasPendentes" },
  { label: "Notas e avaliações", to: "/notas", icon: BookOpen },
  { label: "Meus pontos", to: "/meus-pontos", icon: Sparkles },
  { label: "Atividades", icon: FileText, soon: true },
  { label: "Agenda", icon: CalendarDays, soon: true },
  { label: "Comunicados", icon: MessageCircle, soon: true },
];

const ALUNO: NavEntry[] = [
  { label: "Início", to: "/inicio", icon: Home },
  { label: "Minhas notas", to: "/boletim", icon: BookOpen },
  { label: "Frequência", to: "/frequencia", icon: ClipboardCheck },
  { label: "Meus pontos", to: "/pontos", icon: Sparkles },
  { label: "Atividades", icon: FileText, soon: true },
  { label: "Materiais", icon: FolderOpen, soon: true },
  { label: "Agenda", icon: CalendarDays, soon: true },
  { label: "Comunicados", icon: MessageCircle, soon: true },
];

/**
 * Menu por papel.
 *
 * Esconder item é conforto, não segurança: quem forjar a rota esbarra no
 * `permitted()` do servidor. O menu existe para a pessoa não tropeçar no que
 * não é dela.
 */
export function navigationFor(role: AppRole): NavEntry[] {
  if (role === "teacher") return PROFESSOR;
  if (role === "student") return ALUNO;
  return GESTAO;
}

export function roleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    owner: "Direção",
    admin: "Secretaria",
    teacher: "Professor",
    student: "Aluno",
  };
  return labels[role];
}
