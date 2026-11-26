import { FILTER_SUBCATEGORIES } from "@/lib/filter-categories";

export type Availability = "en_stock" | "pocas_unidades" | "a_pedido" | "sin_stock" | "consultar";

export interface ImportRow {
  rowNumber: number;
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
  yearFrom: number;
  yearTo: number;
  compatibilityNotes: string;
  error: string | null;
}

export interface CatalogLookup {
  id: string;
  name: string;
  slug: string;
}

export const normalizeImportValue = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalize = normalizeImportValue;

const getValue = (record: Record<string, unknown>, names: string[]) => {
  const aliases = new Set(names.map(normalize));
  const entry = Object.entries(record).find(([key]) => aliases.has(normalize(key)));
  return entry?.[1] ?? "";
};

const textValue = (record: Record<string, unknown>, names: string[]) => {
  const value = getValue(record, names);
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let normalized = raw.replace(/\s/g, "").replace(/[^\d.,+-]/g, "");
  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");
  if (commaIndex >= 0 && dotIndex >= 0) {
    normalized =
      commaIndex > dotIndex
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
  } else if (commaIndex >= 0) {
    normalized = normalized.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  if (!normalized || !/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseAvailability = (value: unknown): Availability | null => {
  const normalized = normalize(value);
  if (["disponible", "enstock"].includes(normalized)) return "en_stock";
  if (["pocasunidades", "ultimasunidades"].includes(normalized)) return "pocas_unidades";
  if (["apedido", "pedido"].includes(normalized)) return "a_pedido";
  if (["sinstock", "agotado"].includes(normalized)) return "sin_stock";
  if (["", "0", "consultar"].includes(normalized)) return "consultar";
  return null;
};

export const parseImportRow = (
  record: Record<string, unknown>,
  rowNumber: number,
  categories: CatalogLookup[],
  models: CatalogLookup[],
): ImportRow => {
  const sku = textValue(record, ["sku", "codigo sku", "codigo"]);
  const name = textValue(record, ["nombre", "nombre producto", "producto", "name"]);
  const categoryName = textValue(record, [
    "categoria",
    "categoría",
    "category",
    "category name",
    "categoryname",
  ]);
  const categoryExternalId = textValue(record, ["categoryid"]);
  // WEB - Fichas stores the full family name in CategoryID and a short code in CategoryName.
  // Other suppliers may use numeric CategoryID and descriptive CategoryName.
  const workbookFamilyIsId = /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(categoryExternalId)
    && categoryExternalId.length > 3 && (!categoryName || categoryName.length <= 4);
  const effectiveCategoryName = workbookFamilyIsId ? categoryExternalId : categoryName;
  const subcategoryName = textValue(record, [
    "subcategoria",
    "subcategoría",
    "subcategoria filtros",
    "tipo de filtro",
  ]);
  const hondaCode = textValue(record, ["codigo honda", "código honda", "honda code"]);
  const description = textValue(record, ["descripcion", "descripción", "description"]);
  const priceValue = getValue(record, ["precio", "precio uyu", "price", "precio en uyu"]);
  const price = parseNumber(priceValue);
  const stockRaw = getValue(record, ["stock", "cantidad"]);
  const stock = parseNumber(stockRaw);
  const activeValue = normalize(getValue(record, ["activo", "active"]));
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
  const active = activeValue ? activeOptions[activeValue] : true;
  const rawModelName = textValue(record, ["modelo", "model", "model name", "modelid"]);
  const modelName = normalize(rawModelName) === "rigeline" ? "ridgeline"
    : normalize(rawModelName) === "civictyper" ? "type-r"
    : rawModelName;
  const yearFromValue = parseNumber(
    getValue(record, ["anio desde", "año desde", "year from", "desde"]),
  );
  const yearToValue = parseNumber(
    getValue(record, ["anio hasta", "año hasta", "year to", "hasta"]),
  );
  const yearFromRaw = getValue(record, ["anio desde", "año desde", "year from", "desde"]);
  const yearToRaw = getValue(record, ["anio hasta", "año hasta", "year to", "hasta"]);

  const subcategory = FILTER_SUBCATEGORIES.find((item) =>
    [item.name, item.slug].some((value) => normalize(value) === normalize(subcategoryName)),
  );
  const categorySearch = subcategory ? "filtros" : effectiveCategoryName || subcategoryName;
  // CategoryID is an external workbook identifier; match an existing slug/name only when no name is provided.
  const categoryLookup = categorySearch || categoryExternalId;
  const category = categories.find((item) =>
    [item.name, item.slug].some((value) => normalize(value) === normalize(categoryLookup)),
  );
  const model = models.find((item) =>
    [item.name, item.slug].some((value) => normalize(value) === normalize(modelName)),
  );
  const availabilityValue = getValue(record, ["disponibilidad", "availability", "avaible", "estado"]);
  const availability = parseAvailability(availabilityValue);

  const errors: string[] = [];
  if (!sku) errors.push("SKU requerido");
  if (!name) errors.push("Nombre requerido");
  if (!subcategoryName && !effectiveCategoryName && !categoryExternalId) errors.push("CategoryName o categoría requerida para identificar CategoryID");
  if (subcategoryName && !subcategory) errors.push(`Subcategoría desconocida: ${subcategoryName}`);
  if (!category) errors.push(`Categoría desconocida: ${categoryLookup || categoryExternalId}`);
  if (subcategory && effectiveCategoryName && normalize(effectiveCategoryName) !== "filtros") {
    errors.push("La subcategoría de filtros debe usar la categoría Filtros");
  }
  if (String(priceValue ?? "").trim() && price === null) errors.push("Precio inválido");
  if (price !== null && price < 0) errors.push("Precio no puede ser negativo");
  if (String(stockRaw ?? "").trim() && stock === null) errors.push("Stock inválido");
  if (stock !== null && (!Number.isInteger(stock) || stock < 0))
    errors.push("Stock debe ser entero y no negativo");
  if (active === undefined) errors.push("Activo debe ser sí/no");
  if (String(availabilityValue ?? "").trim() && availability === null)
    errors.push("Disponibilidad desconocida");
  if (modelName && !model) errors.push(`Modelo desconocido: ${modelName}`);
  if (modelName && (yearFromValue === null || yearToValue === null))
    errors.push("Modelo requiere año desde y año hasta");
  if (!modelName && (String(yearFromRaw ?? "").trim() || String(yearToRaw ?? "").trim())) {
    errors.push("Ingresá un modelo para usar años de compatibilidad");
  }
  if (modelName && yearFromValue !== null && yearToValue !== null) {
    if (!Number.isInteger(yearFromValue) || !Number.isInteger(yearToValue))
      errors.push("Los años deben ser enteros");
    if (yearFromValue < 1970 || yearToValue > 2100)
      errors.push("Los años deben estar entre 1970 y 2100");
    if (yearFromValue > yearToValue) errors.push("Año desde no puede superar año hasta");
  }

  return {
    rowNumber,
    sku,
    name,
    categoryId: category?.id ?? null,
    categoryName: subcategory
      ? `${category?.name ?? "Filtros"} / ${subcategory.name}`
      : (category?.name ?? effectiveCategoryName),
    hondaCode,
    description,
    price,
    stock,
    availability: availability ?? "consultar",
    active: active ?? true,
    modelId: model?.id ?? null,
    yearFrom: yearFromValue ?? 1995,
    yearTo: yearToValue ?? new Date().getFullYear() + 1,
    compatibilityNotes: textValue(record, ["notas compatibilidad", "notas", "compatibilidad"]),
    error: errors.length ? `Fila ${rowNumber}: ${errors.join("; ")}` : null,
  };
};

const withRowError = (row: ImportRow, message: string): ImportRow => ({
  ...row,
  error: row.error ? `${row.error}; ${message}` : `Fila ${row.rowNumber}: ${message}`,
});

export const validateDuplicateSkus = (rows: ImportRow[]) => {
  const bySku = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const group = bySku.get(row.sku) ?? [];
    group.push(row);
    bySku.set(row.sku, group);
  }

  return rows.map((row) => {
    const group = bySku.get(row.sku) ?? [];
    if (group.length < 2) return row;

    const prices = group.flatMap((item) => (item.price === null ? [] : [item.price]));
    const highestPrice = prices.length ? Math.max(...prices) : null;
    const pricedGroup = group.map((item) => ({ ...item, price: highestPrice }));
    const productDetails = new Set(
      pricedGroup.map((item) =>
        JSON.stringify([
          item.name,
          item.categoryId,
          item.hondaCode,
          item.description,
          item.stock,
          item.availability,
          item.active,
        ]),
      ),
    );
    if (productDetails.size > 1)
      return withRowError(row, "Las filas con el mismo SKU deben repetir los mismos datos");

    const hasModel = group.some((item) => item.modelId);
    const hasNoModel = group.some((item) => !item.modelId);
    if (hasModel && hasNoModel)
      return withRowError(row, "No mezcles filas con y sin modelo para el mismo SKU");
    return { ...row, price: highestPrice };
  });
};
