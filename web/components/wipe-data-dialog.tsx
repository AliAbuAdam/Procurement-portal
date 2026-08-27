"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Слово-подтверждение: защита от случайного клика — кнопка активна только
// после того, как админ напечатал его руками.
const CONFIRM_WORD = "УДАЛИТЬ";

interface WipeResult {
  batches?: number;
  offers?: number;
  products?: number;
  images?: number;
  matches?: number;
  categories?: number;
  suppliers?: number;
}

// WipeDataDialog — необратимая очистка всех данных (админ). Удаляет
// номенклатуры с фото, категории, сопоставления и прайс-листы; поставщиков —
// по галочке. Пользователи не затрагиваются.
export function WipeDataDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [withSuppliers, setWithSuppliers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const armed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    if (busy) return;
    setConfirmText("");
    setWithSuppliers(false);
    setError("");
    onClose();
  }

  async function onWipe() {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch<WipeResult>("/api/v1/admin/wipe", {
        method: "POST",
        body: JSON.stringify({ include_suppliers: withSuppliers }),
      });
      const total =
        (res.products ?? 0) +
        (res.offers ?? 0) +
        (res.batches ?? 0) +
        (res.categories ?? 0) +
        (res.suppliers ?? 0);
      // Полная перезагрузка: сбрасываем всё состояние приложения разом
      // (сайдбар, списки, кэш страниц).
      window.alert(`Данные очищены (удалено записей: ${total}).`);
      window.location.href = "/catalog";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось очистить данные");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wipe-title"
      onClick={close}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-[var(--destructive)]">
          <TriangleAlert className="size-5" />
          <h2 id="wipe-title" className="text-lg font-semibold">
            Очистить все данные?
          </h2>
        </div>

        <div className="flex flex-col gap-1 text-sm text-[var(--muted-foreground)]">
          <p>Будут безвозвратно удалены:</p>
          <ul className="list-inside list-disc">
            <li>все номенклатуры и их фото</li>
            <li>все категории</li>
            <li>все сопоставления</li>
            <li>все загруженные прайс-листы</li>
          </ul>
          <p>Пользователи не затрагиваются. Отменить это действие нельзя.</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={withSuppliers}
            onCheckedChange={(v) => setWithSuppliers(v === true)}
          />
          Удалить также поставщиков
        </label>

        <div className="flex flex-col gap-2">
          <Label htmlFor="wipe-confirm">
            Для подтверждения введите <b>{CONFIRM_WORD}</b>
          </Label>
          <Input
            id="wipe-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
          />
        </div>

        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close} disabled={busy}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={onWipe}
            disabled={!armed || busy}
          >
            {busy ? "Очистка…" : "Удалить всё"}
          </Button>
        </div>
      </div>
    </div>
  );
}
