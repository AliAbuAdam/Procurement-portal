"use client";

import { useCallback, useState } from "react";

import { apiFetch } from "@/lib/api";
import { LoadingState } from "@/components/loading-state";
import {
  PriceComparisonTable,
  type PriceOffer,
} from "@/components/price-comparison-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Product {
  id: string;
  name: string;
  article?: string;
}

interface Comparison {
  product_id: string;
  offers?: PriceOffer[];
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
        <LoadingState text="Нормализация данных" />
      ) : selected && cmp ? (
        (cmp.offers ?? []).length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm">
            «{selected.name}» ещё не сопоставлен ни с одним прайсом. Свяжите строки
            на странице «Сопоставление».
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="font-medium">{selected.name}</h2>
            <PriceComparisonTable offers={cmp.offers ?? []} />
          </div>
        )
      ) : null}
    </div>
  );
}
