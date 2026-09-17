"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Package, Search } from "lucide-react";

import { apiFetch, imageUrl } from "@/lib/api";
import { currencySign, formatPrice } from "@/lib/catalog";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

interface Supplier {
  id: string;
  name: string;
}

const PAGE_SIZE = 60;

const SORT_OPTIONS = [
  { value: "new", label: "Сначала новые" },
  { value: "name", label: "По алфавиту" },
  { value: "price_asc", label: "Сначала дешёвые" },
  { value: "price_desc", label: "Сначала дорогие" },
] as const;

const ALL_SUPPLIERS = "all";

// Числовое значение из поля цены («1 200,50» → 1200.5; мусор → 0).
function priceNum(s: string): number {
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
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

// Витрина: категории — в основном сайдбаре слева (выбранная приходит сюда
// через ?category=), здесь — поиск, фильтры, сортировка и карточки товаров
// с ценой «от X ₽». Список постраничный («Показать ещё»).
// useSearchParams требует Suspense-обёртку — поэтому контент вынесен.
export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 lg:px-6">
          <LoadingState text="Загрузка каталога…" />
        </div>
      }
    >
      <CatalogContent />
    </Suspense>
  );
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const selectedCat = searchParams.get("category");

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<string>("new");
  const [inStock, setInStock] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [supplier, setSupplier] = useState(ALL_SUPPLIERS);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // null — первый запрос ещё не завершился (единственный случай спиннера).
  const [products, setProducts] = useState<Product[] | null>(null);
  const [total, setTotal] = useState(0);
  // Сводки цен подъезжают отдельным запросом на каждую страницу и мержатся.
  const [prices, setPrices] = useState<Record<string, MinPrice>>({});
  const [pricesReady, setPricesReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ suppliers?: Supplier[] }>("/api/v1/suppliers")
      .then((d) => setSuppliers(d.suppliers ?? []))
      .catch(() => setSuppliers([]));
  }, []);

  // Сводки «от X ₽» для страницы товаров — мержем к уже загруженным.
  const fetchPrices = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setPricesReady(true);
      return;
    }
    try {
      const d = await apiFetch<{ prices?: MinPrice[] }>(
        "/api/v1/products/min-prices",
        {
          method: "POST",
          body: JSON.stringify({ product_ids: ids }),
        },
      );
      setPrices((prev) => ({
        ...prev,
        ...Object.fromEntries((d.prices ?? []).map((p) => [p.product_id, p])),
      }));
    } catch {
      // Сводки не критичны: карточки останутся без «от X ₽».
    } finally {
      setPricesReady(true);
    }
  }, []);

  const load = useCallback(
    async (offset: number) => {
      if (offset === 0) setRefreshing(true);
      else setLoadingMore(true);
      setError("");
      try {
        const params = new URLSearchParams({ page_size: String(PAGE_SIZE) });
        if (query.trim()) params.set("q", query.trim());
        if (selectedCat) params.set("category", selectedCat);
        if (sort !== "new") params.set("sort", sort);
        if (inStock) params.set("in_stock", "1");
        if (priceNum(priceMin) > 0) params.set("price_min", String(priceNum(priceMin)));
        if (priceNum(priceMax) > 0) params.set("price_max", String(priceNum(priceMax)));
        if (supplier !== ALL_SUPPLIERS) params.set("supplier", supplier);
        if (offset > 0) params.set("offset", String(offset));

        const data = await apiFetch<{ products?: Product[]; total?: number }>(
          `/api/v1/products?${params}`,
        );
        const page = data.products ?? [];
        setTotal(data.total ?? page.length);
        if (offset === 0) {
          setProducts(page);
          setPrices({});
          setPricesReady(false);
        } else {
          setProducts((prev) => [...(prev ?? []), ...page]);
        }
        // Карточки показываем сразу; сводки цен доезжают следом и не
        // блокируют отрисовку сетки.
        fetchPrices(page.map((p) => p.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки каталога");
      } finally {
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [query, selectedCat, sort, inStock, priceMin, priceMax, supplier, fetchPrices],
  );

  // Первый показ и смена категории/сортировки/фильтров — сразу; debounce
  // только на текстовых полях (поиск, цены), чтобы не дёргать API на каждую
  // букву.
  const prevTyped = useRef(`${query}|${priceMin}|${priceMax}`);
  useEffect(() => {
    const typed = `${query}|${priceMin}|${priceMax}`;
    const typedChanged = prevTyped.current !== typed;
    prevTyped.current = typed;
    if (typedChanged) {
      const t = setTimeout(() => load(0), 300);
      return () => clearTimeout(t);
    }
    load(0);
  }, [load, query, priceMin, priceMax]);

  const filtersActive =
    inStock || priceNum(priceMin) > 0 || priceNum(priceMax) > 0 ||
    supplier !== ALL_SUPPLIERS || sort !== "new";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 lg:px-6">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Искать по названию или артикулу…"
          className="pl-9"
          aria-label="Поиск товаров"
        />
      </div>

      {/* Панель фильтров и сортировки */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger size="sm" className="w-44" aria-label="Сортировка">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger size="sm" className="w-44" aria-label="Поставщик">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SUPPLIERS}>Все поставщики</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
          <span>Цена</span>
          <Input
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="от"
            inputMode="decimal"
            className="h-8 w-20"
            aria-label="Цена от"
          />
          <span>—</span>
          <Input
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="до"
            inputMode="decimal"
            className="h-8 w-20"
            aria-label="Цена до"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={inStock}
            onCheckedChange={(v) => setInStock(v === true)}
          />
          В наличии
        </label>

        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSort("new");
              setSupplier(ALL_SUPPLIERS);
              setPriceMin("");
              setPriceMax("");
              setInStock(false);
            }}
          >
            Сбросить
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {products === null ? (
        <LoadingState text="Загрузка каталога…" />
      ) : products.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
          {query || selectedCat || filtersActive
            ? "Ничего не найдено. Попробуйте изменить запрос или фильтры."
            : "Товаров пока нет."}
        </p>
      ) : (
        <>
          <p className="text-xs text-[var(--muted-foreground)]">
            {products.length < total
              ? `Показано ${products.length} из ${total}`
              : `Найдено товаров: ${total}`}
          </p>
          <div
            className={cn(
              "grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
              refreshing && "opacity-60",
            )}
          >
            {products.map((p) => {
              const src = coverSrc(p);
              const mp = prices[p.id];
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
                        {p.article ? `Арт. ${p.article}` : " "}
                      </span>
                      <div className="mt-auto flex items-baseline justify-between gap-2 pt-1">
                        {!pricesReady && !mp ? (
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

          {products.length < total && (
            <div className="flex justify-center py-2">
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={() => load(products.length)}
              >
                {loadingMore ? "Загрузка…" : "Показать ещё"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
