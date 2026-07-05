"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch, apiUpload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Supplier {
  id: string;
  name: string;
}

interface Mapping {
  name_col: number;
  article_col: number;
  price_col: number;
  stock_col: number;
  currency_col: number;
}

interface Preview {
  headers: string[];
  rows: { cells: string[] }[];
  suggested?: Partial<Mapping>;
  total_rows?: number;
}

interface Batch {
  id: string;
  file_name: string;
  rows_total: number;
  created_by: string;
  created_at: string;
}

interface Offer {
  row_num: number;
  raw_name: string;
  raw_article: string;
  price: number;
  currency: string;
  in_stock?: boolean;
  stock_qty?: number;
}

// В proto нулевой индекс не сериализуется — undefined трактуем как 0.
const col = (v?: number) => (v === undefined ? 0 : v);

const FIELDS: { key: keyof Mapping; label: string; required?: boolean }[] = [
  { key: "name_col", label: "Название", required: true },
  { key: "article_col", label: "Артикул" },
  { key: "price_col", label: "Цена" },
  { key: "stock_col", label: "Наличие / остаток" },
  { key: "currency_col", label: "Валюта" },
];

export default function ImportsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [offers, setOffers] = useState<Offer[] | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSuppliers = useCallback(async () => {
    const d = await apiFetch<{ suppliers?: Supplier[] }>("/api/v1/suppliers");
    setSuppliers(d.suppliers ?? []);
  }, []);

  const loadBatches = useCallback(async () => {
    const d = await apiFetch<{ batches?: Batch[] }>("/api/v1/imports");
    setBatches(d.batches ?? []);
  }, []);

  useEffect(() => {
    loadSuppliers().catch(() => {});
    loadBatches().catch(() => {});
  }, [loadSuppliers, loadBatches]);

  async function onPreview() {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    setOffers(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const p = await apiUpload<Preview>("/api/v1/imports/preview", form);
      setPreview(p);
      const s = p.suggested ?? {};
      setMapping({
        name_col: col(s.name_col),
        article_col: col(s.article_col),
        price_col: col(s.price_col),
        stock_col: col(s.stock_col),
        currency_col: col(s.currency_col),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка предпросмотра");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (!file || !mapping || !supplierId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("supplier_id", supplierId);
      form.append("mapping", JSON.stringify(mapping));
      const b = await apiUpload<Batch>("/api/v1/imports", form);
      setNotice(`Импортировано строк: ${b.rows_total}`);
      setPreview(null);
      setMapping(null);
      setFile(null);
      await loadBatches();
      await openBatch(b.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка импорта");
    } finally {
      setBusy(false);
    }
  }

  async function openBatch(id: string) {
    try {
      const d = await apiFetch<{ offers?: Offer[] }>(
        `/api/v1/imports/${id}/offers`,
      );
      setOffers(d.offers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки строк");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <h1 className="text-2xl font-semibold">Прайс-листы</h1>

      {/* Шаг 1: поставщик + файл */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="supplier">Поставщик</Label>
          <select
            id="supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="h-9 rounded-md border border-[var(--input)] bg-transparent px-3 text-sm"
          >
            <option value="">— выберите —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="file">Файл (.xlsx / .csv)</Label>
          <input
            id="file"
            type="file"
            accept=".xlsx,.csv,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
        <Button onClick={onPreview} disabled={!file || busy} variant="outline">
          Предпросмотр
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      {notice && <p className="text-sm text-green-600">{notice}</p>}

      {/* Шаг 2: маппинг колонок + предпросмотр */}
      {preview && mapping && (
        <div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] p-4">
          <div>
            <h2 className="font-medium">Сопоставьте колонки</h2>
            <p className="text-[var(--muted-foreground)] text-sm">
              Всего строк в файле: {preview.total_rows ?? 0}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <Label>
                  {f.label}
                  {f.required && <span className="text-[var(--destructive)]"> *</span>}
                </Label>
                <select
                  value={mapping[f.key]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [f.key]: Number(e.target.value) })
                  }
                  className="h-9 rounded-md border border-[var(--input)] bg-transparent px-3 text-sm"
                >
                  {!f.required && <option value={-1}>— не задано —</option>}
                  {preview.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {h || `Колонка ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.headers.map((h, i) => (
                    <TableHead key={i}>{h || `Колонка ${i + 1}`}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((r, i) => (
                  <TableRow key={i}>
                    {preview.headers.map((_, j) => (
                      <TableCell key={j}>{r.cells[j] ?? ""}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <Button onClick={onImport} disabled={busy || !supplierId}>
              {busy ? "Импорт…" : "Импортировать"}
            </Button>
            {!supplierId && (
              <span className="ml-3 text-sm text-[var(--muted-foreground)]">
                выберите поставщика выше
              </span>
            )}
          </div>
        </div>
      )}

      {/* Разобранные строки выбранного батча */}
      {offers && (
        <div className="flex flex-col gap-2">
          <h2 className="font-medium">Разобранные строки ({offers.length})</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead>Наличие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((o) => (
                <TableRow key={o.row_num}>
                  <TableCell className="text-[var(--muted-foreground)]">
                    {o.row_num}
                  </TableCell>
                  <TableCell className="font-medium">{o.raw_name}</TableCell>
                  <TableCell>{o.raw_article || "—"}</TableCell>
                  <TableCell>
                    {o.price} {o.currency}
                  </TableCell>
                  <TableCell>
                    {o.in_stock ? `в наличии${o.stock_qty ? ` (${o.stock_qty})` : ""}` : "нет"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* История загрузок */}
      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Загрузки</h2>
        {batches.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm">Пока нет загрузок.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Файл</TableHead>
                <TableHead>Строк</TableHead>
                <TableHead>Кто</TableHead>
                <TableHead>Когда</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.file_name}</TableCell>
                  <TableCell>{b.rows_total}</TableCell>
                  <TableCell className="text-[var(--muted-foreground)]">
                    {b.created_by}
                  </TableCell>
                  <TableCell className="text-[var(--muted-foreground)]">
                    {new Date(b.created_at).toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openBatch(b.id)}>
                      Строки
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
