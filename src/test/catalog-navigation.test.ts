import { describe, expect, it } from "vitest";
import {
  catalogCategoryCounts,
  categoriesForModel,
  resolveNavigationLookup,
  selectCatalogCategory,
  selectCatalogModel,
  validateCatalogSearch,
  type NavigationFacet,
} from "@/lib/catalog-navigation";

const models = [
  { id: "model-civic", slug: "civic", name: "Civic" },
  { id: "model-fit", slug: "fit", name: "Fit" },
];
const categories = [
  { id: "filters-id", slug: "filtros", name: "Filtros" },
  { id: "brakes-id", slug: "frenos", name: "Frenos" },
  { id: "new-id", slug: "sensores", name: "Sensores importados" },
];
const facets: NavigationFacet[] = [
  {
    productId: "oil-filter",
    modelId: "model-civic",
    categoryId: "filters-id",
    yearFrom: 2010,
    yearTo: 2015,
  },
  {
    productId: "oil-filter",
    modelId: "model-civic",
    categoryId: "filters-id",
    yearFrom: 2016,
    yearTo: 2024,
  },
  {
    productId: "air-filter",
    modelId: "model-fit",
    categoryId: "filters-id",
    yearFrom: 2018,
    yearTo: 2024,
  },
  { productId: "sensor", modelId: "model-fit", categoryId: "new-id", yearFrom: 2010, yearTo: 2016 },
];

describe("catalog navigation by model and category IDs", () => {
  it("accepts canonical IDs, PascalCase import-style aliases and legacy links", () => {
    const search = validateCatalogSearch({
      ModelID: "model-civic",
      CategoryID: "filters-id",
      modelo: "fit",
      categoria: "filtros",
      anio: "2024",
    });
    expect(search.modelId).toBe("model-civic");
    expect(search.categoryId).toBe("filters-id");
    expect(search.anio).toBe(2024);
    expect(resolveNavigationLookup(models, search.modelId, search.modelo)?.id).toBe("model-civic");
    expect(resolveNavigationLookup(models, undefined, "CIVIC")?.id).toBe("model-civic");
    expect(resolveNavigationLookup(models, "unknown-id", "civic")).toBeUndefined();
    expect(validateCatalogSearch({ modelId: "model-fit", ModelID: "model-civic" }).modelId).toBe(
      "model-fit",
    );
  });

  it("validates optional query values and rejects malformed years", () => {
    expect(
      validateCatalogSearch({
        modelId: " model-fit ",
        categoryId: "new-id",
        q: ["not-a-query"],
        anio: 2024.5,
      }),
    ).toMatchObject({ modelId: "model-fit", categoryId: "new-id", q: undefined, anio: undefined });
    expect(validateCatalogSearch({ anio: 2200 }).anio).toBeUndefined();
  });

  it("shows only categories with products for the selected model, including new categories", () => {
    expect(
      categoriesForModel(categories, facets, "model-civic").map((category) => category.id),
    ).toEqual(["filters-id"]);
    expect(
      categoriesForModel(categories, facets, "model-fit").map((category) => category.id),
    ).toEqual(["filters-id", "new-id"]);
    expect(categoriesForModel(categories, facets, "unmapped-model")).toEqual([]);
    expect(categoriesForModel(categories, facets).map((category) => category.id)).toEqual([
      "filters-id",
      "new-id",
    ]);
  });

  it("counts products once across multiple application ranges and narrows categories by year", () => {
    expect(catalogCategoryCounts(facets, "model-civic").get("filters-id")).toBe(1);
    expect(
      categoriesForModel(categories, facets, "model-fit", 2020).map((category) => category.id),
    ).toEqual(["filters-id"]);
    expect(
      categoriesForModel(categories, facets, "model-fit", 2010).map((category) => category.id),
    ).toEqual(["new-id"]);
    expect(categoriesForModel(categories, facets, "model-fit", 2000)).toEqual([]);
  });

  it("does not treat a product without applications as compatible with a model or year", () => {
    const withoutApplication: NavigationFacet[] = [
      {
        productId: "uncatalogued",
        categoryId: "brakes-id",
        modelId: null,
        yearFrom: null,
        yearTo: null,
      },
    ];
    expect(
      categoriesForModel(categories, withoutApplication).map((category) => category.id),
    ).toEqual(["brakes-id"]);
    expect(categoriesForModel(categories, withoutApplication, "model-fit")).toEqual([]);
    expect(categoriesForModel(categories, withoutApplication, undefined, 2024)).toEqual([]);
  });

  it("keeps model, year, text search and brand when changing category", () => {
    const previous = {
      modelId: "model-fit",
      categoryId: "filters-id",
      categoria: "filtros",
      anio: 2020,
      q: "12345",
      marca: "marca",
    };
    expect(selectCatalogCategory(previous, "new-id")).toEqual({
      ...previous,
      categoryId: "new-id",
      categoria: undefined,
    });
    expect(selectCatalogCategory(previous, undefined).modelId).toBe("model-fit");
  });

  it("resets category and year when starting a selection for another model", () => {
    const next = selectCatalogModel(
      {
        modelId: "model-fit",
        categoryId: "new-id",
        modelo: "fit",
        categoria: "sensores",
        anio: 2020,
        q: "sensor",
      },
      "model-civic",
    );
    expect(next).toMatchObject({
      modelId: "model-civic",
      categoryId: undefined,
      modelo: undefined,
      categoria: undefined,
      anio: undefined,
      q: "sensor",
    });
    expect(selectCatalogModel(next, undefined)).toMatchObject({
      modelId: undefined,
      categoryId: undefined,
      anio: undefined,
    });
  });

  it("does not silently select between duplicate display names", () => {
    const duplicates = [
      { id: "platform-a", slug: "civic-a", name: "Civic sedán" },
      { id: "platform-b", slug: "civic-b", name: "Civic sedán" },
    ];
    expect(resolveNavigationLookup(duplicates, "Civic sedán")).toBeUndefined();
    expect(resolveNavigationLookup(duplicates, "platform-b")?.id).toBe("platform-b");
  });

  it("resolves old local IDs and slugs through aliases without shadowing canonical IDs or slugs", () => {
    const migrated = [
      {
        id: "database-oil",
        slug: "filtros-de-aceite",
        name: "Filtros de Aceite",
        aliases: ["subcat-aceite", "filtros-aceite", "frenos", "database-brakes"],
      },
      { id: "database-brakes", slug: "frenos", name: "Frenos" },
    ];
    expect(resolveNavigationLookup(migrated, "subcat-aceite")?.id).toBe("database-oil");
    expect(resolveNavigationLookup(migrated, undefined, "filtros-aceite")?.id).toBe("database-oil");
    expect(resolveNavigationLookup(migrated, "frenos")?.id).toBe("database-brakes");
    expect(resolveNavigationLookup(migrated, "database-brakes")?.id).toBe("database-brakes");
  });

  it("rejects an alias shared by multiple records instead of falling back to a matching name", () => {
    const ambiguous = [
      { id: "model-a", slug: "civic-a", name: "old-civic", aliases: ["old-civic"] },
      { id: "model-b", slug: "civic-b", name: "Civic plataforma B", aliases: ["old-civic"] },
    ];
    expect(resolveNavigationLookup(ambiguous, "old-civic")).toBeUndefined();
    expect(resolveNavigationLookup(ambiguous, "civic-b")?.id).toBe("model-b");
  });
});
