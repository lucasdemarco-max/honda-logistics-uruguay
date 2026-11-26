import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const service = vi.hoisted(() => ({
  loadImportLookups: vi.fn(async () => ({ categories: [], models: [] })),
  executeImport: vi.fn(async () => ({
    products: 1,
    categories: 1,
    models: 1,
    compatibilities: 1,
    notes: 0,
  })),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/admin-import-service", () => ({
  ...service,
  ImportExecutionError: class ImportExecutionError extends Error {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import { Admin } from "@/routes/_authenticated/admin";

function uploadFile(rows: unknown[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([["Cómo usar la plantilla"]]),
    "Instrucciones",
  );
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Productos");
  const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
  const file = new File([bytes], "repuestos.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes });
  return file;
}

describe("administrative Excel preview", () => {
  beforeEach(() => vi.clearAllMocks());
  it("loads a dynamic-category workbook without writes and requires explicit confirmation", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Admin />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText("Archivo de productos")).not.toBeDisabled());
    const file = uploadFile([
      ["SKU", "Name", "CategoryID", "CategoryName", "ModelID", "ModelName", "YearFrom", "YearTo"],
      ["0001", "Repuesto", "c1", "Categoría nueva", "m1", "Modelo nuevo", 2020, 2024],
    ]);
    fireEvent.change(screen.getByLabelText("Archivo de productos"), { target: { files: [file] } });
    await screen.findByText(/Se crearán al confirmar/);
    expect(screen.getByLabelText("Hoja")).toHaveValue("Productos");
    expect(service.executeImport).not.toHaveBeenCalled();
    expect(screen.getByText("0001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importación" }));
    await screen.findByRole("status");
    expect(service.executeImport).toHaveBeenCalledTimes(1);
  });

  it("blocks confirmation when a worksheet contains errors", async () => {
    const client = new QueryClient();
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <Admin />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getAllByLabelText("Archivo de productos").at(-1)).not.toBeDisabled(),
    );
    const inputs = screen.getAllByLabelText("Archivo de productos");
    fireEvent.change(inputs.at(-1)!, {
      target: {
        files: [
          uploadFile([
            ["SKU", "Name", "CategoryName", "Stock"],
            ["1", "Repuesto", "Nueva", -1],
          ]),
        ],
      },
    });
    await screen.findByText("Corregí las filas con errores y volvé a cargar el archivo.");
    const buttons = screen.getAllByRole("button", { name: "Confirmar importación" });
    expect(buttons.at(-1)).toBeDisabled();
    expect(service.executeImport).not.toHaveBeenCalled();
    unmount();
  });
});
