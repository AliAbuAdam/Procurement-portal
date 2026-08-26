"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";

import { apiFetch, imageUrl } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const MAX_IMAGES = 10;

interface ProductImage {
  id: string;
  position?: number;
}

interface Props {
  product: { id: string; name: string } | null;
  onClose: () => void;
  // Вызывается при любом изменении галереи — родитель обновляет обложки в списке.
  onChanged: () => void;
}

// Панель управления галереей карточки: загрузка (до 10 фото), удаление,
// изменение порядка. Первое фото — обложка в списках.
export function ProductImagesSheet({ product, onClose, onChanged }: Props) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changedRef = useRef(false);

  const load = useCallback(async (productId: string) => {
    try {
      const d = await apiFetch<{ images?: ProductImage[] }>(
        `/api/v1/products/${productId}/images`,
      );
      setImages(d.images ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки фото");
    }
  }, []);

  useEffect(() => {
    setImages([]);
    setError("");
    changedRef.current = false;
    if (product) load(product.id);
  }, [product, load]);

  function markChanged() {
    changedRef.current = true;
  }

  async function onFiles(files: FileList | null) {
    if (!product || !files || files.length === 0) return;
    const room = MAX_IMAGES - images.length;
    const list = Array.from(files);
    setBusy(true);
    setError("");
    try {
      for (const f of list.slice(0, room)) {
        const img = await compressImage(f);
        await apiFetch(`/api/v1/products/${product.id}/images`, {
          method: "POST",
          body: JSON.stringify({
            content_type: img.contentType,
            data_base64: img.dataBase64,
            thumb_base64: img.thumbBase64,
          }),
        });
      }
      if (list.length > room) {
        setError(`Лимит ${MAX_IMAGES} фото: часть файлов не загружена`);
      }
      markChanged();
      await load(product.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!product) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/v1/products/${product.id}/images/${id}`, {
        method: "DELETE",
      });
      markChanged();
      await load(product.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить фото");
    } finally {
      setBusy(false);
    }
  }

  // Сдвиг фото на одну позицию; отправляем полный новый порядок.
  async function move(index: number, dir: -1 | 1) {
    if (!product) return;
    const next = [...images];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setImages(next); // оптимистично, чтобы стрелки не «моргали»
    setError("");
    try {
      await apiFetch(`/api/v1/products/${product.id}/images/order`, {
        method: "PUT",
        body: JSON.stringify({ image_ids: next.map((i) => i.id) }),
      });
      markChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить порядок");
      await load(product.id);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      if (changedRef.current) onChanged();
      onClose();
    }
  }

  return (
    <Sheet open={!!product} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Фото карточки</SheetTitle>
          <SheetDescription>{product?.name}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {images.length} из {MAX_IMAGES} · первое фото — обложка
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || images.length >= MAX_IMAGES}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              Добавить
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--destructive)]">{error}</p>
          )}
          {busy && (
            <p className="text-muted-foreground text-sm">Обработка фото…</p>
          )}

          {images.length === 0 && !busy ? (
            <p className="text-muted-foreground text-sm">
              Фото пока нет. Добавьте до {MAX_IMAGES} изображений — они появятся
              в карточке и списках.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {images.map((img, i) => (
                <div
                  key={img.id}
                  className="group relative overflow-hidden rounded-lg border border-[var(--border)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(img.id, true)}
                    crossOrigin="use-credentials"
                    alt={`Фото ${i + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      обложка
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="size-7"
                        disabled={busy || i === 0}
                        aria-label="Сдвинуть влево"
                        onClick={() => move(i, -1)}
                      >
                        <ArrowLeft className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="size-7"
                        disabled={busy || i === images.length - 1}
                        aria-label="Сдвинуть вправо"
                        onClick={() => move(i, 1)}
                      >
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="size-7"
                      disabled={busy}
                      aria-label="Удалить фото"
                      onClick={() => remove(img.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
