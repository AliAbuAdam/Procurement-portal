"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
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

// В proto тип поставщика — enum (число). Маппим в подписи.
const TYPE_LABEL: Record<number, string> = {
  1: "Excel/CSV",
  2: "API",
  3: "Парсинг",
};

interface Supplier {
  id: string;
  name: string;
  type: number;
  created_at: string;
}

export default function SuppliersPage() {
  const { user } = useSession();
  const isAdmin = user?.role === "admin";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState("excel");
  const [saving, setSaving] = useState(false);

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
        body: JSON.stringify({ name, type }),
      });
      setName("");
      setType("excel");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Поставщики</h1>

      {isAdmin && (
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
              placeholder="Напр. Фурнитор"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="type">Тип</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 rounded-md border border-[var(--input)] bg-transparent px-3 text-sm"
            >
              <option value="excel">Excel/CSV</option>
              <option value="api">API</option>
              <option value="parsing">Парсинг</option>
            </select>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Сохранение…" : "Добавить"}
          </Button>
        </form>
      )}

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {loading ? (
        <p className="text-[var(--muted-foreground)] text-sm">Загрузка…</p>
      ) : suppliers.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          Поставщиков пока нет.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Создан</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{TYPE_LABEL[s.type] ?? "—"}</TableCell>
                <TableCell className="text-[var(--muted-foreground)]">
                  {new Date(s.created_at).toLocaleString("ru-RU")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
