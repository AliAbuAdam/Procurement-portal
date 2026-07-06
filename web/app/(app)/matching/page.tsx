"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Batch {
  id: string;
  file_name: string;
  created_at: string;
}

interface UnmatchedOffer {
  offer_id: string;
  row_num?: number;
  raw_name: string;
  raw_article?: string;
  price?: number;
  currency?: string;
}

interface Candidate {
  product_id: string;
  product_name: string;
  product_article?: string;
  score?: number;
}

const pct = (s?: number) => `${Math.round((s ?? 0) * 100)}%`;

export default function MatchingPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");

  const [offers, setOffers] = useState<UnmatchedOffer[]>([]);
  const [candidates, setCandidates] = useState<Record<string, Candidate[]>>({});
  const [total, setTotal] = useState(0);
  const [matched, setMatched] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ batches?: Batch[] }>("/api/v1/imports")
      .then((d) => setBatches(d.batches ?? []))
      .catch(() => {});
  }, []);

  const loadBatch = useCallback(async (id: string) => {
    if (!id) {
      setOffers([]);
      setCandidates({});
      setTotal(0);
      setMatched(0);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const d = await apiFetch<{
        offers?: UnmatchedOffer[];
        total?: number;
        matched?: number;
      }>(`/api/v1/imports/${id}/unmatched`);
      const list = d.offers ?? [];
      setOffers(list);
      setTotal(d.total ?? 0);
      setMatched(d.matched ?? 0);

      if (list.length > 0) {
        const s = await apiFetch<{
          suggestions?: { offer_id: string; candidates?: Candidate[] }[];
        }>("/api/v1/matches/suggest", {
          method: "POST",
          body: JSON.stringify({ offer_ids: list.map((o) => o.offer_id) }),
        });
        const map: Record<string, Candidate[]> = {};
        for (const sg of s.suggestions ?? []) {
          map[sg.offer_id] = sg.candidates ?? [];
        }
        setCandidates(map);
      } else {
        setCandidates({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  function selectBatch(id: string) {
    setBatchId(id);
    loadBatch(id);
  }

  // Переход из «Прайс-листов» по иконке сопоставления: ?batch=<id> — сразу
  // открываем эту загрузку, не заставляя выбирать файл заново.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("batch");
    if (id) {
      setBatchId(id);
      loadBatch(id);
    }
  }, [loadBatch]);

  // После успешного сопоставления убираем строку и двигаем прогресс.
  const onDone = useCallback((offerId: string) => {
    setOffers((prev) => prev.filter((o) => o.offer_id !== offerId));
    setMatched((m) => m + 1);
  }, []);

  const progress = total > 0 ? Math.round((matched / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <h1 className="text-2xl font-semibold">Сопоставление</h1>
      <p className="text-[var(--muted-foreground)] text-sm">
        Привяжите строки прайса к карточкам номенклатуры. Кандидаты подобраны по
        похожести названия — подтвердите подходящий или создайте новую карточку.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="batch">Загрузка (импорт)</Label>
        <select
          id="batch"
          value={batchId}
          onChange={(e) => selectBatch(e.target.value)}
          className="h-9 max-w-md rounded-md border border-[var(--input)] bg-transparent px-3 text-sm"
        >
          <option value="">— выберите загрузку —</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.file_name} · {new Date(b.created_at).toLocaleDateString("ru-RU")}
            </option>
          ))}
        </select>
      </div>

      {batchId && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span>
              Сопоставлено {matched} из {total}
            </span>
            <span className="text-[var(--muted-foreground)]">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-[var(--secondary)]">
            <div
              className="h-full bg-green-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {loading ? (
        <LoadingState text="Подбор кандидатов…" />
      ) : batchId && offers.length === 0 ? (
        <p className="text-sm text-green-600">
          Все строки этой загрузки сопоставлены. 🎉
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {offers.map((o) => (
            <OfferRow
              key={o.offer_id}
              offer={o}
              candidates={candidates[o.offer_id] ?? []}
              onDone={onDone}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferRow({
  offer,
  candidates,
  onDone,
  onError,
}: {
  offer: UnmatchedOffer;
  candidates: Candidate[];
  onDone: (offerId: string) => void;
  onError: (msg: string) => void;
}) {
  const [selected, setSelected] = useState(candidates[0]?.product_id ?? "");
  const [busy, setBusy] = useState(false);

  // Ручной поиск карточки, если среди кандидатов нет подходящей.
  const [manualOpen, setManualOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);

  async function confirm(productId: string) {
    if (!productId) return;
    setBusy(true);
    onError("");
    try {
      await apiFetch("/api/v1/matches", {
        method: "POST",
        body: JSON.stringify({ offer_id: offer.offer_id, product_id: productId }),
      });
      onDone(offer.offer_id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось подтвердить");
      setBusy(false);
    }
  }

  async function createFromOffer() {
    setBusy(true);
    onError("");
    try {
      await apiFetch("/api/v1/matches/from-offer", {
        method: "POST",
        body: JSON.stringify({ offer_id: offer.offer_id }),
      });
      onDone(offer.offer_id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось создать карточку");
      setBusy(false);
    }
  }

  async function search(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    try {
      const d = await apiFetch<{
        products?: { id: string; name: string; article?: string }[];
      }>(`/api/v1/products?q=${encodeURIComponent(q.trim())}`);
      setResults(
        (d.products ?? []).map((p) => ({
          product_id: p.id,
          product_name: p.name,
          product_article: p.article,
        })),
      );
    } catch {
      setResults([]);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{offer.raw_name}</span>
        {offer.raw_article && (
          <span className="text-[var(--muted-foreground)] text-sm">
            арт. {offer.raw_article}
          </span>
        )}
        {offer.price !== undefined && (
          <span className="text-[var(--muted-foreground)] text-sm">
            {offer.price} {offer.currency ?? ""}
          </span>
        )}
      </div>

      {candidates.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label>Карточка-кандидат</Label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-9 rounded-md border border-[var(--input)] bg-transparent px-3 text-sm"
              disabled={busy}
            >
              {candidates.map((c) => (
                <option key={c.product_id} value={c.product_id}>
                  {c.product_name}
                  {c.product_article ? ` (${c.product_article})` : ""} —{" "}
                  {pct(c.score)}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => confirm(selected)} disabled={busy || !selected}>
            {busy ? "…" : "Подтвердить"}
          </Button>
        </div>
      ) : (
        <p className="text-[var(--muted-foreground)] text-sm">
          Похожих карточек не найдено.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="outline" size="sm" onClick={createFromOffer} disabled={busy}>
          Создать карточку из строки
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setManualOpen((v) => !v)}
          disabled={busy}
        >
          {manualOpen ? "Скрыть поиск" : "Искать карточку вручную"}
        </Button>
      </div>

      {manualOpen && (
        <div className="flex flex-col gap-2 rounded-md bg-[var(--secondary)] p-3">
          <Input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="название карточки…"
          />
          {results.length > 0 && (
            <div className="flex flex-col gap-1">
              {results.map((r) => (
                <button
                  key={r.product_id}
                  type="button"
                  onClick={() => confirm(r.product_id)}
                  disabled={busy}
                  className="flex justify-between rounded px-2 py-1 text-left text-sm hover:bg-[var(--background)]"
                >
                  <span>
                    {r.product_name}
                    {r.product_article ? ` (${r.product_article})` : ""}
                  </span>
                  <span className="text-[var(--muted-foreground)]">выбрать</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
