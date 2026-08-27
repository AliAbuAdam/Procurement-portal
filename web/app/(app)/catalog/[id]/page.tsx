"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";

import { apiFetch, imageUrl } from "@/lib/api";
import {
  categoryPath,
  currencySign,
  formatPrice,
  type Category,
} from "@/lib/catalog";
import { LoadingState } from "@/components/loading-state";
import {
  PriceComparisonTable,
  type PriceOffer,
} from "@/components/price-comparison-table";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  article?: string;
  image_url?: string;
  cover_image_id?: string;
  category_id?: string;
}

interface ProductImage {
  id: string;
  position?: number;
}

interface Comparison {
  product_id: string;
  offers?: PriceOffer[];
  cheapest_supplier_id?: string;
}

// Карточка товара витрины: галерея, характеристики и цены всех поставщиков —
// «как будто открыли товар в интернет-магазине».
export default function ProductPage() {
  const { id } = useParams<{ id: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cmp, setCmp] = useState<Comparison | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    Promise.all([
      apiFetch<Product>(`/api/v1/products/${id}`),
      apiFetch<{ images?: ProductImage[] }>(`/api/v1/products/${id}/images`),
      apiFetch<{ categories?: Category[] }>("/api/v1/categories"),
      apiFetch<Comparison>(`/api/v1/products/${id}/prices`),
    ])
      .then(([p, imgs, cats, comparison]) => {
        setProduct(p);
        setImages(imgs.images ?? []);
        setCategories(cats.categories ?? []);
        setCmp(comparison);
        setActiveImage((imgs.images ?? [])[0]?.id ?? null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Ошибка загрузки товара"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  const path = useMemo(
    () => categoryPath(categories, product?.category_id),
    [categories, product?.category_id],
  );

  const offers = cmp?.offers ?? [];
  const basePrices = offers
    .map((o) => o.price ?? 0)
    .filter((v) => v > 0);
  const minBase = basePrices.length ? Math.min(...basePrices) : 0;
  const minCurrency =
    offers.find((o) => (o.price ?? 0) === minBase)?.currency ?? "";

  if (loading) {
    return (
      <div className="px-4 lg:px-6">
        <LoadingState text="Загрузка товара…" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <p className="text-sm text-[var(--destructive)]">
          {error || "Товар не найден."}
        </p>
        <Link
          href="/catalog"
          className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:underline"
        >
          <ArrowLeft className="size-4" /> Вернуться в каталог
        </Link>
      </div>
    );
  }

  const mainSrc = activeImage
    ? imageUrl(activeImage)
    : product.image_url || undefined;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* Хлебные крошки: Каталог / категория / … */}
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
        <Link href="/catalog" className="hover:underline">
          Каталог
        </Link>
        {path.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span>/</span>
            <Link
              href={`/catalog?category=${c.id}`}
              className="hover:underline"
            >
              {c.name}
            </Link>
          </span>
        ))}
        <span>/</span>
        <span className="text-[var(--foreground)]">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Галерея */}
        <div className="flex flex-col gap-3">
          <div className="bg-muted flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-[var(--border)]">
            {mainSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mainSrc}
                crossOrigin="use-credentials"
                alt={product.name}
                className="size-full object-contain"
              />
            ) : (
              <Package className="text-muted-foreground size-16" />
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImage(img.id)}
                  className={cn(
                    "bg-muted size-16 shrink-0 overflow-hidden rounded-md border",
                    activeImage === img.id
                      ? "border-[var(--primary)]"
                      : "border-[var(--border)]",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(img.id, true)}
                    crossOrigin="use-credentials"
                    alt=""
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Информация и цены */}
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-[var(--muted-foreground)]">Артикул</dt>
            <dd>{product.article || "—"}</dd>
            <dt className="text-[var(--muted-foreground)]">Категория</dt>
            <dd>
              {path.length ? path.map((c) => c.name).join(" / ") : "без категории"}
            </dd>
          </dl>

          <div className="rounded-lg border border-[var(--border)] p-4">
            {offers.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                Предложений пока нет: товар ещё не сопоставлен ни с одним
                прайсом. Свяжите строки на странице «Сопоставление».
              </p>
            ) : (
              <div className="flex items-baseline gap-3">
                {minBase > 0 && (
                  <span className="text-3xl font-bold">
                    от {formatPrice(minBase)} {currencySign(minCurrency)}
                  </span>
                )}
                <span className="text-sm text-[var(--muted-foreground)]">
                  {offers.length}{" "}
                  {offers.length === 1 ? "предложение" : "предложения(й)"}
                </span>
              </div>
            )}
          </div>

          {offers.length > 0 && <PriceComparisonTable offers={offers} />}
        </div>
      </div>
    </div>
  );
}
