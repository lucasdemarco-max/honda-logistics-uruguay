import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SearchBox({ size = "default", initial = "", className }: { size?: "default" | "lg"; initial?: string; className?: string }) {
  const [q, setQ] = useState(initial);
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className={cn("flex w-full items-stretch overflow-hidden rounded-md border bg-card shadow-card", className)}
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ to: "/catalogo", search: { q: q.trim() || undefined } });
      }}
    >
      <label htmlFor={`search-${size}`} className="sr-only">
        Buscar repuestos por nombre, código o modelo
      </label>
      <div className="flex flex-1 items-center gap-2 pl-4">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          id={`search-${size}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscá por nombre, código Honda o modelo (ej. filtro Civic)"
          className={cn(
            "w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none",
            size === "lg" ? "h-14 text-base" : "h-10 text-sm",
          )}
        />
      </div>
      <Button type="submit" className={cn("rounded-none", size === "lg" ? "h-14 px-8 text-base" : "h-10")}>
        Buscar
      </Button>
    </form>
  );
}
