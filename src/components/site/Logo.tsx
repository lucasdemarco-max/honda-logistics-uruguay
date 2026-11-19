import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/logo-honda.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link to="/" className={cn("group flex items-center gap-3", className)} aria-label="Honda Logistics — inicio">
      <img
        src={logoMark.url}
        alt="Honda"
        width={251}
        height={170}
        className="h-11 w-auto shrink-0 rounded-sm shadow-sm ring-1 ring-black/5"
      />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-xl font-bold uppercase tracking-[0.08em]",
            inverted ? "text-ink-foreground" : "text-foreground",
          )}
        >
          Logistics
        </span>
        <span className={cn("text-[10px] uppercase tracking-[0.22em]", inverted ? "text-ink-muted" : "text-muted-foreground")}>
          Repuestos · Uruguay
        </span>
      </span>
    </Link>
  );
}
