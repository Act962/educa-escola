import { cn } from "@educa-escola/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, Lock } from "lucide-react";

import { Panel } from "./panel";

interface StateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

function BaseState({
  icon: Icon,
  tone,
  title,
  description,
  action,
  className,
}: StateProps & { icon: LucideIcon; tone: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <span className={cn("flex size-11 items-center justify-center rounded-control", tone)}>
        <Icon size={20} strokeWidth={1.7} aria-hidden />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-extrabold text-base tracking-[-0.2px]">{title}</p>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
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
 * pode "piscar" de vazia para cheia a cada navegação.
 */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: rows }, (_, index) => index).map((index) => (
        <div key={index} className="flex items-center gap-3 rounded-field bg-muted p-3">
          <div className="size-10 animate-pulse rounded-control bg-secondary" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-secondary" />
            <div className="h-2.5 w-1/5 animate-pulse rounded-full bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ title, rows }: { title: string; rows?: number }) {
  return (
    <Panel>
      <p className="mb-4 font-extrabold text-base tracking-[-0.2px]">{title}</p>
      <ListSkeleton rows={rows} />
    </Panel>
  );
}
