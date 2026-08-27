"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, LayoutGrid, List } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { buildCategoryTree, flattenTree, type Category } from "@/lib/catalog";
import { compressImage } from "@/lib/image";
import { LoadingState } from "@/components/loading-state";
import {
  MAX_IMAGES,
  ProductImagesSheet,
} from "@/components/product-images-sheet";
import { ProductsGrid } from "@/components/products-grid";
import { ProductsTable, type ProductRow } from "@/components/products-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ViewMode = "cards" | "table";

const NO_CATEGORY = "none";

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewMode>("cards");

  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [category, setCategory] = useState(NO_CATEGORY);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Карточка, чья галерея открыта в боковой панели.
  const [imagesFor, setImagesFor] = useState<ProductRow | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const flatCategories = useMemo(
    () => flattenTree(buildCategoryTree(categories)),
    [categories],
  );

  useEffect(() => {
    apiFetch<{ categories?: Category[] }>("/api/v1/categories")
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

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
      const created = await apiFetch<{ id: string }>("/api/v1/products", {
        method: "POST",
        body: JSON.stringify({
          name,
          article,
          category_id: category === NO_CATEGORY ? "" : category,
        }),
      });
      // Фото грузим после создания карточки: сжимаем на клиенте и шлём по одному.
      for (const f of files.slice(0, MAX_IMAGES)) {
        const img = await compressImage(f);
        await apiFetch(`/api/v1/products/${created.id}/images`, {
          method: "POST",
          body: JSON.stringify({
            content_type: img.contentType,
            data_base64: img.dataBase64,
            thumb_base64: img.thumbBase64,
          }),
        });
      }
      setName("");
      setArticle("");
      setCategory(NO_CATEGORY);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
          <Label>Категория</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>Без категории</SelectItem>
              {flatCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {" ".repeat(c.depth * 2)}
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Фото (до {MAX_IMAGES} шт.)</Label>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            {files.length > 0 ? `Выбрано: ${files.length}` : "Выбрать файлы"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) =>
              setFiles(Array.from(e.target.files ?? []).slice(0, MAX_IMAGES))
            }
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
        <ProductsGrid products={products} onManageImages={setImagesFor} />
      ) : (
        <ProductsTable
          products={products}
          categories={flatCategories}
          onManageImages={setImagesFor}
          onSetCategory={async (p, categoryID) => {
            try {
              await apiFetch("/api/v1/products/category", {
                method: "PUT",
                body: JSON.stringify({
                  product_ids: [p.id],
                  category_id: categoryID,
                }),
              });
              await load(query);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Не удалось назначить категорию",
              );
            }
          }}
        />
      )}

      <ProductImagesSheet
        product={imagesFor}
        onClose={() => setImagesFor(null)}
        onChanged={() => load(query)}
      />
    </div>
  );
}
