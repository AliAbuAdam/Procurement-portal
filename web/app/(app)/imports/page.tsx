"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  FileSpreadsheet,
  GitCompareArrows,
  Globe,
  Plug,
  UploadCloud,
} from "lucide-react";

import { apiFetch, apiUpload } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BatchesTable, type BatchRow } from "@/components/batches-table";
import { OfferMatchCard } from "@/components/offer-match-card";
import { Badge } from "@/components/ui/badge";
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
  type: number;
}

// Типы поставщика (proto SupplierType): 1 — файлы Excel/CSV, 2 — API, 3 — парсинг.
const SUPPLIER_TYPE = { EXCEL: 1, API: 2, PARSING: 3 } as const;

const TYPE_META: Record<
  number,
  { label: string; className: string }
> = {
  1: { label: "Excel/CSV", className: "border-blue-200 bg-blue-50 text-blue-700" },
  2: { label: "API", className: "border-violet-200 bg-violet-50 text-violet-700" },
  3: { label: "Парсинг", className: "border-amber-200 bg-amber-50 text-amber-700" },
};

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

interface Offer {
  id: string;
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
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);

  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  // Разобранные строки, у которых раскрыта встроенная карточка сопоставления.
  const [openMatches, setOpenMatches] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSuppliers = useCallback(async () => {
    const d = await apiFetch<{ suppliers?: Supplier[] }>("/api/v1/suppliers");
    setSuppliers(d.suppliers ?? []);
  }, []);

  const loadBatches = useCallback(async () => {
    const d = await apiFetch<{ batches?: BatchRow[] }>("/api/v1/imports");
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
      const b = await apiUpload<BatchRow>("/api/v1/imports", form);
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
      setOpenMatches(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки строк");
    }
  }

  // Показать/скрыть карточку сопоставления у конкретной строки (toggle) —
  // связку можно как задать, так и позже изменить.
  function toggleMatch(offerId: string) {
    setOpenMatches((prev) => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  }

  // При смене поставщика сбрасываем незавершённую загрузку файла и предпросмотр —
  // способ прикрепления зависит от типа нового поставщика.
  function onSelectSupplier(id: string) {
    setSupplierId(id);
    setFile(null);
    setPreview(null);
    setMapping(null);
    setError("");
    setNotice("");
  }

  const selected = suppliers.find((s) => s.id === supplierId) ?? null;
  const selectedType = selected?.type;

  // Имя поставщика в батче резолвим на клиенте: список поставщиков уже загружен,
  // а бэкенд отдаёт в батче только supplier_id.
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
  const batchRows = batches
    // Поставщик не выбран — все загрузки; выбран — только его.
    .filter((b) => !supplierId || b.supplier_id === supplierId)
    .map((b) => ({
      ...b,
      supplier_name: supplierName.get(b.supplier_id),
    }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <h1 className="text-2xl font-semibold">Прайс-листы</h1>

      {/* Шаг 1: поставщик + файл */}
      <div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="supplier">Поставщик</Label>
          <div className="flex items-center gap-3">
            <select
              id="supplier"
              value={supplierId}
              onChange={(e) => onSelectSupplier(e.target.value)}
              className="h-9 w-full max-w-xs rounded-md border border-[var(--input)] bg-transparent px-3 text-sm"
            >
              <option value="">Не выбрано</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {selectedType !== undefined && TYPE_META[selectedType] && (
              <Badge
                variant="outline"
                className={cn("shrink-0", TYPE_META[selectedType].className)}
              >
                {TYPE_META[selectedType].label}
              </Badge>
            )}
          </div>
        </div>

        {/* Способ прикрепления прайса зависит от типа поставщика. */}
        {!selected ? (
          <p className="text-muted-foreground text-sm">
            Выберите поставщика, чтобы прикрепить прайс-лист.
          </p>
        ) : selectedType === SUPPLIER_TYPE.EXCEL ? (
          <>
            <div className="flex flex-col gap-2">
              <Label>Файл прайс-листа</Label>
              {/* Зона загрузки: клик или перетаскивание. Подсветка синей рамкой при drag. */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setFile(f);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors outline-none",
                  dragging
                    ? "border-blue-500 bg-blue-500/5"
                    : "border-[var(--border)] hover:border-blue-400 hover:bg-[var(--secondary)]",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv,.txt"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <>
                    <FileSpreadsheet className="size-7 text-blue-600" />
                    <div className="text-sm font-medium">{file.name}</div>
                    <div className="text-muted-foreground text-xs">
                      Нажмите или перетащите другой файл, чтобы заменить
                    </div>
                  </>
                ) : (
                  <>
                    <UploadCloud className="text-muted-foreground size-7" />
                    <div className="text-sm">
                      <span className="font-medium text-blue-600">
                        Нажмите, чтобы выбрать
                      </span>{" "}
                      или перетащите файл сюда
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Excel (.xlsx) или CSV
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <Button onClick={onPreview} disabled={!file || busy} variant="outline">
                Предпросмотр
              </Button>
            </div>
          </>
        ) : selectedType === SUPPLIER_TYPE.API ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-[var(--border)] p-6">
            <Plug className="size-6 shrink-0 text-violet-600" />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Поставщик подключается по API</span>
              <span className="text-muted-foreground">
                Прайс обновляется автоматически из API поставщика — файл прикреплять
                не нужно. Настройка подключения появится позже.
              </span>
            </div>
          </div>
        ) : selectedType === SUPPLIER_TYPE.PARSING ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-[var(--border)] p-6">
            <Globe className="size-6 shrink-0 text-amber-600" />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Прайс собирается парсингом сайта</span>
              <span className="text-muted-foreground">
                Цены подтягиваются автоматически с сайта поставщика — файл прикреплять
                не нужно. Настройка парсинга появится позже.
              </span>
            </div>
          </div>
        ) : null}
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
                <TableHead className="w-0 text-right">Сопоставление</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((o) => {
                const open = openMatches.has(o.id);
                return (
                  <Fragment key={o.id}>
                    <TableRow>
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
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant={open ? "secondary" : "ghost"}
                          className="size-8"
                          aria-label={open ? "Скрыть сопоставление" : "Сопоставить"}
                          title={open ? "Скрыть сопоставление" : "Сопоставить"}
                          aria-pressed={open}
                          onClick={() => toggleMatch(o.id)}
                        >
                          <GitCompareArrows className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-[var(--secondary)]/40">
                          <OfferMatchCard offerId={o.id} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* История загрузок */}
      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Загрузки</h2>
        <BatchesTable batches={batchRows} onOpen={openBatch} />
      </div>
    </div>
  );
}
