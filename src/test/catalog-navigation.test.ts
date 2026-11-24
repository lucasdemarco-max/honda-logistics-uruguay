import { describe, expect, it } from "vitest";
import {
  catalogCategoryCounts,
  categoriesForModel,
  selectCatalogCategory,
  selectCatalogModel,
  validateCatalogSearch,
  type NavigationFacet,
} from "@/lib/catalog-navigation";

const categories = [
  { id: "motor", name: "Motor", slug: "motor" },
  { id: "frenos", name: "Frenos", slug: "frenos" },
  { id: "accesorios", name: "Accesorios", slug: "accesorios" },
  { id: "vacia", name: "Sin productos", slug: "vacia" },
];
const facets: NavigationFacet[] = [
  { productId: "p1", categoryId: "motor", modelId: "fit", yearFrom: 2008, yearTo: 2014 },
  { productId: "p1", categoryId: "motor", modelId: "crv", yearFrom: 2020, yearTo: 2026 },
  { productId: "p2", categoryId: "frenos", modelId: "fit", yearFrom: 2018, yearTo: 2022 },
  { productId: "p2", categoryId: "frenos", modelId: "fit", yearFrom: 2020, yearTo: 2024 },
  { productId: "p3", categoryId: "accesorios", modelId: null, yearFrom: null, yearTo: null },
];

describe("Model-first catalog navigation", () => {
  it("normalizes canonical and Excel-style ID URL parameters while preserving legacy links", () => {
    expect(
      validateCatalogSearch({
        ModelID: " model-1 ",
        CategoryID: " cat-1 ",
        modelo: "fit",
        anio: "2020",
      }),
    ).toMatchObject({ modelId: "model-1", categoryId: "cat-1", modelo: "fit", anio: 2020 });
    expect(validateCatalogSearch({ modelId: "canonical", ModelID: "legacy" }).modelId).toBe(
      "canonical",
    );
    expect(validateCatalogSearch({ modelo: "hr-v", categoria: "filtros" })).toMatchObject({
      modelo: "hr-v",
      categoria: "filtros",
    });
  });

  it("rejects malformed years and keeps the supported boundaries", () => {
    for (const anio of ["2020.5", "texto", 1969, 2101]) {
      expect(validateCatalogSearch({ anio }).anio).toBeUndefined();
    }
    expect(validateCatalogSearch({ anio: 1970 }).anio).toBe(1970);
    expect(validateCatalogSearch({ anio: 2100 }).anio).toBe(2100);
  });

  it("matches model and year in the same application when listing categories", () => {
    expect(
      categoriesForModel(categories, facets, "fit", 2020).map((category) => category.id),
    ).toEqual(["frenos"]);
    expect(
      categoriesForModel(categories, facets, "crv", 2020).map((category) => category.id),
    ).toEqual(["motor"]);
    expect(categoriesForModel(categories, facets, "fit", 2026)).toEqual([]);
  });

  it("counts a product once even when several compatibility ranges match", () => {
    expect(catalogCategoryCounts(facets, "fit", 2020).get("frenos")).toBe(1);
    expect(catalogCategoryCounts(facets).get("motor")).toBe(1);
  });

  it("keeps products without compatibility accessible in the general catalog", () => {
    expect(categoriesForModel(categories, facets).map((category) => category.id)).toEqual([
      "motor",
      "frenos",
      "accesorios",
    ]);
    expect(categoriesForModel(categories, facets, "fit").map((category) => category.id)).toEqual([
      "motor",
      "frenos",
    ]);
    expect(categoriesForModel(categories, facets, "unknown-model")).toEqual([]);
  });

  it("clears category and year on model changes without discarding a code search", () => {
    const next = selectCatalogModel(
      {
        modelId: "fit",
        modelo: "fit",
        categoryId: "frenos",
        categoria: "frenos",
        anio: 2020,
        q: "45251",
        marca: "honda",
      },
      "crv",
    );
    expect(next).toEqual({
      modelId: "crv",
      modelo: undefined,
      categoryId: undefined,
      categoria: undefined,
      anio: undefined,
      q: "45251",
      marca: "honda",
    });
  });

  it("keeps model and year when a different category is selected", () => {
    const next = selectCatalogCategory(
      { modelId: "fit", anio: 2020, categoria: "legacy", q: "45251" },
      "frenos",
    );
    expect(next).toEqual({
      modelId: "fit",
      anio: 2020,
      categoria: undefined,
      categoryId: "frenos",
      q: "45251",
    });
  });
});
