import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { readImportSheet } from "../src/lib/import-workbook.ts";
import { synchronizeCatalog, type CatalogSnapshotProduct } from "./catalog-sync.ts";

const DEFAULT_BASE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/data/filtros.json",
);
const HELP = `Sincronizador universal del catálogo Honda Logistics

bun scripts/generate-catalog-data.ts --input archivo.xlsx --output catalogo.json [--sheet Productos] [--base base.json] [--dry-run]

--input    Archivo .xlsx, .xls o .csv.
--output   Archivo JSON de destino (obligatorio; nunca se elige por vos).
--sheet    Nombre exacto de la hoja. Obligatorio si hay varias hojas de productos.
--base     Base para un destino nuevo. Por defecto se conserva el catálogo local original.
--dry-run  Valida y muestra el resumen sin escribir archivos.

Un destino existente siempre se usa como base. No se borran productos ni aplicaciones.
Los IDs y nombres se toman de columnas explícitas; los nombres de piezas no definen categorías.
Una fila inválida cancela la escritura completa. Los campos opcionales vacíos conservan los datos previos.`;

interface Arguments {
  input: string;
  output: string;
  sheet?: string;
  base?: string;
  dryRun: boolean;
}

function parseArguments(args: string[]): Arguments {
  const values: Record<string, string> = {};
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") continue;
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (!["--input", "--output", "--sheet", "--base"].includes(arg)) {
      throw new Error(`Opción desconocida: ${arg}\nUsá --help para ver la ayuda.`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Falta el valor de ${arg}`);
    if (values[arg]) throw new Error(`La opción ${arg} está repetida`);
    values[arg] = value;
    index += 1;
  }
  if (!values["--input"] || !values["--output"]) {
    throw new Error("Indicá --input y --output. Usá --help para ver la ayuda.");
  }
  return {
    input: path.resolve(values["--input"]),
    output: path.resolve(values["--output"]),
    ...(values["--sheet"] ? { sheet: values["--sheet"] } : {}),
    ...(values["--base"] ? { base: path.resolve(values["--base"]) } : {}),
    dryRun,
  };
}

function readBase(filename: string): CatalogSnapshotProduct[] {
  const value: unknown = JSON.parse(fs.readFileSync(filename, "utf8"));
  if (!Array.isArray(value))
    throw new Error("El catálogo base debe ser una lista JSON de productos");
  for (const [index, product] of value.entries()) {
    if (
      !product ||
      typeof product !== "object" ||
      typeof product.id !== "string" ||
      typeof product.sku !== "string" ||
      !product.sku.trim() ||
      typeof product.name !== "string" ||
      !Array.isArray(product.compat)
    ) {
      throw new Error(`Producto ${index + 1}: formato inválido en el catálogo base`);
    }
    if (
      product.category &&
      (typeof product.category.id !== "string" ||
        typeof product.category.name !== "string" ||
        typeof product.category.slug !== "string")
    ) {
      throw new Error(`Producto ${product.sku}: categoría inválida en el catálogo base`);
    }
    for (const application of product.compat) {
      if (
        !application ||
        typeof application.model !== "string" ||
        typeof application.model_slug !== "string" ||
        !Number.isInteger(application.year_from) ||
        !Number.isInteger(application.year_to) ||
        application.year_from < 1970 ||
        application.year_to > 2100 ||
        application.year_from > application.year_to
      ) {
        throw new Error(`Producto ${product.sku}: compatibilidad inválida en el catálogo base`);
      }
    }
  }
  return value as CatalogSnapshotProduct[];
}

function selectSheet(workbook: XLSX.WorkBook, requested?: string) {
  if (requested) return { name: requested, records: readImportSheet(workbook, requested) };
  const candidates = workbook.SheetNames.flatMap((name) => {
    try {
      return [{ name, records: readImportSheet(workbook, name) }];
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("No encontramos encabezados"))
        return [];
      throw error;
    }
  });
  if (candidates.length > 1) {
    throw new Error(
      `Hay varias hojas de productos (${candidates.map((item) => item.name).join(", ")}). Elegí una con --sheet.`,
    );
  }
  if (!candidates[0]) throw new Error("No encontramos una hoja con encabezados SKU y Nombre/Name");
  return candidates[0];
}

export function runCatalogSyncCli(argv: string[]): string {
  if (argv.includes("--help") || argv.includes("-h")) return HELP;
  const args = parseArguments(argv);
  if (!/\.(xlsx|xls|csv)$/i.test(args.input))
    throw new Error("El archivo de entrada debe ser .xlsx, .xls o .csv");
  if (!/\.json$/i.test(args.output))
    throw new Error("El archivo de salida debe tener extensión .json");
  if (fs.statSync(args.input).size > 20 * 1024 * 1024)
    throw new Error("El archivo supera los 20 MB; dividilo antes de importar");
  const outputExists = fs.existsSync(args.output);
  if (outputExists && args.base && args.base !== args.output) {
    throw new Error(
      "El destino ya existe y se conservará como base. Omití --base o elegí un destino nuevo.",
    );
  }
  const basePath = outputExists ? args.output : (args.base ?? DEFAULT_BASE);
  const existing = readBase(basePath);
  const workbook = XLSX.readFile(args.input, { cellText: true, cellNF: true, raw: true });
  const selected = selectSheet(workbook, args.sheet);
  const result = synchronizeCatalog(selected.records, existing);

  if (!args.dryRun) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    const temporary = `${args.output}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, `${JSON.stringify(result.products, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      fs.renameSync(temporary, args.output);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  return [
    args.dryRun
      ? "Validación completa; no se escribió ningún archivo."
      : `Catálogo guardado: ${args.output}`,
    `Hoja: ${selected.name}. Base: ${basePath}.`,
    `${result.added} productos nuevos, ${result.updated} actualizados, ${result.unchanged} sin cambios; ${result.products.length} productos conservados en total.`,
    `${result.addedCompatibilities} aplicaciones nuevas, ${result.newCategories} categorías nuevas y ${result.newModels} modelos nuevos.`,
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(runCatalogSyncCli(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "No pudimos sincronizar el catálogo");
    process.exitCode = 1;
  }
}
