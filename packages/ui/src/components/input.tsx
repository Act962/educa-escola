import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@educa-escola/ui/lib/utils";
import type * as React from "react";

/**
 * Input do shadcn, ajustado ao Integra: 44px de altura, raio de 14px e fundo
 * `muted`. A borda some — o campo se distingue do card pelo preenchimento,
 * como no mockup.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "min-h-11 w-full min-w-0 rounded-control border border-transparent bg-muted px-3 text-[13px] outline-none transition-colors file:inline-flex file:border-0 file:bg-transparent file:font-bold file:text-[13px] file:text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
