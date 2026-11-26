import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-b bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        {eyebrow && <p className="eyebrow mb-3 text-primary">{eyebrow}</p>}
        <h1 className="text-4xl font-bold leading-tight md:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-base text-ink-muted">{description}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
