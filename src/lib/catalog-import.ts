import type { Database } from "@/integrations/supabase/types";
import existingCatalog from "@/data/filtros.json";
import {
  prepareImportRecords,
  type CatalogLookup,
  type ImportPlan,
  type ImportRecord,
  type ImportRow,
} from "./admin-import";

type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductWrite = Database["public"]["Tables"]["products"]["Insert"];
export type Compatibility = Database["public"]["Tables"]["product_compatibilities"]["Row"];
export type CompatibilityWrite = Omit<Compatibility, "id"> & { id?: string };
export interface ImportLookups {
  categories: CatalogLookup[];
  models: CatalogLookup[];
}

/** The adapter uses the signed-in user's client. RLS remains the write authority. */
export interface CatalogImportStore {
  authorize(): Promise<void>;
  getLookups(): Promise<ImportLookups>;
  createLookups(kind: "categories" | "models", items: CatalogLookup[]): Promise<number>;
  getProducts(skus: string[]): Promise<Product[]>;
  getCompatibilities(productIds: string[]): Promise<Compatibility[]>;
  saveProduct(values: ProductWrite, existingId?: string): Promise<{ id: string; sku: string }>;
  addCompatibilities(values: CompatibilityWrite[]): Promise<number>;
}

export interface ImportProgress {
  categories: number;
  models: number;
  createdProducts: number;
  updatedProducts: number;
  compatibilities: number;
}

export class CatalogImportError extends Error {
  constructor(
    message: string,
    readonly progress: ImportProgress,
  ) {
    super(message);
    this.name = "CatalogImportError";
  }
}

const localBySku = new Map(existingCatalog.map((product) => [product.sku, product]));

/** Public RLS cannot expose an inactive DB row as a tombstone for a bundled SKU. */
export function applyImportSafety(plan: ImportPlan): ImportPlan {
  return {
    ...plan,
    rows: plan.rows.map((row) => {
      if (!localBySku.has(row.sku) || !row.provided.active || row.active) return row;
      const message = `SKU ${row.sku}: para desactivar una referencia del catálogo verificado, actualizá también ese catálogo mediante Lovable. La importación no puede retirarla solo de la base de datos.`;
      return { ...row, error: row.error ? `${row.error}; ${message}` : message };
    }),
  };
}

/** Blank optional cells never erase saved values. Zero and false are explicit updates. */
export function productWriteFromRow(row: ImportRow, existing?: Product): ProductWrite {
  const values: ProductWrite = {
    sku: row.sku,
    name: row.name,
    category_id: row.categoryId,
  };
  if (!existing) {
    // A bundled product is also existing data: preserve its commercial fields on first DB import.
    const local = localBySku.get(row.sku);
    if (local) {
      Object.assign(values, {
        honda_code: local.honda_code,
        description: local.description,
        price_uyu: local.price_uyu,
        stock: local.stock,
        availability: local.availability,
        active: local.active,
        image_url: local.image_url,
        promo_text: local.promo_text,
        honda_relation: local.honda_relation,
        homologation_reference: local.homologation_reference,
        is_demo: local.is_demo,
      });
    }
  }
  if (row.provided.hondaCode) values.honda_code = row.hondaCode;
  if (row.provided.description) values.description = row.description;
  if (row.provided.price) values.price_uyu = row.price;
  if (row.provided.stock) values.stock = row.stock;
  if (row.provided.availability) values.availability = row.availability;
  if (row.provided.active) values.active = row.active;
  return values;
}

const applicationKey = (value: Omit<CompatibilityWrite, "notes">) =>
  JSON.stringify([value.product_id, value.model_id, value.year_from, value.year_to]);
const notesKey = (notes: string | null) => notes?.trim() || "";

/** Add applications; never delete old ranges or notes omitted by a partial workbook. */
export function planCompatibilityAdditions(
  rows: ImportRow[],
  productIds: Map<string, string>,
  current: Compatibility[],
): CompatibilityWrite[] {
  const byApplication = new Map<string, Set<string>>();
  for (const value of current) {
    const key = applicationKey(value);
    const notes = byApplication.get(key) ?? new Set<string>();
    notes.add(notesKey(value.notes));
    byApplication.set(key, notes);
  }
  const additions: CompatibilityWrite[] = [];
  // Prefer rows carrying explicit notes over their blank duplicates.
  const sorted = [...rows].sort(
    (a, b) => Number(b.provided.compatibilityNotes) - Number(a.provided.compatibilityNotes),
  );
  for (const row of sorted) {
    if (!row.modelId) continue;
    const productId = productIds.get(row.sku);
    if (!productId) throw new Error(`No se confirmó el producto ${row.sku}`);
    const value: CompatibilityWrite = {
      product_id: productId,
      model_id: row.modelId,
      year_from: row.yearFrom,
      year_to: row.yearTo,
      notes: row.compatibilityNotes.trim() || null,
    };
    const key = applicationKey(value);
    const existingNotes = byApplication.get(key);
    const note = notesKey(value.notes);
    if (existingNotes && (!note || existingNotes.has(note))) continue;
    additions.push(value);
    const notes = existingNotes ?? new Set<string>();
    notes.add(note);
    byApplication.set(key, notes);
  }
  return additions;
}

/** Deterministic UUID v8 makes retries/concurrent identical additions safe with the existing PK. */
export async function compatibilityId(value: CompatibilityWrite): Promise<string> {
  const key = `${applicationKey(value)}:${notesKey(value.notes)}`;
  const hash = new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)),
  );
  hash[6] = (hash[6]! & 0x0f) | 0x80;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = Array.from(hash.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const messageOf = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "Ocurrió un error inesperado";
};

export async function executeCatalogImport(
  records: ImportRecord[],
  store: CatalogImportStore,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportProgress> {
  const progress: ImportProgress = {
    categories: 0,
    models: 0,
    createdProducts: 0,
    updatedProducts: 0,
    compatibilities: 0,
  };
  const report = () => onProgress?.({ ...progress });
  try {
    if (!records.length) throw new Error("El archivo no contiene productos");
    await store.authorize();
    const initialLookups = await store.getLookups();
    let plan = applyImportSafety(
      prepareImportRecords(records, initialLookups.categories, initialLookups.models),
    );
    const invalid = plan.rows.find((row) => row.error);
    if (invalid) throw new Error(invalid.error!);

    // Read the whole relevant saved state before the first mutation. Fail closed on read errors.
    const skus = [...new Set(plan.rows.map((row) => row.sku))];
    const products = await store.getProducts(skus);
    const existingBySku = new Map(products.map((product) => [product.sku, product]));
    const currentCompat = await store.getCompatibilities(products.map((product) => product.id));
    for (let offset = 0; offset < plan.newCategories.length; offset += 200) {
      progress.categories += await store.createLookups(
        "categories",
        plan.newCategories.slice(offset, offset + 200),
      );
      report();
    }
    for (let offset = 0; offset < plan.newModels.length; offset += 200) {
      progress.models += await store.createLookups(
        "models",
        plan.newModels.slice(offset, offset + 200),
      );
      report();
    }
    if (plan.newCategories.length || plan.newModels.length) {
      const refreshed = await store.getLookups();
      plan = applyImportSafety(
        prepareImportRecords(records, refreshed.categories, refreshed.models),
      );
      if (
        plan.newCategories.length ||
        plan.newModels.length ||
        plan.rows.some((row) => row.error)
      ) {
        throw new Error(
          "Los maestros cambiaron durante la importación. Volvé a cargar el archivo para revisar los IDs.",
        );
      }
    }

    const productRows = [...new Map(plan.rows.map((row) => [row.sku, row])).values()];
    const productIds = new Map<string, string>();
    // Bounded concurrency keeps individual PATCHes preservative and reports partial success precisely.
    for (let offset = 0; offset < productRows.length; offset += 4) {
      const results = await Promise.allSettled(
        productRows.slice(offset, offset + 4).map(async (row) => {
          const existing = existingBySku.get(row.sku);
          const saved = await store.saveProduct(productWriteFromRow(row, existing), existing?.id);
          if (!saved.id || saved.sku !== row.sku)
            throw new Error(`No pudimos confirmar el guardado de ${row.sku}`);
          productIds.set(row.sku, saved.id);
          if (existing) progress.updatedProducts += 1;
          else progress.createdProducts += 1;
          report();
        }),
      );
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    }

    const additions = planCompatibilityAdditions(plan.rows, productIds, currentCompat);
    for (let offset = 0; offset < additions.length; offset += 200) {
      const batch = additions.slice(offset, offset + 200);
      progress.compatibilities += await store.addCompatibilities(batch);
      report();
    }
    return progress;
  } catch (error) {
    throw new CatalogImportError(messageOf(error), { ...progress });
  }
}
