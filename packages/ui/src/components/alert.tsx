import { cn } from "@educa-escola/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const alertVariants = cva(
  "group/alert relative grid w-full gap-1 rounded-card border border-transparent px-6 py-4 text-left text-[13px] has-data-[slot=alert-action]:relative has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg:not([class*='size-'])]:size-[18px] *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        info: "bg-info-soft text-info *:data-[slot=alert-description]:text-info/90",
        success: "bg-success-soft text-success *:data-[slot=alert-description]:text-success/90",
        warning: "bg-warning-soft text-warning *:data-[slot=alert-description]:text-warning/90",
        danger: "bg-danger-soft text-danger *:data-[slot=alert-description]:text-danger/90",
        destructive: "bg-danger-soft text-danger *:data-[slot=alert-description]:text-danger/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/**
 * Alert do shadcn, ajustado ao Integra e com as variantes semânticas de estado
 * (`info`, `success`, `warning`, `danger`) que as telas usam para avisar sobre
 * prazo, pendência e recusa.
 */
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-extrabold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-balance text-muted-foreground text-xs/relaxed md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-2",
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "absolute top-[calc(--spacing(1.25))] right-[calc(--spacing(1.25))]",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertAction, AlertDescription, AlertTitle };
