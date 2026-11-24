export type Availability = "en_stock" | "pocas_unidades" | "a_pedido" | "sin_stock" | "consultar";

export interface CatalogLookup {
  id: string;
  name: string;
  slug: string;
}

export interface ImportRecord {
  rowNumber: number;
  record: Record<string, unknown>;
  sheetName?: string;
}

export interface ImportRow {
  rowNumber: number;
  sheetName?: string;
  sku: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  hondaCode: string;
  description: string;
  price: number | null;
  stock: number | null;
  availability: Availability;
  active: boolean;
  modelId: string | null;
  modelName: string;
  yearFrom: number;
  yearTo: number;
  compatibilityNotes: string;
  // Empty or missing optional cells mean "preserve the saved value" on updates.
  // Explicit 0 / false are provided values, not empty cells.
  provided: Record<
    | "hondaCode"
    | "description"
    | "price"
    | "stock"
    | "availability"
    | "active"
    | "compatibilityNotes",
    boolean
  >;
  warnings: string[];
  error: string | null;
}

export interface ImportPlan {
  rows: ImportRow[];
  categories: CatalogLookup[];
  models: CatalogLookup[];
  newCategories: CatalogLookup[];
  newModels: CatalogLookup[];
  warnings: string[];
}

export const normalizeImportValue = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const IMPORT_ALIASES = {
  sku: ["SKU", "Código SKU", "Código"],
  name: ["NAME", "Nombre", "Nombre producto", "Producto", "ProductName"],
  categoryId: ["CategoryID", "ID Categoría", "Categoría ID"],
  categoryName: ["CategoryName", "Categoría", "Category", "Nombre Categoría"],
  subcategoryName: ["Subcategoría", "Subcategoría Filtros", "Tipo de filtro"],
  hondaCode: ["HondaCode", "Código Honda"],
  description: ["Description", "Descripción"],
  price: ["Price", "Precio", "Precio UYU", "Precio en UYU"],
  stock: ["Stock", "Cantidad"],
  availability: ["Availability", "Disponibilidad", "Estado"],
  active: ["Active", "Activo"],
  modelId: ["ModelID", "ID Modelo", "Modelo ID"],
  modelName: ["ModelName", "Modelo", "Model", "Nombre Modelo"],
  yearFrom: ["YearFrom", "Año Desde", "Anio Desde", "Desde"],
  yearTo: ["YearTo", "Año Hasta", "Anio Hasta", "Hasta"],
  compatibilityNotes: ["CompatibilityNotes", "Notas Compatibilidad", "Notas", "Compatibilidad"],
} as const;

export type ImportField = keyof typeof IMPORT_ALIASES;

const fieldByHeader = new Map<string, ImportField>();
for (const [field, aliases] of Object.entries(IMPORT_ALIASES)) {
  for (const alias of aliases) fieldByHeader.set(normalizeImportValue(alias), field as ImportField);
}

export const importFieldForHeader = (header: unknown): ImportField | undefined =>
  fieldByHeader.get(normalizeImportValue(header));

const valueFor = (record: Record<string, unknown>, field: ImportField): unknown =>
  Object.entries(record).find(([key]) => importFieldForHeader(key) === field)?.[1] ?? "";
const asText = (value: unknown) => String(value ?? "").trim();
const textFor = (record: Record<string, unknown>, field: ImportField) =>
  asText(valueFor(record, field));
const hasValue = (value: unknown) => asText(value) !== "";
const normalizeName = normalizeImportValue;
const normalizeId = (value: string) => value.trim().toLowerCase();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const importSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Strict UYU / international numbers. Never strip arbitrary letters into a valid price. */
export const parseImportNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let raw = value.trim();
  if (!raw) return null;
  raw = raw
    .replace(/^(?:UYU|\$U|\$)\s*/i, "")
    .replace(/\s*UYU$/i, "")
    .trim();
  if (!/^[+-]?\d[\d.,\s]*$/.test(raw)) return null;
  // Spaces are accepted only as groups of three digits, e.g. "1 250,50".
  if (/\s/.test(raw)) {
    if (!/^[+-]?\d{1,3}(?:\s\d{3})+(?:[.,]\d+)?$/.test(raw)) return null;
    raw = raw.replace(/\s/g, "");
  }
  let normalized = raw;
  if (raw.includes(",") && raw.includes(".")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      if (!/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(raw)) return null;
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else {
      if (!/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(raw)) return null;
      normalized = raw.replace(/,/g, "");
    }
  } else if (raw.includes(",")) {
    if (/^[+-]?\d+,\d+$/.test(raw)) normalized = raw.replace(",", ".");
    else if (/^[+-]?\d{1,3}(?:,\d{3}){2,}$/.test(raw)) normalized = raw.replace(/,/g, "");
    else return null;
  } else if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const parseAvailability = (value: unknown): Availability | null => {
  const normalized = normalizeImportValue(value);
  if (["disponible", "enstock"].includes(normalized)) return "en_stock";
  if (["pocasunidades", "ultimasunidades"].includes(normalized)) return "pocas_unidades";
  if (["apedido", "pedido"].includes(normalized)) return "a_pedido";
  if (["sinstock", "agotado"].includes(normalized)) return "sin_stock";
  if (["", "0", "consultar"].includes(normalized)) return "consultar";
  return null;
};

interface LookupInput {
  code: string;
  name: string;
}

function lookupInput(record: Record<string, unknown>, kind: "category" | "model"): LookupInput {
  if (kind === "model")
    return { code: textFor(record, "modelId"), name: textFor(record, "modelName") };
  const code = textFor(record, "categoryId");
  // Older templates supplied an explicit subcategory. Preserve that explicit classification;
  // never derive the category from a product's name or collapse it to the parent Filtros.
  const subcategory = textFor(record, "subcategoryName");
  return { code, name: !code && subcategory ? subcategory : textFor(record, "categoryName") };
}

interface LookupResolution {
  item: CatalogLookup | null;
  error: string | null;
}

function resolveLookup(
  input: LookupInput,
  lookups: CatalogLookup[],
  kind: "category" | "model",
): LookupResolution {
  const label = kind === "category" ? "Categoría" : "Modelo";
  const idLabel = kind === "category" ? "CategoryID" : "ModelID";
  if (!input.code && !input.name) return { item: null, error: null };
  let matches: CatalogLookup[];
  if (input.code) {
    // IDs take precedence over slugs and names. Punctuation is significant in IDs/codes.
    matches = lookups.filter((item) => normalizeId(item.id) === normalizeId(input.code));
    if (!matches.length)
      matches = lookups.filter((item) => normalizeId(item.slug) === normalizeId(input.code));
  } else {
    matches = lookups.filter((item) => normalizeName(item.name) === normalizeName(input.name));
    if (!matches.length)
      matches = lookups.filter((item) => normalizeId(item.slug) === normalizeId(input.name));
  }
  if (matches.length > 1)
    return { item: null, error: `${label} ambigua; usá su ${idLabel} exacto` };
  const item = matches[0] ?? null;
  if (!item)
    return {
      item: null,
      error: `${label} desconocid${kind === "category" ? "a" : "o"}: ${input.code || input.name}`,
    };
  if (input.code && input.name && normalizeName(item.name) !== normalizeName(input.name)) {
    return {
      item: null,
      error: `${idLabel} y ${kind === "category" ? "CategoryName" : "ModelName"} corresponden a datos distintos`,
    };
  }
  return { item, error: null };
}

const rowLabel = (rowNumber: number, sheetName?: string) =>
  `${sheetName ? `${sheetName} · ` : ""}Fila ${rowNumber}`;

export const parseImportRow = (
  record: Record<string, unknown>,
  rowNumber: number,
  categories: CatalogLookup[],
  models: CatalogLookup[],
  sheetName?: string,
): ImportRow => {
  const errors: string[] = [];
  const knownHeaders = new Set<ImportField>();
  for (const header of Object.keys(record)) {
    const field = importFieldForHeader(header);
    if (field && knownHeaders.has(field)) errors.push(`Columnas duplicadas para ${field}`);
    if (field) knownHeaders.add(field);
  }
  const sku = textFor(record, "sku");
  const name = textFor(record, "name");
  const categoryInput = lookupInput(record, "category");
  const modelInput = lookupInput(record, "model");
  const category = resolveLookup(categoryInput, categories, "category");
  const model = resolveLookup(modelInput, models, "model");
  const priceRaw = valueFor(record, "price");
  const stockRaw = valueFor(record, "stock");
  const price = parseImportNumber(priceRaw);
  const stock = parseImportNumber(stockRaw);
  const availabilityRaw = valueFor(record, "availability");
  const availability = parseAvailability(availabilityRaw);
  const activeRaw = valueFor(record, "active");
  const activeOptions: Record<string, boolean> = {
    si: true,
    yes: true,
    true: true,
    "1": true,
    activo: true,
    no: false,
    false: false,
    "0": false,
    inactivo: false,
  };
  const active = hasValue(activeRaw) ? activeOptions[normalizeImportValue(activeRaw)] : true;
  const yearFromRaw = valueFor(record, "yearFrom");
  const yearToRaw = valueFor(record, "yearTo");
  const yearFrom = parseImportNumber(yearFromRaw);
  const yearTo = parseImportNumber(yearToRaw);
  const hasModel = Boolean(modelInput.code || modelInput.name);
  if (!sku) errors.push("SKU requerido");
  if (!name) errors.push("Nombre requerido");
  if (!categoryInput.code && !categoryInput.name) errors.push("Categoría requerida");
  if (category.error) errors.push(category.error);
  if (model.error) errors.push(model.error);
  if (hasValue(priceRaw) && price === null) errors.push("Precio inválido");
  if (price !== null && price < 0) errors.push("Precio no puede ser negativo");
  if (
    price !== null &&
    (price > 9999999999.99 || Math.abs(price * 100 - Math.round(price * 100)) > 0.0001)
  ) {
    errors.push("Precio debe tener hasta 2 decimales y no superar 9.999.999.999,99");
  }
  if (hasValue(stockRaw) && stock === null) errors.push("Stock inválido");
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 2147483647)) {
    errors.push("Stock debe ser entero y no negativo, hasta 2.147.483.647");
  }
  if (active === undefined) errors.push("Activo debe ser sí/no");
  if (hasValue(availabilityRaw) && availability === null) errors.push("Disponibilidad desconocida");
  if (hasModel && (yearFrom === null || yearTo === null))
    errors.push("Modelo requiere año desde y año hasta");
  if (!hasModel && (hasValue(yearFromRaw) || hasValue(yearToRaw)))
    errors.push("Ingresá un modelo para usar años de compatibilidad");
  if (!hasModel && hasValue(valueFor(record, "compatibilityNotes")))
    errors.push("Ingresá un modelo para usar notas de compatibilidad");
  if (hasModel && yearFrom !== null && yearTo !== null) {
    if (!Number.isInteger(yearFrom) || !Number.isInteger(yearTo))
      errors.push("Los años deben ser enteros");
    if (yearFrom < 1970 || yearTo > 2100) errors.push("Los años deben estar entre 1970 y 2100");
    if (yearFrom > yearTo) errors.push("Año desde no puede superar año hasta");
  }
  return {
    rowNumber,
    ...(sheetName !== undefined ? { sheetName } : {}),
    sku,
    name,
    categoryId: category.item?.id ?? null,
    categoryName: category.item?.name ?? (categoryInput.name || categoryInput.code),
    hondaCode: textFor(record, "hondaCode"),
    description: textFor(record, "description"),
    price,
    stock,
    availability: availability ?? "consultar",
    active: active ?? true,
    modelId: model.item?.id ?? null,
    modelName: model.item?.name ?? (modelInput.name || modelInput.code),
    // These sentinels are never persisted without a valid model/year pair.
    yearFrom: yearFrom ?? 0,
    yearTo: yearTo ?? 0,
    compatibilityNotes: textFor(record, "compatibilityNotes"),
    provided: {
      hondaCode: hasValue(valueFor(record, "hondaCode")),
      description: hasValue(valueFor(record, "description")),
      price: hasValue(priceRaw),
      stock: hasValue(stockRaw),
      availability: hasValue(availabilityRaw),
      active: hasValue(activeRaw),
      compatibilityNotes: hasValue(valueFor(record, "compatibilityNotes")),
    },
    warnings: [],
    error: errors.length ? `${rowLabel(rowNumber, sheetName)}: ${errors.join("; ")}` : null,
  };
};

const withRowError = (row: ImportRow, message: string): ImportRow => ({
  ...row,
  error: row.error
    ? `${row.error}; ${message}`
    : `${rowLabel(row.rowNumber, row.sheetName)}: ${message}`,
});

export const validateDuplicateSkus = (rows: ImportRow[]): ImportRow[] => {
  const bySku = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const group = bySku.get(row.sku) ?? [];
    group.push(row);
    bySku.set(row.sku, group);
  }
  const optionalFields = ["hondaCode", "description", "stock", "availability", "active"] as const;
  type OptionalField = (typeof optionalFields)[number];
  interface DuplicateSummary {
    error: string | null;
    price: number | null;
    priceProvided: boolean;
    priceWarning: string | null;
    sources: Partial<Record<OptionalField, ImportRow>>;
  }
  const summaries = new Map<string, DuplicateSummary>();
  // Analyze each SKU once. Repeated applications may span the entire 20k-row workbook.
  for (const [sku, group] of bySku) {
    if (group.length < 2 || !sku) continue;
    const details = new Set(group.map((item) => JSON.stringify([item.name, item.categoryId])));
    const sources: DuplicateSummary["sources"] = {};
    let inconsistent = details.size > 1;
    for (const field of optionalFields) {
      const provided = group.filter((item) => item.provided[field]);
      if (new Set(provided.map((item) => item[field])).size > 1) inconsistent = true;
      if (provided[0]) sources[field] = provided[0];
    }
    let error: string | null = inconsistent
      ? "Las filas con el mismo SKU deben repetir los mismos datos del producto"
      : null;
    if (!error && group.some((item) => item.modelId) && group.some((item) => !item.modelId)) {
      error = "No mezcles filas con y sin modelo para el mismo SKU";
    }
    const appNotes = new Map<string, Set<string>>();
    for (const item of group) {
      if (!item.modelId || !item.provided.compatibilityNotes) continue;
      const key = JSON.stringify([item.modelId, item.yearFrom, item.yearTo]);
      const notes = appNotes.get(key) ?? new Set<string>();
      notes.add(item.compatibilityNotes);
      appNotes.set(key, notes);
    }
    if (!error && [...appNotes.values()].some((notes) => notes.size > 1)) {
      error = "La misma compatibilidad tiene notas contradictorias";
    }
    const prices = group.flatMap((item) => (item.price === null ? [] : [item.price]));
    const price = prices.length ? Math.max(...prices) : null;
    summaries.set(sku, {
      error,
      price,
      priceProvided: prices.length > 0,
      priceWarning:
        new Set(prices).size > 1
          ? `SKU ${sku}: se usará el precio mayor (${price} UYU), sin sumar stock.`
          : null,
      sources,
    });
  }
  return rows.map((row) => {
    const summary = summaries.get(row.sku);
    if (!summary) return row;
    if (summary.error) return withRowError(row, summary.error);
    const merged = {
      ...row,
      provided: { ...row.provided, price: summary.priceProvided },
      price: summary.price,
      warnings: summary.priceWarning ? [...row.warnings, summary.priceWarning] : row.warnings,
    };
    for (const field of optionalFields) {
      const source = summary.sources[field];
      if (source) {
        Object.assign(merged, { [field]: source[field] });
        merged.provided[field] = true;
      }
    }
    return merged;
  });
};

/** Pure preview: temporary IDs are replaced only after the caller confirms and saves masters. */
export function prepareImportRecords(
  records: ImportRecord[],
  categories: CatalogLookup[],
  models: CatalogLookup[],
): ImportPlan {
  const availableCategories = [...categories];
  const availableModels = [...models];
  const newCategories: CatalogLookup[] = [];
  const newModels: CatalogLookup[] = [];
  const preparationErrors = new Map<ImportRecord, string[]>();
  for (const kind of ["category", "model"] as const) {
    // A later explicit name must win over a provisional code-only model label.
    // Collect named declarations first so workbook order never changes resolution.
    const ordered = [...records].sort(
      (a, b) =>
        Number(Boolean(lookupInput(b.record, kind).name)) -
        Number(Boolean(lookupInput(a.record, kind).name)),
    );
    for (const source of ordered) {
      const input = lookupInput(source.record, kind);
      if (!input.code && !input.name) continue;
      const available = kind === "category" ? availableCategories : availableModels;
      const resolved = resolveLookup(input, available, kind);
      if (resolved.item) continue;
      const exactIdOrSlug =
        input.code &&
        available.some(
          (item) =>
            normalizeId(item.id) === normalizeId(input.code) ||
            normalizeId(item.slug) === normalizeId(input.code),
        );
      // Conflicts and unknown UUIDs must be corrected, never turned into replacement records.
      if (exactIdOrSlug || (input.code && uuidPattern.test(input.code))) continue;
      const existingName =
        input.name &&
        available.some((item) => normalizeName(item.name) === normalizeName(input.name));
      if (existingName) {
        const errors = preparationErrors.get(source) ?? [];
        errors.push(
          `${kind === "category" ? "CategoryID" : "ModelID"} no coincide con el ID o código del nombre existente`,
        );
        preparationErrors.set(source, errors);
        continue;
      }
      if (kind === "category" && input.code && !input.name) continue;
      const slug = input.code ? normalizeId(input.code) : importSlug(input.name);
      if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(slug)) {
        const errors = preparationErrors.get(source) ?? [];
        errors.push(
          "El código debe tener hasta 80 caracteres: letras, números, guion, punto o guion bajo",
        );
        preparationErrors.set(source, errors);
        continue;
      }
      const item: CatalogLookup = {
        id: `pending-${kind}:${slug}`,
        slug,
        name: input.name || input.code,
      };
      available.push(item);
      (kind === "category" ? newCategories : newModels).push(item);
    }
  }
  const rows = validateDuplicateSkus(
    records.map((source) => {
      let row = parseImportRow(
        source.record,
        source.rowNumber,
        availableCategories,
        availableModels,
        source.sheetName,
      );
      const categoryInput = lookupInput(source.record, "category");
      if (
        categoryInput.code &&
        !categoryInput.name &&
        !row.categoryId &&
        !uuidPattern.test(categoryInput.code)
      ) {
        row = withRowError(row, "Una categoría nueva requiere CategoryName");
      }
      for (const error of preparationErrors.get(source) ?? []) row = withRowError(row, error);
      return row;
    }),
  );
  return {
    rows,
    categories: availableCategories,
    models: availableModels,
    newCategories,
    newModels,
    warnings: [...new Set(rows.flatMap((row) => row.warnings))],
  };
}
