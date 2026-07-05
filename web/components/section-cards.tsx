"use client";

import { useEffect, useState } from "react";
import { Package, Truck, Upload, BarChart3 } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

interface Stats {
  products: number;
  suppliers: number;
  imports: number;
}

export function SectionCards() {
  const [s, setS] = useState<Stats>({ products: 0, suppliers: 0, imports: 0 });

  useEffect(() => {
    Promise.all([
      apiFetch<{ products?: unknown[] }>("/api/v1/products").catch(() => ({
        products: [] as unknown[],
      })),
      apiFetch<{ suppliers?: unknown[] }>("/api/v1/suppliers").catch(() => ({
        suppliers: [] as unknown[],
      })),
      apiFetch<{ batches?: unknown[] }>("/api/v1/imports").catch(() => ({
        batches: [] as unknown[],
      })),
    ]).then(([p, sup, imp]) =>
      setS({
        products: p.products?.length ?? 0,
        suppliers: sup.suppliers?.length ?? 0,
        imports: imp.batches?.length ?? 0,
      }),
    );
  }, []);

  const cards = [
    {
      label: "Позиций в номенклатуре",
      value: s.products,
      hint: "Единые карточки товаров",
      icon: Package,
    },
    {
      label: "Поставщиков",
      value: s.suppliers,
      hint: "Источники цен",
      icon: Truck,
    },
    {
      label: "Загрузок прайсов",
      value: s.imports,
      hint: "Импортированные файлы",
      icon: Upload,
    },
    {
      label: "Готово к сравнению",
      value: s.products,
      hint: "Товаров доступно на странице цен",
      icon: BarChart3,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((c) => (
        <Card key={c.label} className="@container/card">
          <CardHeader>
            <CardDescription>{c.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {c.value}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex items-center gap-2 text-sm text-muted-foreground">
            <c.icon className="size-4" />
            {c.hint}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
