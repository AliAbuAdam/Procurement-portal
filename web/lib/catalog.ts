// Категории витрины: типы и сборка дерева из плоского списка API.

export interface Category {
  id: string;
  parent_id?: string;
  name: string;
  position?: number;
  product_count?: number;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
  /** Товаров в категории с учётом всех подкатегорий. */
  total_count: number;
}

export function buildCategoryTree(list: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const c of list) {
    nodes.set(c.id, { ...c, children: [], total_count: c.product_count ?? 0 });
  }
  const roots: CategoryNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parent_id ? nodes.get(n.parent_id) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  const sum = (n: CategoryNode): number => {
    n.total_count =
      (n.product_count ?? 0) +
      n.children.reduce((acc, ch) => acc + sum(ch), 0);
    return n.total_count;
  };
  roots.forEach(sum);
  return roots;
}

/** Дерево -> плоский список с глубиной (для Select с отступами). */
export function flattenTree(
  roots: CategoryNode[],
  depth = 0,
): { id: string; name: string; depth: number }[] {
  return roots.flatMap((n) => [
    { id: n.id, name: n.name, depth },
    ...flattenTree(n.children, depth + 1),
  ]);
}

/** Путь от корня до категории (хлебные крошки карточки товара). */
export function categoryPath(list: Category[], id?: string): Category[] {
  if (!id) return [];
  const byId = new Map(list.map((c) => [c.id, c]));
  const path: Category[] = [];
  let cur = byId.get(id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}

/** Цена для витрины: 1 234,5 (ru-RU). */
export function formatPrice(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);
}

/** Символ валюты для витрины (прайсы почти всегда в рублях). */
export function currencySign(c?: string): string {
  if (!c || c.toUpperCase() === "RUB" || c === "₽" || c.toLowerCase() === "руб")
    return "₽";
  return c;
}
