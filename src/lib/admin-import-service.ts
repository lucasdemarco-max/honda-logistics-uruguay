import filtrosData from "@/data/filtros.json";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildProductPatch,
  prepareImport,
  type CatalogLookup,
  type ImportRecord,
  type ImportRow,
  type LookupReference,
} from "@/lib/admin-import";

type Client = SupabaseClient<Database>;
const legacyBySku = new Map(filtrosData.map((product) => [product.sku, product]));

export function legacyProductDefaults(
  sku: string,
): Partial<Database["public"]["Tables"]["products"]["Insert"]> {
  const product = legacyBySku.get(sku);
  if (!product) return {};
  return {
    honda_code: product.honda_code,
    description: product.description,
    price_uyu: product.price_uyu,
    stock: product.stock,
    availability: product.availability as Database["public"]["Enums"]["availability"],
    active: product.active,
    image_url: product.image_url,
    promo_text: product.promo_text,
    honda_relation: product.honda_relation as Database["public"]["Enums"]["honda_relation"],
    homologation_reference: product.homologation_reference,
  };
}

type Compatibility = Database["public"]["Tables"]["product_compatibilities"]["Row"];
export interface ImportProgress {
  products: number;
  categories: number;
  models: number;
  compatibilities: number;
  notes: number;
}
export class ImportExecutionError extends Error {
  constructor(
    message: string,
    public readonly progress: ImportProgress,
  ) {
    super(message);
    this.name = "ImportExecutionError";
  }
}
const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
const messageOf = (error: unknown) =>
  error && typeof error === "object" && "message" in error ? String(error.message) : String(error);

export async function loadImportLookups(
  client: Client,
): Promise<{ categories: CatalogLookup[]; models: CatalogLookup[] }> {
  const read = async (table: "categories" | "vehicle_models") => {
    const rows: CatalogLookup[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client
        .from(table)
        .select("id, name, slug")
        .order("id")
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  };
  const [categories, models] = await Promise.all([read("categories"), read("vehicle_models")]);
  return { categories, models };
}

export function compatibilityKey(value: {
  product_id: string;
  model_id: string;
  year_from: number;
  year_to: number;
}): string {
  return JSON.stringify([value.product_id, value.model_id, value.year_from, value.year_to]);
}

export async function executeImport(
  client: Client,
  records: ImportRecord[],
): Promise<ImportProgress> {
  const progress: ImportProgress = {
    products: 0,
    categories: 0,
    models: 0,
    compatibilities: 0,
    notes: 0,
  };
  try {
    const { data: userData, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    if (!userData.user) throw new Error("Iniciá sesión para importar productos");
    const { data: allowed, error: permissionError } = await client.rpc("has_permission", {
      _user_id: userData.user.id,
      _perm: "catalogo",
    });
    if (permissionError) throw permissionError;
    if (!allowed) throw new Error("Tu cuenta no tiene permisos para administrar el catálogo");
    const lookups = await loadImportLookups(client);
    const preview = prepareImport(records, lookups.categories, lookups.models);
    if (!preview.rows.length || preview.rows.some((row) => row.error))
      throw new Error(
        preview.rows.find((row) => row.error)?.error ?? "No hay productos válidos para importar",
      );
    const uniqueRows = [...new Map(preview.rows.map((row) => [row.sku, row])).values()];
    const products = new Map<string, string>();
    for (const batch of chunks(
      uniqueRows.map((row) => row.sku),
      200,
    )) {
      const { data, error } = await client.from("products").select("id, sku").in("sku", batch);
      if (error) throw error;
      data.forEach((product) => products.set(product.sku, product.id));
    }
    const compatibilities: Compatibility[] = [];
    for (const batch of chunks([...products.values()], 100)) {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client
          .from("product_compatibilities")
          .select("*")
          .in("product_id", batch)
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        compatibilities.push(...data);
        if (data.length < 1000) break;
      }
    }
    const existingCompat = new Map<string, Compatibility[]>();
    for (const compatibility of compatibilities)
      existingCompat.set(compatibilityKey(compatibility), [
        ...(existingCompat.get(compatibilityKey(compatibility)) ?? []),
        compatibility,
      ]);
    // Detect conflicts before the first mutation. Existing notes are never overwritten.
    for (const row of preview.rows) {
      const productId = products.get(row.sku);
      if (!productId || !row.modelId || row.model?.isNew || !row.compatibilityNotes) continue;
      const matches =
        existingCompat.get(
          compatibilityKey({
            product_id: productId,
            model_id: row.modelId,
            year_from: row.yearFrom,
            year_to: row.yearTo,
          }),
        ) ?? [];
      if (matches.some((match) => match.notes && match.notes !== row.compatibilityNotes))
        throw new Error(
          `Fila ${row.rowNumber}: las notas difieren de una compatibilidad existente; revisalas antes de importar`,
        );
    }
    const resolvedCategories = new Map<string, CatalogLookup>(
      lookups.categories.map((item) => [item.id, item]),
    );
    const resolvedModels = new Map<string, CatalogLookup>(
      lookups.models.map((item) => [item.id, item]),
    );
    const createLookups = async (
      table: "categories" | "vehicle_models",
      references: LookupReference[],
      target: Map<string, CatalogLookup>,
    ) => {
      for (const reference of references) {
        const { data, error } = await client
          .from(table)
          .insert({ name: reference.name, slug: reference.slug })
          .select("id, name, slug")
          .single();
        if (error) throw error;
        target.set(reference.key, data);
        if (table === "categories") progress.categories += 1;
        else progress.models += 1;
      }
    };
    await createLookups("categories", preview.newCategories, resolvedCategories);
    await createLookups("vehicle_models", preview.newModels, resolvedModels);
    const resolvedRows: ImportRow[] = preview.rows.map((row) => ({
      ...row,
      categoryId: row.category ? (resolvedCategories.get(row.category.key)?.id ?? null) : null,
      modelId: row.model ? (resolvedModels.get(row.model.key)?.id ?? null) : null,
    }));
    const resolvedUniqueRows = [...new Map(resolvedRows.map((row) => [row.sku, row])).values()];
    // Product patches are independent. Await every result in a small batch before
    // reporting an error so partial-progress counts include every completed write.
    for (const batch of chunks(resolvedUniqueRows, 10)) {
      const results = await Promise.allSettled(
        batch.map(async (row) => {
          const patch = buildProductPatch(row);
          const existingId = products.get(row.sku);
          // Separate update from insert so omitted cells can never become DB defaults on an existing SKU.
          const request = existingId
            ? client.from("products").update(patch).eq("id", existingId)
            : client
                .from("products")
                .insert({ ...legacyProductDefaults(row.sku), ...patch, is_demo: false });
          const { data, error } = await request.select("id, sku").single();
          if (error) throw error;
          if (!data) throw new Error(`No pudimos confirmar el producto ${row.sku}`);
          return data;
        }),
      );
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        products.set(result.value.sku, result.value.id);
        progress.products += 1;
      }
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    }
    const pending = new Map<
      string,
      Database["public"]["Tables"]["product_compatibilities"]["Insert"]
    >();
    for (const row of resolvedRows) {
      if (!row.modelId) continue;
      const productId = products.get(row.sku)!;
      const value = {
        product_id: productId,
        model_id: row.modelId,
        year_from: row.yearFrom,
        year_to: row.yearTo,
        notes: row.compatibilityNotes || null,
      };
      const key = compatibilityKey(value);
      const matches = existingCompat.get(key) ?? [];
      if (!matches.length) {
        const previous = pending.get(key);
        pending.set(key, previous?.notes && !value.notes ? previous : value);
      } else if (value.notes) {
        for (const match of matches.filter((item) => !item.notes)) {
          const update = client
            .from("product_compatibilities")
            .update({ notes: value.notes })
            .eq("id", match.id);
          const request =
            match.notes === null ? update.is("notes", null) : update.eq("notes", match.notes);
          const { data, error } = await request.select("id");
          if (error) throw error;
          if (data.length !== 1)
            throw new Error(
              "Una compatibilidad cambió durante la importación; recargá y revisá sus notas",
            );
          match.notes = value.notes;
          progress.notes += 1;
        }
      }
    }
    for (const batch of chunks([...pending.values()], 200)) {
      const { error } = await client.from("product_compatibilities").insert(batch);
      if (error) throw error;
      progress.compatibilities += batch.length;
    }
    return progress;
  } catch (error) {
    throw new ImportExecutionError(messageOf(error), { ...progress });
  }
}
