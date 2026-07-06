"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Candidate {
  product_id: string;
  product_name: string;
  product_article?: string;
  score?: number;
}

const pct = (s?: number) => `${Math.round((s ?? 0) * 100)}%`;

// Встроенная карточка сопоставления одной разобранной строки прайса.
// Кандидатов подбирает сама при монтировании (по offerId). Подтверждение —
// upsert на бэкенде (ON CONFLICT), поэтому связку можно менять повторно.
export function OfferMatchCard({ offerId }: { offerId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [matchedName, setMatchedName] = useState<string | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    apiFetch<{ suggestions?: { offer_id: string; candidates?: Candidate[] }[] }>(
      "/api/v1/matches/suggest",
      { method: "POST", body: JSON.stringify({ offer_ids: [offerId] }) },
    )
      .then((s) => {
        if (!alive) return;
        const c = s.suggestions?.[0]?.candidates ?? [];
        setCandidates(c);
        setSelected(c[0]?.product_id ?? "");
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Ошибка подбора");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [offerId]);

  async function confirm(productId: string, label: string) {
    if (!productId) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/v1/matches", {
        method: "POST",
        body: JSON.stringify({ offer_id: offerId, product_id: productId }),
      });
      setMatchedName(label);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось подтвердить");
    } finally {
      setBusy(false);
    }
  }

  async function createFromOffer() {
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/v1/matches/from-offer", {
        method: "POST",
        body: JSON.stringify({ offer_id: offerId }),
      });
      setMatchedName("новая карточка");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать карточку");
    } finally {
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

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Подбор кандидатов…</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {matchedName && (
        <p className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="size-4" />
          Сопоставлено с «{matchedName}». Можно изменить ниже.
        </p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}

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
          <Button
            onClick={() => {
              const c = candidates.find((x) => x.product_id === selected);
              confirm(selected, c?.product_name ?? "");
            }}
            disabled={busy || !selected}
          >
            {busy ? "…" : "Подтвердить"}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Похожих карточек не найдено.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={createFromOffer}
          disabled={busy}
        >
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
                  onClick={() => confirm(r.product_id, r.product_name)}
                  disabled={busy}
                  className="flex justify-between rounded px-2 py-1 text-left text-sm hover:bg-[var(--background)]"
                >
                  <span>
                    {r.product_name}
                    {r.product_article ? ` (${r.product_article})` : ""}
                  </span>
                  <span className="text-muted-foreground">выбрать</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
