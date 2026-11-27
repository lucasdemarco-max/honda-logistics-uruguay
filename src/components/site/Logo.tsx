import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      to="/"
      className={cn(
        "inline-flex shrink-0 flex-col items-center gap-1 text-[10px] font-semibold leading-none tracking-wide",
        inverted ? "text-ink-foreground" : "text-foreground",
      )}
      aria-label="Honda Logistics — inicio"
    >
      <img
        src="/brand/honda-emblem-white.svg"
        alt=""
        width={35}
        height={22}
        className={cn("h-[22px] w-auto", !inverted && "brightness-0")}
      />
      HONDA LOGISTICS
    </Link>
  );
}
