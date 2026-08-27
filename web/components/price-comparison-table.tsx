"use client";

import { useState } from "react";

import { currencySign, formatPrice } from "@/lib/catalog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface PriceOffer {
  supplier_id: string;
  supplier_name: string;
  price?: number;
  currency?: string;
  in_stock?: boolean;
  stock_qty?: number;
  updated_at?: string;
  price_opt?: number;
  price_bulk?: number;
}

// Уровень цены. Все три цены приходят в одном ответе, поэтому переключение —
// чисто клиентское, без повторного запроса.
export type Tier = "base" | "opt" | "bulk";

const TIERS: { value: Tier; label: string }[] = [
  { value: "base", label: "Розница" },
  { value: "opt", label: "Опт" },
  { value: "bulk", label: "Крупный опт" },
];

export function tierPrice(o: PriceOffer, t: Tier): number {
  if (t === "opt") return o.price_opt ?? 0;
  if (t === "bulk") return o.price_bulk ?? 0;
  return o.price ?? 0;
}

// PriceComparisonTable — цены всех поставщиков по товару с переключателем
// уровня цены. Используется на карточке товара витрины и на «Сравнении цен».
export function PriceComparisonTable({ offers }: { offers: PriceOffer[] }) {
  const [tier, setTier] = useState<Tier>("base");

  // Сортируем по цене выбранного уровня; поставщики без этой цены — в конце.
  const sorted = [...offers].sort(
    (a, b) => (tierPrice(a, tier) || Infinity) - (tierPrice(b, tier) || Infinity),
  );
  const cheapestPrice = sorted.length ? tierPrice(sorted[0], tier) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={tier}
          onValueChange={(v) => v && setTier(v as Tier)}
        >
          {TIERS.map((t) => (
            <ToggleGroupItem key={t.value} value={t.value}>
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Поставщик</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Разница</TableHead>
              <TableHead>Наличие</TableHead>
              <TableHead>Прайс от</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((o, i) => {
              const price = tierPrice(o, tier);
              const hasPrice = price > 0;
              const isCheapest = i === 0 && hasPrice;
              const diff =
                cheapestPrice > 0
                  ? ((price - cheapestPrice) / cheapestPrice) * 100
                  : 0;
              return (
                <TableRow
                  key={o.supplier_id}
                  className={cn(isCheapest && "bg-green-600/10")}
                >
                  <TableCell className="font-medium">
                    {o.supplier_name}
                    {isCheapest && (
                      <span className="ml-2 rounded bg-green-600/20 px-1.5 py-0.5 text-xs text-green-700">
                        дешевле всех
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasPrice
                      ? `${formatPrice(price)} ${currencySign(o.currency)}`
                      : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      isCheapest
                        ? "text-green-700"
                        : "text-[var(--muted-foreground)]",
                    )}
                  >
                    {isCheapest || !hasPrice ? "—" : `+${diff.toFixed(1)}%`}
                  </TableCell>
                  <TableCell>
                    {o.in_stock
                      ? `в наличии${o.stock_qty ? ` (${o.stock_qty})` : ""}`
                      : "нет"}
                  </TableCell>
                  <TableCell className="text-[var(--muted-foreground)]">
                    {o.updated_at
                      ? new Date(o.updated_at).toLocaleDateString("ru-RU")
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
