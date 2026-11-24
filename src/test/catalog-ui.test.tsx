import type { ComponentType, ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogMeta } from "@/lib/catalog";
import type { CatalogNavigationState } from "@/lib/catalog-navigation";
import { Route } from "@/routes/catalogo";

const state = vi.hoisted(() => ({
  search: {} as CatalogNavigationState,
  meta: {} as CatalogMeta,
  products: [] as { id: string; name: string; is_demo: boolean }[],
  isLoading: false,
  isError: false,
  navigate: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => state.search }),
  useNavigate: () => state.navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useSuspenseQuery: () => ({ data: state.meta }),
  useQuery: () => ({
    data: state.products,
    isLoading: state.isLoading,
    isFetching: state.isLoading,
    isError: state.isError,
    refetch: state.refetch,
  }),
}));
vi.mock("@/lib/public.functions", () => ({ searchCatalog: vi.fn(), getCatalogMeta: vi.fn() }));
vi.mock("@/routes/index", () => ({ catalogMetaQuery: {} }));
vi.mock("@/components/site/ProductCard", () => ({
  ProductCard: ({ product }: { product: { name: string } }) => <article>{product.name}</article>,
}));

const Catalog = Route.options.component as ComponentType;

beforeEach(() => {
  state.search = { modelId: "fit", anio: 2020 };
  state.meta = {
    models: [
      { id: "fit", name: "Fit", slug: "fit", sort_order: 0, aliases: ["model-fit"] },
      { id: "crv", name: "CR-V", slug: "cr-v", sort_order: 1, aliases: [] },
    ],
    categories: [
      {
        id: "motor",
        name: "Motor",
        slug: "motor",
        sort_order: 0,
        aliases: [],
        description: null,
        image_key: null,
        created_at: "2026-01-01",
      },
      {
        id: "frenos",
        name: "Frenos",
        slug: "frenos",
        sort_order: 1,
        aliases: [],
        description: null,
        image_key: null,
        created_at: "2026-01-01",
      },
    ],
    brands: [],
    facets: [
      { productId: "p1", categoryId: "motor", modelId: "fit", yearFrom: 2008, yearTo: 2014 },
      { productId: "p1", categoryId: "motor", modelId: "crv", yearFrom: 2020, yearTo: 2026 },
      { productId: "p2", categoryId: "frenos", modelId: "fit", yearFrom: 2018, yearTo: 2024 },
    ],
  };
  state.products = [{ id: "p2", name: "Pastillas de freno", is_demo: false }];
  state.isLoading = false;
  state.isError = false;
  state.navigate.mockReset();
  state.refetch.mockReset();
});

describe("Catalog model and category interface", () => {
  it("shows only categories with products for the selected model and year", () => {
    render(<Catalog />);
    const categoryGroup = within(screen.getByRole("group", { name: "Categorías disponibles" }));
    expect(categoryGroup.getByRole("button", { name: /Frenos/ })).toBeInTheDocument();
    expect(categoryGroup.queryByRole("button", { name: /Motor/ })).not.toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveTextContent("Pastillas de freno");
  });

  it("keeps the model and year when a category is selected", () => {
    render(<Catalog />);
    fireEvent.click(screen.getByRole("button", { name: /Frenos/ }));
    const update = state.navigate.mock.calls[0]?.[0] as {
      search: (previous: CatalogNavigationState) => CatalogNavigationState;
    };
    expect(update.search(state.search)).toMatchObject({
      modelId: "fit",
      categoryId: "frenos",
      anio: 2020,
    });
  });

  it("resolves historical model IDs without turning the selection into all models", () => {
    state.search = { modelId: "model-fit", anio: 2020 };
    render(<Catalog />);
    expect(screen.getByRole("heading", { name: "Honda Fit" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("makes an unknown model link explicit instead of suggesting unrelated categories", () => {
    state.search = { modelId: "missing-model" };
    state.products = [];
    render(<Catalog />);
    expect(screen.getByRole("alert")).toHaveTextContent("El modelo del enlace no está disponible");
    const categoryGroup = within(screen.getByRole("group", { name: "Categorías disponibles" }));
    expect(categoryGroup.queryByRole("button", { name: /Motor|Frenos/ })).not.toBeInTheDocument();
  });

  it("shows a retry action for a failed product request", () => {
    state.isError = true;
    state.products = [];
    render(<Catalog />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(state.refetch).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("heading", { name: "No pudimos cargar el catálogo" }),
    ).toBeInTheDocument();
  });

  it("hides result cards while a new selection is loading", () => {
    state.isLoading = true;
    render(<Catalog />);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByText(/Buscando/)).toBeInTheDocument();
  });

  it("renders 24 of 50 results initially, loads batches of 24 and keeps the total visible", () => {
    state.products = Array.from({ length: 50 }, (_, index) => ({
      id: `p${index}`,
      name: `Producto ${index + 1}`,
      is_demo: false,
    }));
    render(<Catalog />);
    expect(screen.getAllByRole("article")).toHaveLength(24);
    expect(screen.getByText("Mostrando 24 de 50 repuestos")).toBeInTheDocument();
    expect(screen.getByText(/^50 resultados/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar más repuestos" }));
    expect(screen.getAllByRole("article")).toHaveLength(48);
    expect(screen.getByText("Mostrando 48 de 50 repuestos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar más repuestos" }));
    expect(screen.getAllByRole("article")).toHaveLength(50);
    expect(screen.queryByRole("button", { name: "Mostrar más repuestos" })).not.toBeInTheDocument();
  });

  it("resets the visible batch when filters change, including when returning to a previous selection", () => {
    state.products = Array.from({ length: 50 }, (_, index) => ({
      id: `p${index}`,
      name: `Producto ${index + 1}`,
      is_demo: false,
    }));
    const view = render(<Catalog />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar más repuestos" }));
    expect(screen.getAllByRole("article")).toHaveLength(48);
    state.search = { modelId: "crv", anio: 2020 };
    view.rerender(<Catalog />);
    expect(screen.getAllByRole("article")).toHaveLength(24);
    state.search = { modelId: "fit", anio: 2020 };
    view.rerender(<Catalog />);
    expect(screen.getAllByRole("article")).toHaveLength(24);
  });
});
