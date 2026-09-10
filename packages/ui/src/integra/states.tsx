import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@educa-escola/ui/components/empty";
import { Skeleton } from "@educa-escola/ui/components/skeleton";
import { cn } from "@educa-escola/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, Lock } from "lucide-react";

interface StateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Os quatro estados obrigatórios de toda tela (design brief §5), montados
 * sobre o `Empty` do shadcn.
 *
 * Existem como componentes nomeados, e não como `<Empty>` solto em cada tela,
 * porque o texto de cada um segue uma regra: erro explica a causa, sem
 * permissão explica o motivo **sem revelar que o dado existe**.
 */
function BaseState({
  icon: Icon,
  tone,
  title,
  description,
  action,
  className,
}: StateProps & { icon: LucideIcon; tone: string }) {
  return (
    <Empty className={cn("border-none", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className={tone}>
          <Icon strokeWidth={1.7} aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/** Vazio não é erro: diz o que falta e oferece o próximo passo. */
export function EmptyState(props: StateProps) {
  return <BaseState icon={Inbox} tone="bg-secondary text-secondary-foreground" {...props} />;
}

/** Erro explica a causa em português e preserva o que a pessoa digitou. */
export function ErrorState(props: StateProps) {
  return <BaseState icon={AlertTriangle} tone="bg-danger-soft text-danger" {...props} />;
}

/**
 * Sem permissão: explica o motivo **sem revelar que o dado existe**.
 *
 * "Você não tem acesso às notas do 9º B" já conta que o 9º B existe e tem
 * notas. A frase certa fala do papel, não do recurso.
 */
export function PermissionState(props: StateProps) {
  return <BaseState icon={Lock} tone="bg-warning-soft text-warning" {...props} />;
}

/**
 * Esqueleto com a forma do conteúdo, nunca spinner de tela cheia: a página não
 * pode piscar de vazia para cheia a cada navegação.
 */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: rows }, (_, index) => index).map((index) => (
        <div key={index} className="flex items-center gap-3 rounded-field bg-muted p-3">
          <Skeleton className="size-10 rounded-control" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-1/3 rounded-full" />
            <Skeleton className="h-2.5 w-1/5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
