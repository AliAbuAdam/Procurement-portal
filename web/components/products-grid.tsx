"use client";

import { Package } from "lucide-react";

import type { ProductRow } from "@/components/products-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProductsGrid({ products }: { products: ProductRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <Card key={p.id} className="gap-0 overflow-hidden py-0">
          <div className="bg-muted flex aspect-square items-center justify-center overflow-hidden">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.name}
                className="size-full object-cover"
              />
            ) : (
              <Package className="text-muted-foreground size-10" />
            )}
          </div>
          <CardHeader className="gap-1 px-3 py-3">
            <CardTitle
              className="line-clamp-2 text-sm leading-snug"
              title={p.name}
            >
              {p.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 text-xs">
            <span className="text-muted-foreground">
              Артикул: {p.article || "—"}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
