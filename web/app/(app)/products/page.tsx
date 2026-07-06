"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { LoadingState } from "@/components/loading-state";
import { ProductsGrid } from "@/components/products-grid";
import { ProductsTable, type ProductRow } from "@/components/products-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ViewMode = "cards" | "table";

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewMode>("cards");

  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const path = q.trim()
        ? `/api/v1/products?q=${encodeURIComponent(q.trim())}`
        : "/api/v1/products";
      const data = await apiFetch<{ products?: ProductRow[] }>(path);
      setProducts(data.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  // Живой поиск: ищем по мере ввода с задержкой (debounce), а не по кнопке.
  // Срабатывает и на монтировании (query === "" → все карточки).
  useEffect(() => {
    const t = setTimeout(() => {
      load(query);
    }, 300);
    return () => clearTimeout(t);
  }, [query, load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/v1/products", {
        method: "POST",
        body: JSON.stringify({ name, article, image_url: imageUrl }),
      });
      setName("");
      setArticle("");
      setImageUrl("");
      await load(query);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <h1 className="text-2xl font-semibold">Номенклатуры</h1>
      <p className="text-[var(--muted-foreground)] text-sm">
        Единые карточки товаров, к которым сопоставляются строки прайсов
        поставщиков.
      </p>

      <form
        onSubmit={onCreate}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] p-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Название</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Напр. Саморез 4×30 оцинкованный"
            className="w-64"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="article">Артикул</Label>
          <Input
            id="article"
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            placeholder="необязательно"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="image_url">Фото (URL)</Label>
          <Input
            id="image_url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://… (загрузка в S3 — позже)"
            className="w-72"
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Сохранение…" : "Добавить карточку"}
        </Button>
      </form>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-1 items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="search">Поиск по названию</Label>
            <Input
              id="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="начните вводить название…"
            />
          </div>
          {query && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setQuery("")}
            >
              Сбросить
            </Button>
          )}
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(v) => v && setView(v as ViewMode)}
        >
          <ToggleGroupItem value="cards" aria-label="Карточки">
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Таблица">
            <List className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {loading ? (
        <LoadingState text="Загрузка номенклатуры…" />
      ) : products.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          {query ? "Ничего не найдено." : "Карточек пока нет."}
        </p>
      ) : view === "cards" ? (
        <ProductsGrid products={products} />
      ) : (
        <ProductsTable products={products} />
      )}
    </div>
  );
}
