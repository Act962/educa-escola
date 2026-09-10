import type { AppRole } from "@educa-escola/auth";
import {
  BarChart3,
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
  soon?: boolean;
  badge?: "chamadasPendentes";
}

const GESTAO: NavEntry[] = [
  { label: "Início", to: "/inicio", icon: Home },
  { label: "Alunos", to: "/alunos", icon: GraduationCap },
  { label: "Turmas", to: "/turmas", icon: LayoutGrid },
  { label: "Professores", icon: Users, soon: true },
  { label: "Matrículas", icon: IdCard, soon: true },
  { label: "Acadêmico", icon: BookOpen, soon: true },
  { label: "Frequência", icon: ClipboardCheck, soon: true },
  { label: "Financeiro", icon: Wallet, soon: true },
  { label: "Comunicados", icon: MessageCircle, soon: true },
  { label: "Calendário", icon: CalendarDays, soon: true },
  { label: "Relatórios", icon: BarChart3, soon: true },
];

const PROFESSOR: NavEntry[] = [
  { label: "Início", to: "/inicio", icon: Home },
  { label: "Minhas turmas", to: "/turmas", icon: Users },
  { label: "Chamada", to: "/chamada", icon: CircleCheck, badge: "chamadasPendentes" },
  { label: "Notas e avaliações", to: "/notas", icon: BookOpen },
  { label: "Atividades", icon: FileText, soon: true },
  { label: "Agenda", icon: CalendarDays, soon: true },
  { label: "Comunicados", icon: MessageCircle, soon: true },
];

const ALUNO: NavEntry[] = [
  { label: "Início", to: "/inicio", icon: Home },
  { label: "Minhas notas", to: "/boletim", icon: BookOpen },
  { label: "Frequência", to: "/frequencia", icon: ClipboardCheck },
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
