"use client";

import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const TITLES: Record<string, string> = {
  "/": "Обзор",
  "/suppliers": "Поставщики",
  "/imports": "Импорт прайсов",
  "/products": "Номенклатура",
  "/matching": "Сопоставление",
  "/compare": "Сравнение цен",
  "/users": "Пользователи",
};

function titleFor(pathname: string): string {
  if (pathname === "/") return TITLES["/"];
  const key = Object.keys(TITLES).find(
    (k) => k !== "/" && pathname.startsWith(k),
  );
  return key ? TITLES[key] : "Furnica";
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{titleFor(pathname)}</h1>
      </div>
    </header>
  );
}
