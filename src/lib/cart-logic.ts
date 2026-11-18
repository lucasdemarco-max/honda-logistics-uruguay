export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  priceUYU: number | null;
  quantity: number;
  imageUrl?: string | null;
}

export const MAX_QTY = 99;

function clampQty(q: number) {
  if (!Number.isFinite(q)) return 1;
  return Math.max(1, Math.min(MAX_QTY, Math.floor(q)));
}

export function addItem(items: CartItem[], item: Omit<CartItem, "quantity">, quantity = 1): CartItem[] {
  const existing = items.find((i) => i.productId === item.productId);
  if (existing) {
    return items.map((i) => (i.productId === item.productId ? { ...i, quantity: clampQty(i.quantity + quantity) } : i));
  }
  return [...items, { ...item, quantity: clampQty(quantity) }];
}

export function setQuantity(items: CartItem[], productId: string, quantity: number): CartItem[] {
  if (quantity <= 0) return removeItem(items, productId);
  return items.map((i) => (i.productId === productId ? { ...i, quantity: clampQty(quantity) } : i));
}

export function removeItem(items: CartItem[], productId: string): CartItem[] {
  return items.filter((i) => i.productId !== productId);
}

export interface CartTotals {
  units: number;
  total: number;
  /** Items whose price must still be confirmed; they are not included in total. */
  unpricedCount: number;
}

export function cartTotals(items: CartItem[]): CartTotals {
  let units = 0;
  let total = 0;
  let unpricedCount = 0;
  for (const i of items) {
    units += i.quantity;
    if (i.priceUYU === null || i.priceUYU === undefined) unpricedCount += 1;
    else total += Math.round(i.priceUYU * 100) * i.quantity;
  }
  return { units, total: total / 100, unpricedCount };
}
