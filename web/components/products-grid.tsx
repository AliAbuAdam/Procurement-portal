"use client";

import { Camera, Package } from "lucide-react";

import {
  coverSrc,
  type ProductRow,
} from "@/components/products-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProductsGrid({
  products,
  onManageImages,
}: {
  products: ProductRow[];
  onManageImages: (p: ProductRow) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => {
        const src = coverSrc(p);
        return (
          <Card key={p.id} className="group gap-0 overflow-hidden py-0">
            <div className="bg-muted relative flex aspect-square items-center justify-center overflow-hidden">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  crossOrigin="use-credentials"
                  alt={p.name}
                  className="size-full object-cover"
                />
              ) : (
                <Package className="text-muted-foreground size-10" />
              )}
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 size-8 opacity-0 shadow transition-opacity group-hover:opacity-100"
                aria-label="Фото карточки"
                title="Фото карточки"
                onClick={() => onManageImages(p)}
              >
                <Camera className="size-4" />
              </Button>
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
        );
      })}
    </div>
  );
}
