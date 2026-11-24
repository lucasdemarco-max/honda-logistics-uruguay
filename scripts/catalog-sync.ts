import {
  buildProductPatch,
  prepareImport,
  type CatalogLookup,
  type ImportRecord,
  type ImportRow,
  type LookupReference,
} from "../src/lib/admin-import.ts";
import type { CatalogProduct } from "../src/lib/public.functions.ts";

type Compatibility = Omit<CatalogProduct["compat"][number], "model_id"> & {
  model_id?: string;
};

// Existing snapshots may predate model_id. Keep those records unchanged and
// attach an ID only when an explicitly supplied application is added.
export type CatalogSnapshotProduct = Omit<CatalogProduct, "compat"> & {
  compat: Compatibility[];
};

export interface CatalogSyncResult {
  products: CatalogSnapshotProduct[];
  added: number;
  updated: number;
  unchanged: number;
  addedCompatibilities: number;
  newCategories: number;
  newModels: number;
}

function addLookup(lookups: Map<string, CatalogLookup>, value: CatalogLookup, label: string) {
  const byId = lookups.get(value.id);
  if (byId && (byId.slug !== value.slug || byId.name !== value.name)) {
    throw new Error(`El catálogo base contiene un ${label} contradictorio: ${value.id}`);
  }
  const bySlug = [...lookups.values()].find((item) => item.slug === value.slug);
  if (bySlug && bySlug.id !== value.id) {
    throw new Error(
      `El catálogo base contiene dos ${label} con el mismo identificador: ${value.slug}`,
    );
  }
  lookups.set(value.id, value);
}

export function snapshotLookups(products: CatalogSnapshotProduct[]) {
  const categories = new Map<string, CatalogLookup>();
  const models = new Map<string, CatalogLookup>();
  const explicitModelIds = new Map<string, string>();
  for (const product of products) {
    for (const application of product.compat) {
      if (!application.model_id) continue;
      const previous = explicitModelIds.get(application.model_slug);
      if (previous && previous !== application.model_id) {
        throw new Error(
          `El catálogo base contiene dos IDs para el modelo ${application.model_slug}`,
        );
      }
      explicitModelIds.set(application.model_slug, application.model_id);
    }
  }
  for (const product of products) {
    if (product.category) {
      addLookup(categories, product.category, "categoría");
    }
    for (const application of product.compat) {
      const id =
        explicitModelIds.get(application.model_slug) ?? `local-model:${application.model_slug}`;
      addLookup(models, { id, name: application.model, slug: application.model_slug }, "modelo");
    }
  }
  return { categories: [...categories.values()], models: [...models.values()] };
}

const localReference = (reference: LookupReference, kind: "category" | "model") => ({
  id: reference.isNew ? `local-${kind}:${reference.slug}` : reference.id,
  name: reference.name,
  slug: reference.slug,
});

function mergeApplication(
  applications: Compatibility[],
  row: ImportRow,
  model: CatalogLookup,
): { applications: Compatibility[]; added: number } {
  const sameApplication = (application: Compatibility) =>
    (application.model_id === model.id || application.model_slug === model.slug) &&
    application.year_from === row.yearFrom &&
    application.year_to === row.yearTo;
  const existing = applications.filter(sameApplication);
  if (existing.length > 0) {
    // A blank note is an omitted value, not a request to erase a prior note.
    if (!row.compatibilityNotes || existing.some((item) => item.notes === row.compatibilityNotes)) {
      return { applications, added: 0 };
    }
    if (existing.some((item) => item.notes)) {
      throw new Error(
        `Fila ${row.rowNumber}: las notas de la compatibilidad de ${row.sku} contradicen el catálogo base`,
      );
    }
    return {
      applications: applications.map((application) =>
        sameApplication(application)
          ? { ...application, notes: row.compatibilityNotes }
          : application,
      ),
      added: 0,
    };
  }
  return {
    applications: [
      ...applications,
      {
        model_id: model.id,
        model: model.name,
        model_slug: model.slug,
        year_from: row.yearFrom,
        year_to: row.yearTo,
        notes: row.compatibilityNotes || null,
      },
    ],
    added: 1,
  };
}

export function synchronizeCatalog(
  records: ImportRecord[],
  existing: CatalogSnapshotProduct[],
  now = new Date().toISOString(),
): CatalogSyncResult {
  const { categories, models } = snapshotLookups(existing);
  const preview = prepareImport(records, categories, models);
  const errors = preview.rows.flatMap((row) => (row.error ? [row.error] : []));
  if (errors.length) {
    throw new Error(`No se guardó ningún cambio. Corregí el archivo:\n${errors.join("\n")}`);
  }
  const productsBySku = new Map(existing.map((product) => [product.sku, product]));
  if (productsBySku.size !== existing.length) {
    throw new Error("El catálogo base contiene SKU repetidos; resolvelos antes de sincronizar");
  }
  const groups = new Map<string, ImportRow[]>();
  for (const row of preview.rows) {
    groups.set(row.sku, [...(groups.get(row.sku) ?? []), row]);
  }
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let addedCompatibilities = 0;

  for (const [sku, rows] of groups) {
    const row = rows[0]!;
    if (!row.category) throw new Error(`Fila ${row.rowNumber}: falta una categoría válida`);
    const category = localReference(row.category, "category");
    const patch = buildProductPatch({ ...row, categoryId: category.id });
    const previous = productsBySku.get(sku);
    const base: CatalogSnapshotProduct = previous ?? {
      id: `local-product:${sku}`,
      sku,
      name: row.name,
      honda_code: null,
      description: null,
      category_id: category.id,
      brand_id: null,
      honda_relation: null,
      homologation_reference: null,
      price_uyu: null,
      stock: null,
      availability: "consultar",
      image_url: null,
      promo_text: null,
      active: true,
      is_demo: false,
      created_at: now,
      updated_at: now,
      category: { ...category, image_key: null },
      brand: null,
      compat: [],
    };
    let compat = [...base.compat];
    for (const applicationRow of rows) {
      if (!applicationRow.model) continue;
      const result = mergeApplication(
        compat,
        applicationRow,
        localReference(applicationRow.model, "model"),
      );
      compat = result.applications;
      addedCompatibilities += result.added;
    }
    const next: CatalogSnapshotProduct = {
      ...base,
      ...patch,
      category:
        base.category?.id === category.id ? base.category : { ...category, image_key: null },
      compat,
    };
    if (!previous) {
      added += 1;
    } else if (JSON.stringify(next) === JSON.stringify(previous)) {
      unchanged += 1;
    } else {
      next.updated_at = now;
      updated += 1;
    }
    productsBySku.set(sku, next);
  }

  return {
    products: [...productsBySku.values()],
    added,
    updated,
    unchanged,
    addedCompatibilities,
    newCategories: preview.newCategories.length,
    newModels: preview.newModels.length,
  };
}
