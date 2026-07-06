"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  article?: string;
}

interface Offer {
  supplier_id: string;
  supplier_name: string;
  price?: number;
  currency?: string;
  in_stock?: boolean;
  stock_qty?: number;
  updated_at?: string;
}

interface Comparison {
  product_id: string;
  offers?: Offer[];
  cheapest_supplier_id?: string;
}

export default function ComparePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cmp, setCmp] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    try {
      const d = await apiFetch<{ products?: Product[] }>(
        `/api/v1/products?q=${encodeURIComponent(q.trim())}`,
      );
      setResults(d.products ?? []);
    } catch {
      setResults([]);
    }
  }, []);

  async function pick(p: Product) {
    setSelected(p);
    setResults([]);
    setQuery(p.name);
    setLoading(true);
    setError("");
    setCmp(null);
    try {
      // Минимальная длительность, чтобы индикатор анализа был заметен.
      const [d] = await Promise.all([
        apiFetch<Comparison>(`/api/v1/products/${p.id}/prices`),
        new Promise((r) => setTimeout(r, 550)),
      ]);
      setCmp(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки цен");
    } finally {
      setLoading(false);
    }
  }

  // Сортируем по цене и берём минимум как базу для разницы в %.
  const offers = [...(cmp?.offers ?? [])].sort(
    (a, b) => (a.price ?? 0) - (b.price ?? 0),
  );
  const cheapestPrice = offers.length ? (offers[0].price ?? 0) : 0;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <h1 className="text-2xl font-semibold">Сравнение цен</h1>
      <p className="text-[var(--muted-foreground)] text-sm">
        Выберите товар — покажем цены всех поставщиков, у кого дешевле и на сколько.
      </p>

      <div className="relative flex max-w-xl flex-col gap-2">
        <Label htmlFor="product">Товар</Label>
        <Input
          id="product"
          value={query}
          onChange={(e) => {
            setSelected(null);
            setCmp(null);
            search(e.target.value);
          }}
          placeholder="начните вводить название карточки…"
          autoComplete="off"
        />
        {results.length > 0 && !selected && (
          <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--background)] shadow">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p)}
                className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-[var(--secondary)]"
              >
                <span>{p.name}</span>
                {p.article && (
                  <span className="text-[var(--muted-foreground)]">
                    {p.article}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin text-emerald-600" />
            Анализируем цены поставщиков…
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : selected && cmp ? (
        offers.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm">
            «{selected.name}» ещё не сопоставлен ни с одним прайсом. Свяжите строки
            на странице «Сопоставление».
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="font-medium">{selected.name}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Поставщик</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Разница</TableHead>
                  <TableHead>Наличие</TableHead>
                  <TableHead>Прайс от</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((o, i) => {
                  const price = o.price ?? 0;
                  const isCheapest = i === 0;
                  const diff =
                    cheapestPrice > 0
                      ? ((price - cheapestPrice) / cheapestPrice) * 100
                      : 0;
                  return (
                    <TableRow
                      key={o.supplier_id}
                      className={cn(isCheapest && "bg-green-600/10")}
                    >
                      <TableCell className="font-medium">
                        {o.supplier_name}
                        {isCheapest && (
                          <span className="ml-2 rounded bg-green-600/20 px-1.5 py-0.5 text-xs text-green-700">
                            дешевле всех
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {price} {o.currency ?? ""}
                      </TableCell>
                      <TableCell
                        className={cn(
                          isCheapest
                            ? "text-green-700"
                            : "text-[var(--muted-foreground)]",
                        )}
                      >
                        {isCheapest ? "—" : `+${diff.toFixed(1)}%`}
                      </TableCell>
                      <TableCell>
                        {o.in_stock
                          ? `в наличии${o.stock_qty ? ` (${o.stock_qty})` : ""}`
                          : "нет"}
                      </TableCell>
                      <TableCell className="text-[var(--muted-foreground)]">
                        {o.updated_at
                          ? new Date(o.updated_at).toLocaleDateString("ru-RU")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      ) : null}
    </div>
  );
}
