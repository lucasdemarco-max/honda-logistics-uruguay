import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "@/components/site/SearchBox";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

beforeEach(() => navigate.mockReset());
afterEach(cleanup);

describe("secondary catalog search", () => {
  it("submits through its catalog callback so the selected filters can be preserved", () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} initial="15400" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " 15400-RTA-003 " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(onSearch).toHaveBeenCalledWith("15400-RTA-003");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("opens a global search from the home page", () => {
    render(<SearchBox initial=" filtro " />);
    fireEvent.submit(screen.getByRole("search"));
    expect(navigate).toHaveBeenCalledWith({ to: "/catalogo", search: { q: "filtro" } });
  });

  it("clears only the text query through the callback and gives inputs unique labels", () => {
    const onSearch = vi.fn();
    render(
      <>
        <SearchBox onSearch={onSearch} />
        <SearchBox />
      </>,
    );
    const inputs = screen.getAllByLabelText("Buscar por código Honda, SKU o nombre");
    expect(inputs[0]?.id).not.toBe(inputs[1]?.id);
    fireEvent.submit(screen.getAllByRole("search")[0]!);
    expect(onSearch).toHaveBeenCalledWith(undefined);
    expect(navigate).not.toHaveBeenCalled();
  });
});
