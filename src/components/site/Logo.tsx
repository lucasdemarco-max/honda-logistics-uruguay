import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      to="/"
      className={cn("inline-flex shrink-0 items-center gap-3", inverted ? "gap-4" : "gap-3")}
      aria-label="Honda Logistics — inicio"
    >
      <img
        src="https://www.hondauruguay.com/assets/images/static/logo-honda-footer.svg"
        alt="Honda"
        width={150}
        height={42}
        className={cn("h-8 w-auto", inverted && "brightness-0 invert")}
      />
      <span className={cn("border-l pl-3 text-sm font-semibold leading-none tracking-wide", inverted ? "border-ink-border text-ink-foreground" : "border-border text-foreground")}>
        LOGISTICS
      </span>
    </Link>
  );
}
