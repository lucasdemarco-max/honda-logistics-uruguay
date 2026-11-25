import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      to="/"
      className={cn("inline-flex shrink-0 gap-2", inverted ? "items-center gap-4" : "flex-col")}
      aria-label="Honda Logistics — inicio"
    >
      {inverted ? (
        <img src="/brand/honda-emblem-white.svg" alt="" width={275} height={175} className="h-10 w-auto" />
      ) : (
        <img src="/brand/honda-power-of-dreams.svg" alt="" width={2234} height={521} className="h-7 w-auto" />
      )}
      <span className={cn("text-sm font-semibold leading-none", inverted ? "text-ink-foreground" : "text-foreground")}>
        Logistics
      </span>
    </Link>
  );
}
