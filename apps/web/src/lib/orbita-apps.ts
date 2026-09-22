import type { AppKey } from "@educa-escola/api/modules/orbita/schema";
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  FolderKanban,
  Globe,
  GraduationCap,
  Link2,
  type LucideIcon,
  MessageCircle,
  Send,
  TrendingUp,
  Workflow,
} from "lucide-react";

/**
 * Os treze apps do ecossistema Órbita.
 *
 * Lista própria em vez de `NavEntry` de propósito: aquele é item de barra
 * lateral — carrega `badge`, e ali "em breve" significa *módulo do requisito
 * ainda não construído*. Aqui significa *app do ecossistema ainda não
 * instalado*, que é outra coisa e pede descrição e categoria.
 *
 * A `key` é a mesma do `appSlug` no catálogo do Órbita: é por ela que o preço
 * é resolvido.
 */
export interface OrbitaApp {
  /**
   * A mesma chave do `appSlug` no catálogo do Órbita.
   *
   * Tipada pela união do servidor de propósito: se esta lista e a de lá
   * divergirem, a tela quebra na compilação em vez de mostrar um card que
   * nunca resolve preço.
   */
  key: AppKey;
  nome: string;
  resumo: string;
  descricao: string;
  categoria: "relacionamento" | "operacao" | "marketing" | "conteudo";
  icon: LucideIcon;
}

export const ORBITA_APPS: OrbitaApp[] = [
  {
    key: "crm-tracking",
    nome: "CRM Tracking",
    resumo: "Funil de atendimento",
    descricao: "Acompanha o interessado desde a primeira conversa até a matrícula.",
    categoria: "relacionamento",
    icon: ClipboardList,
  },
  {
    key: "chat",
    nome: "Chat",
    resumo: "Conversas com as famílias",
    descricao: "Atendimento num lugar só, com histórico por responsável.",
    categoria: "relacionamento",
    icon: MessageCircle,
  },
  {
    key: "agendas",
    nome: "Agendas",
    resumo: "Horários e agendamento",
    descricao: "Atendimento por horário, com confirmação para o responsável.",
    categoria: "operacao",
    icon: CalendarDays,
  },
  {
    key: "forms",
    nome: "Forms",
    resumo: "Formulários e respostas",
    descricao: "Coleta de respostas com link público, sem planilha solta.",
    categoria: "operacao",
    icon: ClipboardList,
  },
  {
    key: "workspace",
    nome: "Workspace",
    resumo: "Automações e fluxos",
    descricao: "Regras que disparam sozinhas: lembrete, aviso, encaminhamento.",
    categoria: "operacao",
    icon: Workflow,
  },
  {
    key: "payment",
    nome: "Payment",
    resumo: "Cobranças e links",
    descricao: "Link de pagamento e baixa automática, para taxas e eventos.",
    categoria: "operacao",
    icon: CreditCard,
  },
  {
    key: "nbox",
    nome: "N-Box",
    resumo: "Pastas e arquivos",
    descricao: "Materiais e documentos, com link compartilhável por pasta.",
    categoria: "conteudo",
    icon: FolderKanban,
  },
  {
    key: "disparo",
    nome: "Disparo",
    resumo: "Campanhas em massa",
    descricao: "Comunicado para uma turma inteira ou para todos os responsáveis.",
    categoria: "relacionamento",
    icon: Send,
  },
  {
    key: "linnker",
    nome: "Linnker",
    resumo: "Página pública de links",
    descricao: "Uma página com os links da escola e um QR para murais e carteirinhas.",
    categoria: "marketing",
    icon: Link2,
  },
  {
    key: "pages",
    nome: "Pages",
    resumo: "Páginas e sites",
    descricao: "Site da escola e páginas de campanha, publicados por aqui.",
    categoria: "marketing",
    icon: Globe,
  },
  {
    key: "route",
    nome: "Route",
    resumo: "Cursos e trilhas",
    descricao: "Formação de professores e trilhas para o aluno, com vídeo.",
    categoria: "conteudo",
    icon: GraduationCap,
  },
  {
    key: "trafego",
    nome: "TrafeGO",
    resumo: "Tráfego pago",
    descricao: "Campanhas de captação de alunos, com o resultado do lado do CRM.",
    categoria: "marketing",
    icon: TrendingUp,
  },
];

/**
 * `astro` fica de fora desta lista de propósito.
 *
 * Ele era o décimo terceiro card da aba Apps, e virou tela nativa: a pergunta
 * vai para o nosso servidor, que monta os fatos do papel de quem perguntou e
 * conversa com o modelo que a escola configurou em Configurações. Deixá-lo no
 * catálogo ofereceria instalar — com custo em Stars — algo que já está aqui.
 *
 * A chave continua em `APP_KEYS`, no servidor: escola que instalou o app do
 * Órbita antes desta mudança tem uma linha em `orbita_app_install` apontando
 * para ela, e tirar a chave da união deixaria essa linha sem tipo.
 */

/** Busca por chave. Devolve `null` para app que o servidor conheça e a tela não. */
export function orbitaAppFor(key: string): OrbitaApp | null {
  return ORBITA_APPS.find((app) => app.key === key) ?? null;
}
