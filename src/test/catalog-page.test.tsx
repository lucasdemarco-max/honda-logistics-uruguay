import type { ComponentType } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogNavigationState } from "@/lib/catalog-navigation";

const state = vi.hoisted(() => ({
  search: {} as CatalogNavigationState,
  navigate: vi.fn(),
  query: { data: [], isLoading: false, isFetching: false, isError: false, refetch: vi.fn() },
  meta: {
    models: [
      { id: "civic-id", name: "Civic", slug: "civic", sort_order: 0 },
      { id: "fit-id", name: "Fit", slug: "fit", sort_order: 1 },
    ],
    categories: [
      { id: "filters-id", name: "Filtros", slug: "filtros" },
      { id: "brakes-id", name: "Frenos", slug: "frenos" },
      { id: "sensors-id", name: "Sensores nuevos", slug: "sensores" },
    ],
    facets: [
      {
        productId: "filter",
        modelId: "civic-id",
        categoryId: "filters-id",
        yearFrom: 2010,
        yearTo: 2025,
      },
      {
        productId: "sensor",
        modelId: "civic-id",
        categoryId: "sensors-id",
        yearFrom: 2010,
        yearTo: 2015,
      },
      {
        productId: "brake",
        modelId: "fit-id",
        categoryId: "brakes-id",
        yearFrom: 2010,
        yearTo: 2025,
      },
    ],
    brands: [],
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => state.search }),
  useNavigate: () => state.navigate,
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options: object) => options,
  useSuspenseQuery: () => ({ data: state.meta }),
  useQuery: () => state.query,
}));
vi.mock("@/lib/public.functions", () => ({ getCatalogMeta: vi.fn(), searchCatalog: vi.fn() }));
vi.mock("@/components/site/ProductCard", () => ({
  ProductCard: () => <article>Producto</article>,
}));

import { Route } from "@/routes/catalogo";
const CatalogPage = Route.options.component as ComponentType;

beforeEach(() => {
  state.search = {};
  state.query.isError = false;
  state.query.isLoading = false;
  state.query.refetch.mockReset();
  state.navigate.mockReset();
  state.navigate.mockImplementation(
    (options: {
      search:
        CatalogNavigationState | ((previous: CatalogNavigationState) => CatalogNavigationState);
    }) => {
      state.search =
        typeof options.search === "function" ? options.search(state.search) : options.search;
    },
  );
});
afterEach(cleanup);

describe("catalog page model → category interaction", () => {
  it("renders dynamic categories for the chosen model and year only", () => {
    state.search = { modelId: "civic-id", anio: 2020 };
    render(<CatalogPage />);
    const group = screen.getByRole("group", { name: "Categorías disponibles" });
    expect(within(group).getByRole("button", { name: /Filtros/ })).toBeInTheDocument();
    expect(within(group).queryByRole("button", { name: /Frenos/ })).not.toBeInTheDocument();
    expect(
      within(group).queryByRole("button", { name: /Sensores nuevos/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps model and year when a category is selected, and keeps all filters on text search", () => {
    state.search = { modelId: "civic-id", anio: 2014, q: "viejo" };
    render(<CatalogPage />);
    fireEvent.click(screen.getByRole("button", { name: /Sensores nuevos/ }));
    expect(state.search).toMatchObject({
      modelId: "civic-id",
      categoryId: "sensors-id",
      anio: 2014,
    });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " 37830 " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(state.search).toMatchObject({
      modelId: "civic-id",
      categoryId: "sensors-id",
      anio: 2014,
      q: "37830",
    });
  });

  it("selects a model by ID and resets previous category/year", () => {
    state.search = { categoryId: "brakes-id", anio: 2014 };
    render(<CatalogPage />);
    const models = screen.getByRole("group", { name: "Modelos Honda" });
    fireEvent.click(within(models).getByRole("button", { name: /Civic/ }));
    expect(state.search).toMatchObject({
      modelId: "civic-id",
      categoryId: undefined,
      anio: undefined,
    });
  });

  it("reports an unknown model link rather than selecting another vehicle", () => {
    state.search = { modelId: "missing-id", modelo: "fit" };
    render(<CatalogPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("El modelo del enlace no está disponible");
    expect(screen.getByRole("group", { name: "Modelos Honda" })).toBeInTheDocument();
  });

  it("keeps legacy filter-group links distinct from a specific category", () => {
    state.search = { modelId: "civic-id", categoria: "filtros" };
    render(<CatalogPage />);
    expect(
      screen.getByRole("button", { name: "Todos los filtros; quitar selección" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Filtros 1" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.queryByText("La categoría del enlace no tiene aplicaciones para esta selección."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todos los filtros; quitar selección" }));
    expect(state.search).toMatchObject({
      modelId: "civic-id",
      categoria: undefined,
      categoryId: undefined,
    });
  });

  it("offers a retry when the product request fails", () => {
    state.query.isError = true;
    render(<CatalogPage />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(state.query.refetch).toHaveBeenCalledOnce();
  });
});
