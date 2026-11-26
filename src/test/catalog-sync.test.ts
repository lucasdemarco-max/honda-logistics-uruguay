import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it } from "vitest";
import originalData from "@/data/filtros.json";
import { synchronizeCatalog, type CatalogSnapshotProduct } from "../../scripts/catalog-sync.ts";
import { runCatalogSyncCli } from "../../scripts/generate-catalog-data.ts";

const original = originalData as CatalogSnapshotProduct[];
const now = "2026-11-24T18:00:00.000Z";
const records = (record: Record<string, unknown>) => [{ rowNumber: 2, record }];
const newPart = (overrides: Record<string, unknown> = {}) => ({
  SKU: "00042",
  Name: "Repuesto de prueba",
  CategoryID: "refrigeracion",
  CategoryName: "Refrigeración",
  ModelID: "plataforma-x",
  ModelName: "Plataforma X",
  YearFrom: 2024,
  YearTo: 2026,
  ...overrides,
});

const directories: string[] = [];
const tempDirectory = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "honda-catalog-sync-"));
  directories.push(directory);
  return directory;
};
afterEach(() => {
  for (const directory of directories.splice(0))
    fs.rmSync(directory, { recursive: true, force: true });
});

function workbookFile(directory: string, rows: Record<string, unknown>[], sheetName = "Repuestos") {
  const filename = path.join(directory, "repuestos.xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  XLSX.writeFile(workbook, filename);
  return filename;
}

describe("portable catalog synchronization", () => {
  it("preserves all existing products and adds explicit category/model data without guessed stock or homologation", () => {
    const result = synchronizeCatalog(records(newPart()), original, now);
    expect(result.products).toHaveLength(original.length + 1);
    expect(result.products.slice(0, original.length)).toEqual(original);
    const added = result.products.at(-1)!;
    expect(added.category?.name).toBe("Refrigeración");
    expect(added.category?.slug).toBe("refrigeracion");
    expect(added.compat[0]).toMatchObject({
      model: "Plataforma X",
      model_slug: "plataforma-x",
      year_from: 2024,
    });
    expect(added.sku).toBe("00042");
    expect(added.price_uyu).toBeNull();
    expect(added.stock).toBeNull();
    expect(added.honda_relation).toBeNull();
    expect(added.homologation_reference).toBeNull();
    expect(result).toMatchObject({
      added: 1,
      updated: 0,
      addedCompatibilities: 1,
      newCategories: 1,
      newModels: 1,
    });
  });

  it("preserves blank optional fields, existing inactive state and applications while accepting an explicit zero", () => {
    const product = { ...original[0]!, active: false, stock: 17, image_url: "/verified-image.jpg" };
    const base = [product, ...original.slice(1)];
    const result = synchronizeCatalog(
      records({
        SKU: product.sku,
        Name: product.name,
        CategoryID: product.category!.id,
        Price: 0,
        Stock: "",
        HondaCode: "",
        Description: "",
        Active: "",
        ModelID: "nueva-plataforma",
        ModelName: "Nueva plataforma",
        YearFrom: 2025,
        YearTo: 2026,
      }),
      base,
      now,
    );
    const updated = result.products[0]!;
    expect(updated).toMatchObject({
      id: product.id,
      price_uyu: 0,
      stock: 17,
      active: false,
      honda_code: product.honda_code,
      description: product.description,
      image_url: product.image_url,
    });
    expect(updated.compat.slice(0, product.compat.length)).toEqual(product.compat);
    expect(updated.compat).toHaveLength(product.compat.length + 1);
    expect(result.products.slice(1)).toEqual(original.slice(1));
    expect(base[0]).toEqual(product);
  });

  it("is idempotent when the same workbook is imported again", () => {
    const rows = records(newPart({ Price: 0, Stock: 0 }));
    const first = synchronizeCatalog(rows, original, now);
    const second = synchronizeCatalog(rows, first.products, "2026-11-25T18:00:00.000Z");
    expect(second.products).toEqual(first.products);
    expect(second).toMatchObject({
      added: 0,
      updated: 0,
      unchanged: 1,
      addedCompatibilities: 0,
      newCategories: 0,
      newModels: 0,
    });
  });

  it("resolves an existing ModelID even when some legacy applications have only the slug", () => {
    const legacy = original[0]!;
    const application = legacy.compat[0]!;
    const canonicalId = "12345678-1234-1234-1234-123456789abc";
    const withId = {
      ...original[1]!,
      compat: [{ ...application, model_id: canonicalId }],
    };
    const result = synchronizeCatalog(
      records({
        SKU: legacy.sku,
        Name: legacy.name,
        CategoryID: legacy.category!.id,
        ModelID: canonicalId,
        YearFrom: application.year_from,
        YearTo: application.year_to,
      }),
      [legacy, withId],
      now,
    );
    expect(result.products).toEqual([legacy, withId]);
    expect(result.addedCompatibilities).toBe(0);
  });

  it("refuses conflicting saved compatibility notes without modifying the source", () => {
    const product = original[0]!;
    const application = product.compat[0]!;
    const base = [{ ...product, compat: [{ ...application, notes: "Sólo versión A" }] }];
    const before = JSON.stringify(base);
    expect(() =>
      synchronizeCatalog(
        records({
          SKU: product.sku,
          Name: product.name,
          CategoryID: product.category!.id,
          ModelID: application.model_slug,
          YearFrom: application.year_from,
          YearTo: application.year_to,
          CompatibilityNotes: "Sólo versión B",
        }),
        base,
        now,
      ),
    ).toThrow("contradicen el catálogo base");
    expect(JSON.stringify(base)).toBe(before);
  });

  it("requires an explicit output and does not write during dry-run", () => {
    const directory = tempDirectory();
    const input = workbookFile(directory, [newPart()]);
    const output = path.join(directory, "catalogo.json");
    expect(() => runCatalogSyncCli(["--input", input])).toThrow("--output");
    const summary = runCatalogSyncCli(["--input", input, "--output", output, "--dry-run"]);
    expect(summary).toContain("no se escribió ningún archivo");
    expect(summary).toContain(`${original.length + 1} productos`);
    expect(fs.existsSync(output)).toBe(false);
  });

  it("merges a new output with the original catalog and an existing output with its own records", () => {
    const directory = tempDirectory();
    const input = workbookFile(directory, [newPart()]);
    const output = path.join(directory, "catalogo.json");
    runCatalogSyncCli(["--input", input, "--output", output]);
    const saved = JSON.parse(fs.readFileSync(output, "utf8")) as CatalogSnapshotProduct[];
    expect(saved.slice(0, original.length)).toEqual(original);
    const bytes = fs.readFileSync(output, "utf8");
    const summary = runCatalogSyncCli(["--input", input, "--output", output]);
    expect(summary).toContain("0 productos nuevos, 0 actualizados, 1 sin cambios");
    expect(fs.readFileSync(output, "utf8")).toBe(bytes);
  });

  it("does not touch an existing output when any imported row is invalid", () => {
    const directory = tempDirectory();
    const input = workbookFile(directory, [
      newPart(),
      newPart({ SKU: "invalid", YearFrom: 2030, YearTo: 2025 }),
    ]);
    const output = path.join(directory, "catalogo.json");
    const originalBytes = JSON.stringify(original, null, 3);
    fs.writeFileSync(output, originalBytes);
    expect(() => runCatalogSyncCli(["--input", input, "--output", output])).toThrow(
      "No se guardó ningún cambio",
    );
    expect(fs.readFileSync(output, "utf8")).toBe(originalBytes);
    expect(fs.readdirSync(directory)).toEqual(["catalogo.json", "repuestos.xlsx"]);
  });

  it("requires a sheet selection when more than one product sheet exists", () => {
    const directory = tempDirectory();
    const input = path.join(directory, "repuestos.xlsx");
    const output = path.join(directory, "catalogo.json");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([newPart()]), "Refrigeración");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([newPart({ SKU: "999" })]),
      "Otros",
    );
    XLSX.writeFile(workbook, input);
    expect(() => runCatalogSyncCli(["--input", input, "--output", output])).toThrow(
      "Elegí una con --sheet",
    );
    expect(fs.existsSync(output)).toBe(false);
    const summary = runCatalogSyncCli(["--input", input, "--output", output, "--sheet", "Otros"]);
    expect(summary).toContain("Hoja: Otros");
    expect(JSON.parse(fs.readFileSync(output, "utf8")).at(-1).sku).toBe("999");
  });

  it("preserves leading zeros from CSV identifiers", () => {
    const directory = tempDirectory();
    const input = path.join(directory, "repuestos.csv");
    const output = path.join(directory, "catalogo.json");
    fs.writeFileSync(
      input,
      "SKU,Name,CategoryID,CategoryName,HondaCode,Price,Stock\n00009,Pieza,otros-nuevos,Otros nuevos,00000123,0,0\n",
    );
    runCatalogSyncCli(["--input", input, "--output", output]);
    const added = JSON.parse(fs.readFileSync(output, "utf8")).at(-1);
    expect(added).toMatchObject({ sku: "00009", honda_code: "00000123", price_uyu: 0, stock: 0 });
  });
});
