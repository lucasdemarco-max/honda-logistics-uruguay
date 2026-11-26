import type { Database } from "@/integrations/supabase/types";

export type Availability = Database["public"]["Enums"]["availability"];
export interface CatalogLookup {
  id: string;
  name: string;
  slug: string;
}
export interface ImportRecord {
  rowNumber: number;
  record: Record<string, unknown>;
}
export interface LookupReference extends CatalogLookup {
  isNew: boolean;
  key: string;
}
export type OptionalImportField =
  "hondaCode" | "description" | "price" | "stock" | "availability" | "active";
export interface ImportRow {
  rowNumber: number;
  sku: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  category: LookupReference | null;
  hondaCode: string;
  description: string;
  price: number | null;
  stock: number | null;
  availability: Availability;
  active: boolean;
  modelId: string | null;
  modelName: string;
  model: LookupReference | null;
  yearFrom: number;
  yearTo: number;
  compatibilityNotes: string;
  provided: Record<OptionalImportField, boolean>;
  error: string | null;
}
export interface ImportPreview {
  rows: ImportRow[];
  newCategories: LookupReference[];
  newModels: LookupReference[];
}
export const normalizeImportValue = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const normalizedName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
export const importSlug = (value: string) =>
  normalizedName(value)
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
export const IMPORT_ALIASES = {
  sku: ["sku", "codigo sku", "codigo"],
  name: ["nombre", "nombre producto", "producto", "name", "product name"],
  categoryId: ["categoryid", "id categoria", "categoria id"],
  categoryName: ["categoria", "category", "category name", "nombre categoria"],
  subcategory: ["subcategoria", "subcategoria filtros", "tipo de filtro"],
  hondaCode: ["codigo honda", "honda code"],
  description: ["descripcion", "description"],
  price: ["precio", "precio uyu", "price", "precio en uyu"],
  stock: ["stock", "cantidad"],
  availability: ["disponibilidad", "availability", "estado"],
  active: ["activo", "active"],
  modelId: ["modelid", "id modelo", "modelo id"],
  modelName: ["modelo", "model", "model name", "nombre modelo"],
  yearFrom: ["año desde", "anio desde", "year from", "desde"],
  yearTo: ["año hasta", "anio hasta", "year to", "hasta"],
  notes: ["notas compatibilidad", "notas", "compatibilidad", "compatibility notes"],
} as const;
export type ImportColumn = keyof typeof IMPORT_ALIASES;
const columnByHeader = new Map<string, ImportColumn>();
for (const key of Object.keys(IMPORT_ALIASES) as ImportColumn[]) {
  for (const alias of IMPORT_ALIASES[key]) columnByHeader.set(normalizeImportValue(alias), key);
}
export const importColumn = (header: string): ImportColumn | undefined =>
  columnByHeader.get(normalizeImportValue(header));
const present = (value: unknown) => String(value ?? "").trim() !== "";
export const parseImportNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let normalized = raw.replace(/^(?:UYU|\$U|\$)\s*/i, "").replace(/\s*UYU$/i, "");
  if (/\s/.test(normalized)) {
    if (!/^[+-]?\d{1,3}(?:\s\d{3})+(?:[.,]\d+)?$/.test(normalized)) return null;
    normalized = normalized.replace(/\s/g, "");
  }
  if (!/^[+-]?[\d.,]+$/.test(normalized)) return null;
  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      if (!/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(normalized)) return null;
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      if (!/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(normalized)) return null;
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) normalized = normalized.replace(",", ".");
  else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(normalized)) normalized = normalized.replace(/\./g, "");
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
};
function resolveLookup(
  id: string,
  name: string,
  lookups: CatalogLookup[],
  label: string,
): { value: LookupReference | null; error?: string } {
  if (!id && !name) return { value: null };
  const exactId = id ? lookups.filter((item) => item.id.toLowerCase() === id.toLowerCase()) : [];
  const byId = exactId.length
    ? exactId
    : id
      ? lookups.filter((item) => item.slug.toLowerCase() === id.toLowerCase())
      : [];
  const byName = name
    ? lookups.filter(
        (item) =>
          normalizedName(item.name) === normalizedName(name) ||
          item.slug.toLowerCase() === name.toLowerCase(),
      )
    : [];
  if (byId.length > 1 || (!id && byName.length > 1))
    return { value: null, error: `${label} ambiguo; usá el ID exacto` };
  const match = byId[0] ?? (!id ? byName[0] : undefined);
  if (match) {
    if (
      name &&
      normalizedName(match.name) !== normalizedName(name) &&
      match.slug.toLowerCase() !== name.toLowerCase()
    )
      return { value: null, error: `${label}: el ID y el nombre no coinciden` };
    return { value: { ...match, isNew: false, key: match.id } };
  }
  if (id && byName.length)
    return { value: null, error: `${label}: el ID no coincide con el nombre existente` };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return { value: null, error: `${label}: UUID desconocido; verificá el identificador` };
  const slug = id ? id.toLowerCase() : importSlug(name);
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(slug))
    return {
      value: null,
      error: `${label}: el ID debe tener hasta 80 caracteres (letras sin tildes, números, puntos, guiones o guiones bajos)`,
    };
  if (id && !name && label === "Categoría")
    return { value: null, error: "Una categoría nueva requiere CategoryName" };
  const collision = lookups.find((item) => item.slug === slug);
  if (collision)
    return { value: null, error: `${label}: el identificador ya pertenece a ${collision.name}` };
  return { value: { id: `new:${slug}`, key: `new:${slug}`, name: name || id, slug, isNew: true } };
}
const availabilityFrom = (raw: unknown): Availability | null => {
  const key = normalizeImportValue(raw);
  if (["disponible", "enstock"].includes(key)) return "en_stock";
  if (["pocasunidades", "ultimasunidades"].includes(key)) return "pocas_unidades";
  if (["apedido", "pedido"].includes(key)) return "a_pedido";
  if (["sinstock", "agotado"].includes(key)) return "sin_stock";
  return ["", "0", "consultar"].includes(key) ? "consultar" : null;
};
const booleanFrom = (raw: unknown): boolean | null => {
  const key = normalizeImportValue(raw);
  if (["si", "yes", "true", "1", "activo"].includes(key)) return true;
  return ["no", "false", "0", "inactivo"].includes(key) ? false : null;
};
export const parseImportRow = (
  record: Record<string, unknown>,
  rowNumber: number,
  categories: CatalogLookup[],
  models: CatalogLookup[],
): ImportRow => {
  const values = new Map<ImportColumn, unknown>();
  for (const [header, value] of Object.entries(record)) {
    const field = importColumn(header);
    if (field && !values.has(field)) values.set(field, value);
  }
  const get = (column: ImportColumn): unknown => values.get(column) ?? "";
  const text = (column: ImportColumn) => String(get(column) ?? "").trim();
  const sku = text("sku"),
    name = text("name");
  const categoryIdentifier = text("categoryId");
  const subcategory = text("subcategory");
  const categoryLabel = !categoryIdentifier && subcategory ? subcategory : text("categoryName");
  const categoryResult = resolveLookup(categoryIdentifier, categoryLabel, categories, "Categoría");
  const modelIdentifier = text("modelId"),
    modelLabel = text("modelName");
  const modelResult = resolveLookup(modelIdentifier, modelLabel, models, "Modelo");
  const priceRaw = get("price"),
    stockRaw = get("stock");
  const price = parseImportNumber(priceRaw),
    stock = parseImportNumber(stockRaw);
  const availabilityRaw = get("availability"),
    activeRaw = get("active");
  const availability = availabilityFrom(availabilityRaw),
    active = booleanFrom(activeRaw);
  const yearFromRaw = get("yearFrom"),
    yearToRaw = get("yearTo");
  const yearFrom = parseImportNumber(yearFromRaw),
    yearTo = parseImportNumber(yearToRaw);
  const errors: string[] = [];
  const columns = Object.keys(record).map(importColumn).filter(Boolean);
  if (new Set(columns).size !== columns.length)
    errors.push("Encabezados duplicados o equivalentes");
  if (!sku) errors.push("SKU requerido");
  if (!name) errors.push("Nombre requerido");
  if (!categoryIdentifier && !categoryLabel) errors.push("CategoryID o CategoryName requerido");
  if (categoryResult.error) errors.push(categoryResult.error);
  if (modelResult.error) errors.push(modelResult.error);
  if (present(priceRaw) && price === null) errors.push("Precio inválido");
  if (
    price !== null &&
    (price < 0 || price > 9999999999.99 || Math.abs(price * 100 - Math.round(price * 100)) > 0.0001)
  )
    errors.push("Precio debe ser no negativo, con hasta 2 decimales y máximo 9.999.999.999,99");
  if (present(stockRaw) && stock === null) errors.push("Stock inválido");
  if (stock !== null && (!Number.isSafeInteger(stock) || stock < 0 || stock > 2147483647))
    errors.push("Stock debe ser entero y no negativo dentro del rango permitido");
  if (present(availabilityRaw) && !availability) errors.push("Disponibilidad desconocida");
  if (present(activeRaw) && active === null) errors.push("Activo debe ser sí/no");
  const hasModel = Boolean(modelIdentifier || modelLabel);
  if (hasModel && (yearFrom === null || yearTo === null))
    errors.push("Modelo requiere año desde y año hasta");
  if (!hasModel && (present(yearFromRaw) || present(yearToRaw) || present(get("notes"))))
    errors.push("Ingresá un modelo para usar años o notas de compatibilidad");
  if (hasModel && yearFrom !== null && yearTo !== null) {
    if (!Number.isInteger(yearFrom) || !Number.isInteger(yearTo))
      errors.push("Los años deben ser enteros");
    if (yearFrom < 1970 || yearTo > 2100) errors.push("Los años deben estar entre 1970 y 2100");
    if (yearFrom > yearTo) errors.push("Año desde no puede superar año hasta");
  }
  for (const column of ["sku", "hondaCode", "categoryId", "modelId"] as const) {
    const raw = get(column);
    if (typeof raw === "number" && (!Number.isSafeInteger(raw) || Math.abs(raw) >= 1e15))
      errors.push(`${column}: guardá el identificador como texto para evitar pérdida de precisión`);
  }
  const provided = Object.fromEntries(
    (
      [
        "hondaCode",
        "description",
        "price",
        "stock",
        "availability",
        "active",
      ] as OptionalImportField[]
    ).map((field) => [field, present(get(field))]),
  ) as Record<OptionalImportField, boolean>;
  return {
    rowNumber,
    sku,
    name,
    category: categoryResult.value,
    categoryId: categoryResult.value?.id ?? null,
    categoryName: categoryResult.value?.name ?? categoryLabel,
    hondaCode: text("hondaCode"),
    description: text("description"),
    price,
    stock,
    availability: availability ?? "consultar",
    active: active ?? true,
    model: modelResult.value,
    modelId: modelResult.value?.id ?? null,
    modelName: modelResult.value?.name ?? modelLabel,
    yearFrom: yearFrom ?? 0,
    yearTo: yearTo ?? 0,
    compatibilityNotes: text("notes"),
    provided,
    error: errors.length ? `Fila ${rowNumber}: ${errors.join("; ")}` : null,
  };
};
const withRowError = (row: ImportRow, message: string): ImportRow => ({
  ...row,
  error: row.error ? `${row.error}; ${message}` : `Fila ${row.rowNumber}: ${message}`,
});
export const validateDuplicateSkus = (rows: ImportRow[]): ImportRow[] => {
  const groups = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const group = groups.get(row.sku) ?? [];
    group.push(row);
    groups.set(row.sku, group);
  }
  const validated = new Map<ImportRow, ImportRow>();
  const fields: OptionalImportField[] = [
    "hondaCode",
    "description",
    "stock",
    "availability",
    "active",
  ];
  const applicationKey = (row: ImportRow) =>
    JSON.stringify([row.model?.key, row.yearFrom, row.yearTo]);
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const conflict =
      new Set(group.map((item) => JSON.stringify([item.name, item.category?.key]))).size > 1 ||
      fields.some(
        (field) =>
          new Set(group.filter((item) => item.provided[field]).map((item) => item[field])).size > 1,
      );
    const sources = fields.map((field) => ({
      field,
      row: group.find((item) => item.provided[field]),
    }));
    const prices = group
      .filter((item) => item.provided.price && item.price !== null)
      .map((item) => item.price!);
    const highestPrice = prices.length ? Math.max(...prices) : null;
    const notesByApplication = new Map<string, Set<string>>();
    for (const row of group) {
      if (!row.compatibilityNotes) continue;
      const key = applicationKey(row);
      const notes = notesByApplication.get(key) ?? new Set<string>();
      notes.add(row.compatibilityNotes);
      notesByApplication.set(key, notes);
    }
    for (const row of group) {
      if (conflict) {
        validated.set(
          row,
          withRowError(
            row,
            "Las filas con el mismo SKU deben repetir los mismos datos del producto",
          ),
        );
        continue;
      }
      if ((notesByApplication.get(applicationKey(row))?.size ?? 0) > 1) {
        validated.set(
          row,
          withRowError(row, "La misma compatibilidad tiene notas contradictorias"),
        );
        continue;
      }
      const merged = { ...row, provided: { ...row.provided } };
      for (const source of sources)
        if (source.row) {
          Object.assign(merged, { [source.field]: source.row[source.field] });
          merged.provided[source.field] = true;
        }
      if (highestPrice !== null) {
        merged.price = highestPrice;
        merged.provided.price = true;
      }
      validated.set(row, merged);
    }
  }
  return rows.map((row) => validated.get(row) ?? row);
};
export function prepareImport(
  records: ImportRecord[],
  categories: CatalogLookup[],
  models: CatalogLookup[],
): ImportPreview {
  let rows = records.map(({ record, rowNumber }) =>
    parseImportRow(record, rowNumber, categories, models),
  );
  for (const type of ["category", "model"] as const) {
    const namesBySlug = new Map<string, Set<string>>();
    const slugsByName = new Map<string, Set<string>>();
    for (const row of rows) {
      const ref = row[type];
      if (!ref?.isNew) continue;
      const normalized = normalizedName(ref.name);
      const names = namesBySlug.get(ref.slug) ?? new Set<string>();
      names.add(normalized);
      namesBySlug.set(ref.slug, names);
      const slugs = slugsByName.get(normalized) ?? new Set<string>();
      slugs.add(ref.slug);
      slugsByName.set(normalized, slugs);
    }
    rows = rows.map((row) => {
      const reference = row[type];
      if (!reference?.isNew) return row;
      const conflicts =
        (namesBySlug.get(reference.slug)?.size ?? 0) > 1 ||
        (slugsByName.get(normalizedName(reference.name))?.size ?? 0) > 1;
      return conflicts
        ? withRowError(
            row,
            `${type === "category" ? "Categoría" : "Modelo"}: identificadores y nombres contradictorios en el archivo`,
          )
        : row;
    });
  }
  rows = validateDuplicateSkus(rows);
  const unique = (type: "category" | "model") => [
    ...new Map(
      rows
        .filter((row) => !row.error && row[type]?.isNew)
        .map((row) => [row[type]!.key, row[type]!]),
    ).values(),
  ];
  return { rows, newCategories: unique("category"), newModels: unique("model") };
}
export function buildProductPatch(
  row: ImportRow,
): Database["public"]["Tables"]["products"]["Insert"] {
  if (row.error || !row.categoryId || row.categoryId.startsWith("new:"))
    throw new Error(`Fila ${row.rowNumber}: resolvé la categoría antes de guardar`);
  return {
    sku: row.sku,
    name: row.name,
    category_id: row.categoryId,
    ...(row.provided.hondaCode ? { honda_code: row.hondaCode } : {}),
    ...(row.provided.description ? { description: row.description } : {}),
    ...(row.provided.price ? { price_uyu: row.price } : {}),
    ...(row.provided.stock ? { stock: row.stock } : {}),
    ...(row.provided.availability ? { availability: row.availability } : {}),
    ...(row.provided.active ? { active: row.active } : {}),
  };
}
