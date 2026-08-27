"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";

import { apiFetch } from "@/lib/api";
import {
  buildCategoryTree,
  flattenTree,
  type Category,
  type CategoryNode,
} from "@/lib/catalog";
import { LoadingState } from "@/components/loading-state";
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

const NO_PARENT = "root";
const NOT_MAPPED = "none";

interface SupplierCategory {
  supplier_id: string;
  supplier_name: string;
  raw_category: string;
  offers_count?: number;
  category_id?: string;
}

// Управление деревом категорий витрины: создание, переименование, перенос,
// удаление. Товары к категориям привязываются на странице «Номенклатуры».
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorized, setUncategorized] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState(NO_PARENT);
  const [saving, setSaving] = useState(false);

  // Редактируемый узел: id + черновики имени и родителя.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParent, setEditParent] = useState(NO_PARENT);

  const [supplierCats, setSupplierCats] = useState<SupplierCategory[]>([]);
  const [applying, setApplying] = useState(false);
  const [applyNotice, setApplyNotice] = useState("");

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [d, sc] = await Promise.all([
        apiFetch<{ categories?: Category[]; uncategorized_count?: number }>(
          "/api/v1/categories",
        ),
        apiFetch<{ items?: SupplierCategory[] }>("/api/v1/supplier-categories"),
      ]);
      setCategories(d.categories ?? []);
      setUncategorized(d.uncategorized_count ?? 0);
      setSupplierCats(sc.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки категорий");
    } finally {
      setLoading(false);
    }
  }, []);

  // Привязка категории поставщика: categoryID "" — снять, create — создать
  // одноимённую свою и привязать.
  const mapSupplierCat = useCallback(
    async (sc: SupplierCategory, categoryID: string, create = false) => {
      setError("");
      try {
        await apiFetch("/api/v1/supplier-categories", {
          method: "PUT",
          body: JSON.stringify({
            supplier_id: sc.supplier_id,
            raw_category: sc.raw_category,
            category_id: categoryID,
            create_category: create,
          }),
        });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось сохранить привязку");
      }
    },
    [load],
  );

  async function onApplyMappings() {
    setApplying(true);
    setError("");
    setApplyNotice("");
    try {
      const d = await apiFetch<{ updated?: number }>(
        "/api/v1/supplier-categories/apply",
        { method: "POST", body: "{}" },
      );
      setApplyNotice(
        `Готово: категория проставлена ${d.updated ?? 0} товарам (товары с уже назначенной категорией не менялись).`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось применить привязки");
    } finally {
      setApplying(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/v1/categories", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          parent_id: newParent === NO_PARENT ? "" : newParent,
        }),
      });
      setNewName("");
      setNewParent(NO_PARENT);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать категорию");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: CategoryNode) {
    setEditId(c.id);
    setEditName(c.name);
    setEditParent(c.parent_id || NO_PARENT);
    setError("");
  }

  async function onSaveEdit() {
    if (!editId) return;
    setError("");
    try {
      await apiFetch(`/api/v1/categories/${editId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName,
          parent_id: editParent === NO_PARENT ? "" : editParent,
        }),
      });
      setEditId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  }

  async function onDelete(c: CategoryNode) {
    const warn =
      c.children.length > 0
        ? ` Подкатегории (${c.children.length}) тоже будут удалены.`
        : "";
    if (
      !window.confirm(
        `Удалить категорию «${c.name}»?${warn} Товары останутся без категории.`,
      )
    )
      return;
    setError("");
    try {
      await apiFetch(`/api/v1/categories/${c.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
    }
  }

  // Ряд дерева; при editId === node.id — режим редактирования.
  function renderNode(node: CategoryNode, depth: number): React.ReactNode {
    const isEdit = editId === node.id;
    return (
      <div key={node.id} className="flex flex-col">
        <div
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--secondary)]"
          style={{ paddingLeft: 8 + depth * 20 }}
        >
          {node.children.length > 0 ? (
            <ChevronRight className="size-3.5 rotate-90 text-[var(--muted-foreground)]" />
          ) : (
            <span className="size-3.5" />
          )}
          {isEdit ? (
            <>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 w-56"
                autoFocus
              />
              <Select value={editParent} onValueChange={setEditParent}>
                <SelectTrigger className="h-8 w-52" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>Корневая категория</SelectItem>
                  {flat
                    .filter((c) => c.id !== node.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {" ".repeat(c.depth * 2)}
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button size="icon" className="size-8" onClick={onSaveEdit}>
                <Check className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => setEditId(null)}
              >
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm font-medium">{node.name}</span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {node.total_count > 0 && `${node.total_count} тов.`}
              </span>
              <span className="ml-auto flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Изменить"
                  onClick={() => startEdit(node)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-[var(--destructive)]"
                  aria-label="Удалить"
                  onClick={() => onDelete(node)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </>
          )}
        </div>
        {node.children.map((ch) => renderNode(ch, depth + 1))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <h1 className="text-2xl font-semibold">Категории каталога</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Дерево категорий витрины. Товары привязываются к категориям на странице
        «Номенклатуры»; на витрине фильтр по категории включает все её
        подкатегории.
      </p>

      <form
        onSubmit={onCreate}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] p-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="cat-name">Название</Label>
          <Input
            id="cat-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Напр. Мебельная фурнитура"
            className="w-64"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Родительская категория</Label>
          <Select value={newParent} onValueChange={setNewParent}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>Корневая категория</SelectItem>
              {flat.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {" ".repeat(c.depth * 2)}
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={saving}>
          <Plus className="size-4" />
          {saving ? "Создание…" : "Добавить"}
        </Button>
      </form>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {loading ? (
        <LoadingState text="Загрузка категорий…" />
      ) : tree.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Категорий пока нет — создайте первую.
        </p>
      ) : (
        <div className="rounded-lg border border-[var(--border)] p-2">
          {tree.map((n) => renderNode(n, 0))}
        </div>
      )}

      {uncategorized > 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Товаров без категории: <b>{uncategorized}</b> — привяжите категории
          поставщиков ниже и нажмите «Разложить товары», либо назначьте вручную
          на странице «Номенклатуры» (вид «Таблица», колонка «Категория»).
        </p>
      )}

      {/* Категории поставщиков: их текст из прайсов -> наши категории */}
      <div className="mt-2 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Категории поставщиков</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Категории из загруженных прайсов. Привяжите каждую к своей — новые
              карточки при сопоставлении будут попадать в нужную категорию
              автоматически.
            </p>
          </div>
          <Button
            onClick={onApplyMappings}
            disabled={applying || supplierCats.every((c) => !c.category_id)}
          >
            {applying ? "Раскладываем…" : "Разложить товары по привязкам"}
          </Button>
        </div>

        {applyNotice && <p className="text-sm text-green-700">{applyNotice}</p>}

        {supplierCats.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Пока пусто. Категории появятся после импорта прайса, в котором при
            загрузке указана колонка «Категория поставщика».
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)] text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Поставщик</th>
                  <th className="px-3 py-2 font-medium">Категория поставщика</th>
                  <th className="px-3 py-2 font-medium">Строк</th>
                  <th className="px-3 py-2 font-medium">Наша категория</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {supplierCats.map((sc) => (
                  <tr
                    key={`${sc.supplier_id}:${sc.raw_category}`}
                    className="border-t border-[var(--border)]"
                  >
                    <td className="px-3 py-2">{sc.supplier_name}</td>
                    <td className="px-3 py-2 font-medium">{sc.raw_category}</td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {sc.offers_count ?? 0}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={sc.category_id || NOT_MAPPED}
                        onValueChange={(v) =>
                          mapSupplierCat(sc, v === NOT_MAPPED ? "" : v)
                        }
                      >
                        <SelectTrigger size="sm" className="w-52">
                          <SelectValue placeholder="— не привязана —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NOT_MAPPED}>
                            — не привязана —
                          </SelectItem>
                          {flat.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {" ".repeat(c.depth * 2)}
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      {!sc.category_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => mapSupplierCat(sc, "", true)}
                        >
                          Создать одноимённую
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
