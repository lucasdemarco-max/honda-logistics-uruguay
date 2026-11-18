import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link to="/" className={cn("group flex items-center gap-2.5", className)} aria-label="Honda Logistics — inicio">
      <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary">
        <span className="h-4 w-[3px] skew-x-[-14deg] bg-primary-foreground" />
        <span className="ml-[3px] h-4 w-[3px] skew-x-[-14deg] bg-primary-foreground" />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-xl font-bold uppercase tracking-[0.08em]",
            inverted ? "text-ink-foreground" : "text-foreground",
          )}
        >
          Honda <span className="text-primary">Logistics</span>
        </span>
        <span className={cn("text-[10px] uppercase tracking-[0.22em]", inverted ? "text-ink-muted" : "text-muted-foreground")}>
          Repuestos · Uruguay
        </span>
      </span>
    </Link>
  );
}
