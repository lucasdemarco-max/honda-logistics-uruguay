import type { ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import type { CatalogLookup } from "@/lib/admin-import";
import type { ProductRow } from "@/lib/catalog";
import type { CompatibilityWrite, ProductWrite } from "@/lib/catalog-import";
import { executeCatalogImport } from "@/lib/catalog-import";
import { Route } from "@/routes/_authenticated/admin";

const state = vi.hoisted(() => ({
  lookups: { categories: [] as CatalogLookup[], models: [] as CatalogLookup[] },
  store: {
    authorize: vi.fn(),
    getLookups: vi.fn(),
    createLookups: vi.fn(),
    getProducts: vi.fn(),
    getCompatibilities: vi.fn(),
    saveProduct: vi.fn(),
    addCompatibilities: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  redirect: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/catalog-import-store", () => ({ createCatalogImportStore: () => state.store }));
vi.mock("@/lib/catalog-import", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/catalog-import")>();
  return { ...original, executeCatalogImport: vi.fn(original.executeCatalogImport) };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const Admin = Route.options.component as ComponentType;
const headers = [
  "SKU",
  "NAME",
  "CategoryID",
  "CategoryName",
  "ModelID",
  "ModelName",
  "YearFrom",
  "YearTo",
  "Price",
  "Stock",
];
const validRow = [
  "UI-001",
  "Filtro de prueba",
  "category-filters",
  "Filtros",
  "model-fit",
  "Fit",
  2018,
  2024,
  "",
  "",
];

function workbookFile(sheets: Record<string, unknown[][]>, name = "catalogo.xlsx"): File {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const file = new File([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  // jsdom File does not implement Blob.arrayBuffer on every supported version.
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes });
  return file;
}

function renderAdmin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Admin />
    </QueryClientProvider>,
  );
  return queryClient;
}

async function upload(file: File) {
  const input = screen.getByLabelText("Archivo de catálogo");
  await waitFor(() => expect(input).toBeEnabled());
  fireEvent.change(input, { target: { files: [file] } });
  return screen.findByRole("button", { name: "Confirmar importación" });
}

function expectNoWrites() {
  expect(executeCatalogImport).not.toHaveBeenCalled();
  expect(state.store.createLookups).not.toHaveBeenCalled();
  expect(state.store.saveProduct).not.toHaveBeenCalled();
  expect(state.store.addCompatibilities).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  state.lookups = {
    categories: [{ id: "category-filters", name: "Filtros", slug: "filtros" }],
    models: [{ id: "model-fit", name: "Fit", slug: "fit" }],
  };
  state.store.authorize.mockResolvedValue(undefined);
  state.store.getLookups.mockImplementation(async () => structuredClone(state.lookups));
  state.store.getProducts.mockResolvedValue([]);
  state.store.getCompatibilities.mockResolvedValue([]);
  state.store.createLookups.mockImplementation(
    async (kind: "categories" | "models", items: CatalogLookup[]) => {
      state.lookups[kind].push(...items.map((item) => ({ ...item, id: `saved-${item.slug}` })));
      return items.length;
    },
  );
  state.store.saveProduct.mockImplementation(async (values: ProductWrite, existingId?: string) => ({
    id: existingId ?? `saved-${values.sku}`,
    sku: values.sku,
  }));
  state.store.addCompatibilities.mockImplementation(
    async (values: CompatibilityWrite[]) => values.length,
  );
});

describe("Admin Excel preview and confirmation", () => {
  it("previews new categories and models without writing, then saves only on confirmation", async () => {
    renderAdmin();
    const confirm = await upload(
      workbookFile({
        Encendido: [
          headers,
          [
            "UI-NEW",
            "Bobina",
            "CAT-ENC",
            "Encendido",
            "MD-NEW",
            "Modelo nuevo",
            2020,
            2024,
            1500,
            2,
          ],
        ],
      }),
    );
    expect(screen.getByText("Se crearán estas referencias al confirmar:")).toBeInTheDocument();
    expect(screen.getByText(/Categorías: Encendido \(cat-enc\)/)).toBeInTheDocument();
    expect(screen.getByText(/Modelos: Modelo nuevo \(md-new\)/)).toBeInTheDocument();
    expect(confirm).toBeEnabled();
    expectNoWrites();
    expect(state.store.getProducts).not.toHaveBeenCalled();

    fireEvent.click(confirm);
    await screen.findByText(/Importación completa: 1 productos nuevos/);
    expect(executeCatalogImport).toHaveBeenCalledOnce();
    expect(state.store.createLookups).toHaveBeenCalledTimes(2);
    expect(state.store.saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: "UI-NEW",
        category_id: "saved-cat-enc",
        price_uyu: 1500,
        stock: 2,
      }),
      undefined,
    );
    expect(state.store.addCompatibilities).toHaveBeenCalledWith([
      expect.objectContaining({
        product_id: "saved-UI-NEW",
        model_id: "saved-md-new",
        year_from: 2020,
        year_to: 2024,
      }),
    ]);
    expect(screen.queryByRole("button", { name: "Confirmar importación" })).not.toBeInTheDocument();
  });

  it("shows sheet provenance, ignores auxiliary sheets and recomputes counts when sheets are selected", async () => {
    renderAdmin();
    const confirm = await upload(
      workbookFile({
        Primera: [["Catálogo Honda"], headers, validRow],
        Segunda: [headers, ["UI-002", ...validRow.slice(1)]],
        Instrucciones: [["Instrucciones del catálogo"], ["Cargá una fila por aplicación"]],
      }),
    );
    expect(screen.getByText("2 productos · 2 filas · 0 con errores")).toBeInTheDocument();
    expect(screen.getByText(/Hojas auxiliares omitidas: Instrucciones/)).toBeInTheDocument();
    const first = screen.getByRole("checkbox", {
      name: "Primera · 1 filas · encabezado en fila 2",
    });
    const second = screen.getByRole("checkbox", {
      name: "Segunda · 1 filas · encabezado en fila 1",
    });
    expect(first).toBeChecked();
    expect(second).toBeChecked();
    expect(screen.getByText("Primera · 3")).toBeInTheDocument();
    fireEvent.click(second);
    expect(screen.getByText("1 productos · 1 filas · 0 con errores")).toBeInTheDocument();
    expect(screen.queryByText("UI-002")).not.toBeInTheDocument();
    fireEvent.click(first);
    expect(confirm).toBeDisabled();
    expect(screen.getByText("Seleccioná al menos una hoja con productos.")).toBeInTheDocument();
    fireEvent.click(second);
    expect(confirm).toBeEnabled();
    expectNoWrites();
  });

  it("blocks confirmation when any selected row is invalid and allows excluding that sheet", async () => {
    renderAdmin();
    const invalid = [...validRow];
    invalid[0] = "UI-BAD";
    invalid[9] = -3;
    const confirm = await upload(
      workbookFile({ Valida: [headers, validRow], Invalida: [headers, invalid] }),
    );
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Corregí todas las filas indicadas");
    expect(screen.getByText(/Stock debe ser entero y no negativo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar errores" })).toBeEnabled();
    fireEvent.click(confirm);
    expectNoWrites();
    fireEvent.click(screen.getByRole("checkbox", { name: /Invalida/ }));
    expect(confirm).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expectNoWrites();
  });

  it("shows blank optional cells as preserved and omits them from an existing product update", async () => {
    const existing = {
      id: "existing-ui-product",
      sku: "UI-001",
      name: "Nombre anterior",
      category_id: "category-filters",
      honda_code: "HONDA-SAVED",
      description: "Descripción guardada",
      brand_id: null,
      honda_relation: null,
      homologation_reference: null,
      price_uyu: 1200,
      stock: 7,
      availability: "a_pedido",
      image_url: null,
      promo_text: null,
      active: false,
      is_demo: false,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    } satisfies ProductRow;
    state.store.getProducts.mockResolvedValue([existing]);
    renderAdmin();
    const confirm = await upload(workbookFile({ Productos: [headers, validRow] }));
    const table = within(screen.getByRole("table"));
    expect(table.getAllByText("Conservar / sin dato")).toHaveLength(2);
    expectNoWrites();
    fireEvent.click(confirm);
    await screen.findByText(/Importación completa: 0 productos nuevos, 1 actualizados/);
    expect(state.store.saveProduct).toHaveBeenCalledWith(
      { sku: "UI-001", name: "Filtro de prueba", category_id: "category-filters" },
      "existing-ui-product",
    );
  });

  it("blocks file upload when catalog permission is missing", async () => {
    state.store.authorize.mockRejectedValueOnce(
      new Error("Tu cuenta no tiene permiso para administrar el catálogo"),
    );
    renderAdmin();
    expect(await screen.findByRole("alert")).toHaveTextContent("no tiene permiso");
    expect(screen.getByLabelText("Archivo de catálogo")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descargar plantilla" })).toBeDisabled();
    expect(state.store.getLookups).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("reports workbook errors without exposing a confirm action or making writes", async () => {
    renderAdmin();
    const input = screen.getByLabelText("Archivo de catálogo");
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, {
      target: {
        files: [
          workbookFile({
            Productos: [
              ["SKU", "Precio"],
              ["BAD", 10],
            ],
          }),
        ],
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no encontramos encabezados SKU y Nombre",
    );
    expect(screen.queryByRole("button", { name: "Confirmar importación" })).not.toBeInTheDocument();
    expectNoWrites();
  });
});
