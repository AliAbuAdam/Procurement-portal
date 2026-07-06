import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

// Современный индикатор загрузки: крутящийся спиннер с подписью + скелет-строки.
export function LoadingState({
  text = "Загрузка данных…",
  rows = 3,
}: {
  text?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="size-4 animate-spin text-emerald-600" />
        {text}
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
