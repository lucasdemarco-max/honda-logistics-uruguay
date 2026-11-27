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
        src={inverted ? "/brand/honda-emblem-white.svg" : "/brand/honda-uruguay-header.svg"}
        alt=""
        width={inverted ? 35 : 145}
        height={inverted ? 22 : 14}
        className={inverted ? "h-[22px] w-auto" : "h-auto w-[118px] sm:w-[145px]"}
      />
      {inverted ? "HONDA LOGISTICS" : "LOGISTICS"}
    </Link>
  );
}
