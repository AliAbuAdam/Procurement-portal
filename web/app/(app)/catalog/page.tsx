"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Package, Search } from "lucide-react";

import { apiFetch, imageUrl } from "@/lib/api";
import {
  buildCategoryTree,
  currencySign,
  flattenTree,
  formatPrice,
  type Category,
} from "@/lib/catalog";
import { CategoryTree, UNCATEGORIZED } from "@/components/category-tree";
import { LoadingState } from "@/components/loading-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  article?: string;
  image_url?: string;
  cover_image_id?: string;
  category_id?: string;
}

interface MinPrice {
  product_id: string;
  min_price?: number;
  currency?: string;
  supplier_count?: number;
  in_stock?: boolean;
}

function coverSrc(p: Product): string | undefined {
  if (p.cover_image_id) return imageUrl(p.cover_image_id, true);
  return p.image_url || undefined;
}

function suppliersLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} поставщик`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return `${n} поставщика`;
  return `${n} поставщиков`;
}

// Витрина: слева дерево категорий, справа карточки товаров с ценой «от X ₽»,
// как в интернет-магазине. Клик по карточке — страница товара с ценами
// всех поставщиков.
export default function CatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorized, setUncategorized] = useState(0);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // null — первый запрос ещё не завершился (единственный случай спиннера).
  const [products, setProducts] = useState<Product[] | null>(null);
  // null — сводки цен текущей выборки ещё в пути (на карточках «…»).
  const [prices, setPrices] = useState<Record<string, MinPrice> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flat = useMemo(() => flattenTree(tree), [tree]);
  // «Все товары» = разложенные по категориям + неразложенные.
  const totalAll = useMemo(
    () => tree.reduce((acc, n) => acc + n.total_count, 0) + uncategorized,
    [tree, uncategorized],
  );

  useEffect(() => {
    apiFetch<{ categories?: Category[]; uncategorized_count?: number }>(
      "/api/v1/categories",
    )
      .then((d) => {
        setCategories(d.categories ?? []);
        setUncategorized(d.uncategorized_count ?? 0);
      })
      .catch(() => setCategories([]));
    // Переход из хлебных крошек карточки: /catalog?category=<id>.
    // window.location вместо useSearchParams — не тянем Suspense-обвязку.
    const c = new URLSearchParams(window.location.search).get("category");
    if (c) setSelectedCat(c);
  }, []);

  const load = useCallback(async (q: string, cat: string | null) => {
    setRefreshing(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (cat) params.set("category", cat);
      const qs = params.toString();
      const data = await apiFetch<{ products?: Product[] }>(
        `/api/v1/products${qs ? `?${qs}` : ""}`,
      );
      const list = data.products ?? [];
      // Карточки показываем сразу; сводки «от X ₽» доезжают следом
      // отдельным запросом и не блокируют отрисовку сетки.
      setProducts(list);
      setPrices(list.length > 0 ? null : {});
      if (list.length > 0) {
        apiFetch<{ prices?: MinPrice[] }>("/api/v1/products/min-prices", {
          method: "POST",
          body: JSON.stringify({ product_ids: list.map((p) => p.id) }),
        })
          .then((d) =>
            setPrices(
              Object.fromEntries(
                (d.prices ?? []).map((p) => [p.product_id, p]),
              ),
            ),
          )
          .catch(() => setPrices({}));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки каталога");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Первый показ и смена категории — сразу; debounce только при наборе
  // текста в поиске, чтобы не дёргать API на каждую букву.
  const prevQuery = useRef(query);
  useEffect(() => {
    const queryChanged = prevQuery.current !== query;
    prevQuery.current = query;
    if (queryChanged) {
      const t = setTimeout(() => load(query, selectedCat), 300);
      return () => clearTimeout(t);
    }
    load(query, selectedCat);
  }, [query, selectedCat, load]);

  return (
    <div className="flex gap-6 px-4 lg:px-6">
      {/* Дерево категорий — как в интернет-магазине */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-16 flex flex-col gap-2">
          <h2 className="px-2 text-sm font-semibold">Каталог</h2>
          <CategoryTree
            nodes={tree}
            totalAll={totalAll}
            uncategorized={uncategorized}
            selectedId={selectedCat}
            onSelect={setSelectedCat}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Искать товары…"
              className="pl-9"
              aria-label="Поиск товаров"
            />
          </div>
          {/* Категории на мобильных — выпадающий список вместо дерева */}
          <div className="lg:hidden">
            <Select
              value={selectedCat ?? "all"}
              onValueChange={(v) => setSelectedCat(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Категория" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все товары</SelectItem>
                {flat.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {" ".repeat(c.depth * 2)}
                    {c.name}
                  </SelectItem>
                ))}
                {uncategorized > 0 && (
                  <SelectItem value={UNCATEGORIZED}>
                    Без категории ({uncategorized})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

        {products === null ? (
          <LoadingState text="Загрузка каталога…" />
        ) : products.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
            {query || selectedCat
              ? "Ничего не найдено. Попробуйте другой запрос или категорию."
              : "Товаров пока нет."}
          </p>
        ) : (
          <>
            <p className="text-xs text-[var(--muted-foreground)]">
              Найдено товаров: {products.length}
            </p>
            <div
              className={cn(
                "grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
                refreshing && "opacity-60",
              )}
            >
              {products.map((p) => {
                const src = coverSrc(p);
                const mp = prices?.[p.id];
                return (
                  <Link key={p.id} href={`/catalog/${p.id}`} className="group">
                    <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
                      <div className="bg-muted relative flex aspect-square items-center justify-center overflow-hidden">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            crossOrigin="use-credentials"
                            alt={p.name}
                            className="size-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <Package className="text-muted-foreground size-10" />
                        )}
                        {mp?.in_stock && (
                          <span className="absolute top-2 left-2 rounded bg-green-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            в наличии
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1 px-3 py-3">
                        <span
                          className="line-clamp-2 text-sm leading-snug font-medium"
                          title={p.name}
                        >
                          {p.name}
                        </span>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {p.article ? `Арт. ${p.article}` : " "}
                        </span>
                        <div className="mt-auto flex items-baseline justify-between gap-2 pt-1">
                          {prices === null ? (
                            <span className="text-xs text-[var(--muted-foreground)]">
                              …
                            </span>
                          ) : mp && (mp.min_price ?? 0) > 0 ? (
                            <span className="text-base font-semibold">
                              от {formatPrice(mp.min_price ?? 0)}{" "}
                              {currencySign(mp.currency)}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--muted-foreground)]">
                              нет предложений
                            </span>
                          )}
                          {mp && (mp.supplier_count ?? 0) > 0 && (
                            <span className="text-[10px] whitespace-nowrap text-[var(--muted-foreground)]">
                              {suppliersLabel(mp.supplier_count ?? 0)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
