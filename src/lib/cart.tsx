import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addItem, cartTotals, removeItem, setQuantity, type CartItem, type CartTotals } from "./cart-logic";

const STORAGE_KEY = "hl-cart-v1";

interface CartContextValue {
  items: CartItem[];
  totals: CartTotals;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  update: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  hydrated: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore corrupted cart */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => setItems((s) => addItem(s, item, qty)), []);
  const update = useCallback((id: string, qty: number) => setItems((s) => setQuantity(s, id, qty)), []);
  const remove = useCallback((id: string) => setItems((s) => removeItem(s, id)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, totals: cartTotals(items), add, update, remove, clear, hydrated }),
    [items, add, update, remove, clear, hydrated],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
