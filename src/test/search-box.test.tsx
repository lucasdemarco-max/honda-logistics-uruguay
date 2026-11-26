import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "@/components/site/SearchBox";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

beforeEach(() => {
  navigate.mockReset();
});

describe("Catalog code search", () => {
  it("delegates to the catalog callback so model, category and year can be preserved", () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Buscar por código Honda, SKU o nombre" }),
      { target: { value: " 15400-RTA-003 " } },
    );
    fireEvent.submit(screen.getByRole("search"));
    expect(onSearch).toHaveBeenCalledWith("15400-RTA-003");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("supports clearing only the text search", () => {
    const onSearch = vi.fn();
    render(<SearchBox initial="anterior" onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(onSearch).toHaveBeenCalledWith(undefined);
  });

  it("opens the general catalog when searching from the home page", () => {
    render(<SearchBox initial="30907" />);
    fireEvent.submit(screen.getByRole("search"));
    expect(navigate).toHaveBeenCalledWith({ to: "/catalogo", search: { q: "30907" } });
  });

  it("gives multiple search fields independent accessible labels", () => {
    render(
      <>
        <SearchBox />
        <SearchBox />
      </>,
    );
    const inputs = screen.getAllByRole("textbox", {
      name: "Buscar por código Honda, SKU o nombre",
    });
    expect(inputs[0]?.id).not.toBe(inputs[1]?.id);
    expect(inputs.every((input) => Boolean(input.id))).toBe(true);
  });
});
