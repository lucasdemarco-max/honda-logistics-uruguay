import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchBoxProps {
  size?: "default" | "lg";
  initial?: string;
  className?: string;
  onSearch?: (query: string | undefined) => void;
}

export function SearchBox({ size = "default", initial = "", className, onSearch }: SearchBoxProps) {
  const [q, setQ] = useState(initial);
  const inputId = useId();
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className={cn(
        "flex w-full items-stretch overflow-hidden rounded-md border bg-card shadow-card",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim() || undefined;
        if (onSearch) onSearch(query);
        else void navigate({ to: "/catalogo", search: { q: query } });
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Buscar por código Honda, SKU o nombre
      </label>
      <div className="flex flex-1 items-center gap-2 pl-4">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          id={inputId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Código Honda, SKU o nombre del repuesto"
          className={cn(
            "w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none",
            size === "lg" ? "h-14 text-base" : "h-10 text-sm",
          )}
        />
      </div>
      <Button
        type="submit"
        className={cn("rounded-none", size === "lg" ? "h-14 px-8 text-base" : "h-10")}
      >
        Buscar
      </Button>
    </form>
  );
}
