import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export function DemoNotice({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-md border border-dashed border-warning bg-warning-soft px-4 py-3 text-sm text-warning-foreground",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        {children ??
          "Los productos y marcas marcados como EJEMPLO son datos de demostración: precios, stock y compatibilidades son ilustrativos y no representan ofertas reales."}
      </p>
    </div>
  );
}
