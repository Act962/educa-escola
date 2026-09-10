import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@educa-escola/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Badge do shadcn, ajustado à identidade do Integra Edu.
 *
 * Vira pílula (`rounded-full`) e ganha as variantes semânticas de estado que a
 * tela usa o tempo todo: `success`, `warning`, `danger`, `info`.
 *
 * **A cor nunca é a única portadora do sentido.** O texto dentro do badge diz
 * o que está acontecendo ("Chamada pendente", "Recuperação") — é exigência de
 * acessibilidade e é o que faz a tela funcionar impressa em preto e branco.
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-2.5 py-1 font-bold text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        neutral: "bg-secondary text-secondary-foreground",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        destructive: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function Badge({
  className,
  variant = "neutral",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: "badge", variant },
  });
}

export { Badge, badgeVariants };
