import { cn } from "@educa-escola/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const avatar = cva(
  "inline-flex shrink-0 select-none items-center justify-center rounded-control font-bold",
  {
    variants: {
      tone: {
        info: "bg-info-soft text-info",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        neutral: "bg-secondary text-secondary-foreground",
      },
      size: {
        sm: "size-8 text-[11px]",
        md: "size-10 text-xs",
        lg: "size-20 rounded-[1.375rem] text-2xl",
      },
    },
    defaultVariants: { tone: "info", size: "md" },
  },
);

/**
 * "Ana Clara Souza Lima" -> "AC".
 *
 * As duas **primeiras** palavras, e não a primeira com a última: no Brasil o
 * nome de tratamento está no começo ("Ana Clara"), enquanto o fim costuma ser
 * o sobrenome de família, que se repete entre irmãos.
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

interface InitialsAvatarProps extends VariantProps<typeof avatar> {
  name: string;
  className?: string;
}

/**
 * Iniciais no lugar de foto.
 *
 * O tom vem de fora, do **estado** da linha (aluno em alerta fica em vermelho),
 * nunca de um hash do nome: cor derivada de nome vira informação falsa, porque
 * o leitor tenta atribuir sentido a ela.
 */
export function InitialsAvatar({ name, tone, size, className }: InitialsAvatarProps) {
  return (
    <span className={cn(avatar({ tone, size, className }))} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}
