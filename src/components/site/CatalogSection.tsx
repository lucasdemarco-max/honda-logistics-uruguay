import { Link } from "@tanstack/react-router";
import { PageHeader } from "./PageHeader";

export function CatalogSection({
  title,
  description,
  emptyMessage,
}: {
  title: string;
  description: string;
  emptyMessage: string;
}) {
  return (
    <>
      <PageHeader eyebrow="Catálogo Honda Logistics" title={title} description={description}>
        <Link to="/catalogo" className="text-sm font-semibold underline underline-offset-4">
          Catálogo de repuestos
        </Link>
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="rounded-lg border bg-card p-6 text-muted-foreground shadow-card">{emptyMessage}</p>
      </div>
    </>
  );
}
