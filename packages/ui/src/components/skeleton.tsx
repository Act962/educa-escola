import { cn } from "@educa-escola/ui/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-field bg-secondary", className)}
      {...props}
    />
  );
}

export { Skeleton };
