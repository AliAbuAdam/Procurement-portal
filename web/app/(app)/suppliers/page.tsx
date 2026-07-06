"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { LoadingState } from "@/components/loading-state";
import {
  SuppliersTable,
  type SupplierRow as Supplier,
} from "@/components/suppliers-table";
import {
  SupplierFormFields,
  emptySupplierForm,
  supplierTypeToForm,
  type SupplierFormValues,
} from "@/components/supplier-form-fields";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function SuppliersPage() {
  const { user } = useSession();
  const isAdmin = user?.role === "admin";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState<SupplierFormValues>(emptySupplierForm);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<Supplier | null>(null);
  const [editForm, setEditForm] =
    useState<SupplierFormValues>(emptySupplierForm);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ suppliers?: Supplier[] }>(
        "/api/v1/suppliers",
      );
      setSuppliers(data.suppliers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/v1/suppliers", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptySupplierForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s: Supplier) {
    setEditing(s);
    setEditForm({
      name: s.name,
      type: supplierTypeToForm(s.type),
      city: s.city ?? "",
      address: s.address ?? "",
      logo: s.logo ?? "",
      status: s.status ?? "new",
    });
  }

  async function onDelete() {
    if (!editing) return;
    if (!window.confirm(`Удалить поставщика «${editing.name}»?`)) return;
    setDeleting(true);
    setError("");
    try {
      await apiFetch(`/api/v1/suppliers/${editing.id}`, { method: "DELETE" });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setDeleting(false);
    }
  }

  async function onSaveEdit() {
    if (!editing) return;
    setEditSaving(true);
    setError("");
    try {
      await apiFetch(`/api/v1/suppliers/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <h1 className="text-2xl font-semibold">Поставщики</h1>

      {isAdmin && (
        <form
          onSubmit={onCreate}
          className="flex flex-col gap-4 rounded-lg border border-[var(--border)] p-4"
        >
          <SupplierFormFields
            idPrefix="add"
            values={form}
            onChange={(p) => setForm((f) => ({ ...f, ...p }))}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Сохранение…" : "Добавить поставщика"}
            </Button>
          </div>
        </form>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      {loading ? (
        <LoadingState text="Загрузка поставщиков…" />
      ) : (
        <SuppliersTable
          suppliers={suppliers}
          onEdit={isAdmin ? startEdit : undefined}
        />
      )}

      {/* Панель редактирования поставщика */}
      <Sheet
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-[35rem]">
          <SheetHeader>
            <SheetTitle>Изменить поставщика</SheetTitle>
            <SheetDescription>{editing?.name}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 p-4">
            <SupplierFormFields
              idPrefix="edit"
              vertical
              logoPlaceholder="initials"
              values={editForm}
              onChange={(p) => setEditForm((f) => ({ ...f, ...p }))}
            />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                disabled={deleting || editSaving}
                aria-label="Удалить поставщика"
                title="Удалить поставщика"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          <SheetFooter>
            <Button onClick={onSaveEdit} disabled={editSaving || deleting}>
              {editSaving ? "Сохранение…" : "Сохранить"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Отмена
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
