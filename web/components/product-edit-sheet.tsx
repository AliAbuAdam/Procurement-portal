"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import type { CategoryOption, ProductRow } from "@/components/products-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface ProductAttr {
  name: string;
  value: string;
}

interface Props {
  product: ProductRow | null;
  categories: CategoryOption[];
  onClose: () => void;
  // Вызывается после сохранения или удаления — родитель перечитывает список.
  onChanged: () => void;
}

const NO_CATEGORY = "none";

// Панель редактирования карточки: название, артикул, категория, описание,
// характеристики, флаг «скрыт с витрины» и удаление (с двухшаговым подтверждением).
export function ProductEditSheet({ product, categories, onClose, onChanged }: Props) {
  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [category, setCategory] = useState(NO_CATEGORY);
  const [description, setDescription] = useState("");
  const [attrs, setAttrs] = useState<ProductAttr[]>([]);
  const [archived, setArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setArticle(product.article ?? "");
    setCategory(product.category_id || NO_CATEGORY);
    setDescription(product.description ?? "");
    setAttrs(product.attrs ?? []);
    setArchived(product.archived ?? false);
    setConfirmDelete(false);
    setError("");
  }, [product]);

  function setAttr(i: number, patch: Partial<ProductAttr>) {
    setAttrs((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/v1/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          article,
          description,
          attrs: attrs.filter((a) => a.name.trim() || a.value.trim()),
          archived,
          category_id: category === NO_CATEGORY ? "" : category,
        }),
      });
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!product) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/v1/products/${product.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!product} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Редактирование карточки</SheetTitle>
          <SheetDescription className="line-clamp-2">
            {product?.name}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSave} className="flex flex-1 flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pe-name">Название</Label>
            <Input
              id="pe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pe-article">Артикул</Label>
            <Input
              id="pe-article"
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              placeholder="необязательно"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Категория</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>Без категории</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {" ".repeat(c.depth * 2)}
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pe-description">Описание</Label>
            <textarea
              id="pe-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="покажется на карточке товара в каталоге"
              className="rounded-md border border-[var(--input)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Характеристики</Label>
            {attrs.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={a.name}
                  onChange={(e) => setAttr(i, { name: e.target.value })}
                  placeholder="напр. Материал"
                  aria-label="Название характеристики"
                />
                <Input
                  value={a.value}
                  onChange={(e) => setAttr(i, { value: e.target.value })}
                  placeholder="напр. Сталь"
                  aria-label="Значение характеристики"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  aria-label="Удалить характеристику"
                  onClick={() => setAttrs((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setAttrs((prev) => [...prev, { name: "", value: "" }])}
            >
              <Plus className="size-4" /> Добавить характеристику
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={archived}
              onCheckedChange={(v) => setArchived(v === true)}
            />
            Скрыть с витрины (карточка и данные сохраняются)
          </label>

          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

          <div className="mt-auto flex flex-col gap-3 border-t border-[var(--border)] pt-4">
            <Button type="submit" disabled={busy}>
              {busy ? "Сохранение…" : "Сохранить"}
            </Button>
            <Button
              type="button"
              variant={confirmDelete ? "destructive" : "outline"}
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
              {confirmDelete
                ? "Точно удалить? Сопоставления и фото тоже удалятся"
                : "Удалить карточку"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
