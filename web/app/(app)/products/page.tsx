"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Product {
  id: string;
  name: string;
  article: string;
  created_at: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const path = q.trim()
        ? `/api/v1/products?q=${encodeURIComponent(q.trim())}`
        : "/api/v1/products";
      const data = await apiFetch<{ products?: Product[] }>(path);
      setProducts(data.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await load(query);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/v1/products", {
        method: "POST",
        body: JSON.stringify({ name, article }),
      });
      setName("");
      setArticle("");
      await load(query);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <h1 className="text-2xl font-semibold">Номенклатура</h1>
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
        <Button type="submit" disabled={saving}>
          {saving ? "Сохранение…" : "Добавить карточку"}
        </Button>
      </form>

      <form onSubmit={onSearch} className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="search">Поиск по названию</Label>
          <Input
            id="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="начните вводить название…"
          />
        </div>
        <Button type="submit" variant="outline">
          Найти
        </Button>
        {query && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setQuery("");
              load("");
            }}
          >
            Сбросить
          </Button>
        )}
      </form>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {loading ? (
        <p className="text-[var(--muted-foreground)] text-sm">Загрузка…</p>
      ) : products.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          {query ? "Ничего не найдено." : "Карточек пока нет."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Артикул</TableHead>
              <TableHead>Создана</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.article || "—"}</TableCell>
                <TableCell className="text-[var(--muted-foreground)]">
                  {new Date(p.created_at).toLocaleString("ru-RU")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
