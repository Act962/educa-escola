import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@educa-escola/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Button do shadcn, ajustado à identidade do Integra Edu.
 *
 * Três mudanças em relação ao original: raio de 14px (`rounded-control`) em
 * vez de `rounded-none`, altura mínima de 44px no tamanho padrão — alvo de
 * toque confortável, exigência do design brief — e corpo de 13px em negrito,
 * que é o "corpo / item de navegação" da escala do UI kit.
 *
 * As variantes `success` e `warning` existem porque a tela de chamada precisa
 * de ação afirmativa em verde e de aviso em âmbar sem escrever cor solta.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control border border-transparent bg-clip-padding font-bold text-[13px] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-[18px] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border-border bg-card hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-muted text-secondary-foreground hover:bg-secondary",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        success: "bg-success-soft text-success hover:bg-success-soft/70",
        warning: "bg-warning-soft text-warning hover:bg-warning-soft/70",
        destructive: "bg-danger text-card hover:bg-danger/90",
        link: "text-info underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "min-h-9 px-3 text-xs",
        lg: "min-h-12 px-5 text-sm",
        icon: "size-11",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-7 rounded-field [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
