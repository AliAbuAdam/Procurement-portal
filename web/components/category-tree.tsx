"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import type { CategoryNode } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** Спец-значение фильтра «товары без категории» (понимает и backend). */
export const UNCATEGORIZED = "none";

// CategoryTree — боковое дерево категорий витрины (как в интернет-магазине):
// имя + счётчик товаров (с подкатегориями), раскрытие веток, пункт «Все
// товары» и, если есть неразложенные товары, пункт «Без категории».
export function CategoryTree({
  nodes,
  totalAll,
  uncategorized = 0,
  selectedId,
  onSelect,
}: {
  nodes: CategoryNode[];
  totalAll: number;
  uncategorized?: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-[var(--secondary)]",
          selectedId === null && "bg-[var(--secondary)] font-medium",
        )}
      >
        <span>Все товары</span>
        <span className="text-xs text-[var(--muted-foreground)]">
          {totalAll}
        </span>
      </button>
      {nodes.map((n) => (
        <TreeRow
          key={n.id}
          node={n}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
      {uncategorized > 0 && (
        <button
          type="button"
          onClick={() => onSelect(UNCATEGORIZED)}
          className={cn(
            "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[var(--muted-foreground)] hover:bg-[var(--secondary)]",
            selectedId === UNCATEGORIZED &&
              "bg-[var(--secondary)] font-medium text-[var(--foreground)]",
          )}
        >
          <span>Без категории</span>
          <span className="text-xs">{uncategorized}</span>
        </button>
      )}
    </nav>
  );
}

function TreeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: CategoryNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          "flex items-center rounded-md hover:bg-[var(--secondary)]",
          selectedId === node.id && "bg-[var(--secondary)]",
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? "Свернуть" : "Развернуть"}
            onClick={() => setOpen((v) => !v)}
            className="flex size-6 shrink-0 items-center justify-center text-[var(--muted-foreground)]"
          >
            <ChevronRight
              className={cn("size-3.5 transition-transform", open && "rotate-90")}
            />
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={cn(
            "flex flex-1 items-center justify-between gap-2 py-1.5 pr-2 text-left",
            selectedId === node.id && "font-medium",
          )}
        >
          <span className="line-clamp-1">{node.name}</span>
          <span className="text-xs text-[var(--muted-foreground)]">
            {node.total_count}
          </span>
        </button>
      </div>
      {open &&
        node.children.map((ch) => (
          <TreeRow
            key={ch.id}
            node={ch}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}
