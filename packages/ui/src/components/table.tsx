import { cn } from "@educa-escola/ui/lib/utils";
import type * as React from "react";

/**
 * Table do shadcn, ajustada à identidade do Integra Edu.
 *
 * A linha não tem borda inferior: a separação vem do fundo alternado e do
 * espaçamento, como no mockup da Gestão. O cabeçalho usa o rótulo caixa-alta
 * de 10px da escala do UI kit.
 *
 * O contêiner rola sozinho na horizontal — a página nunca rola de lado, que é
 * regra do design brief para tabela densa.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    /*
     * `min-w-0` não é enfeite: sem ele o `overflow-x-auto` nunca entra em
     * ação. Filho de flex ou de grid nasce com `min-width: auto`, então o
     * contêiner se recusa a ficar menor que a tabela, cresce junto com ela e
     * quem rola de lado é a **página** — no celular, toda tela com tabela
     * passava a arrastar na horizontal.
     */
    <div data-slot="table-container" className="relative w-full min-w-0 overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-collapse text-corpo", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn(className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-border border-t font-bold", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "transition-colors [&>td:first-child]:rounded-l-field [&>td:last-child]:rounded-r-field",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "whitespace-nowrap px-3 pb-2 text-left align-middle font-bold text-muted-foreground text-rotulo uppercase tracking-[0.7px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td data-slot="table-cell" className={cn("px-3 py-3 align-middle", className)} {...props} />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-meta text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
