"use client";

import * as React from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { buildCategoryTree, type Category } from "@/lib/catalog";
import { CategoryTree } from "@/components/category-tree";
import { NavUser } from "@/components/nav-user";
import { useSession, type Role } from "@/lib/session";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

// Основной сайдбар — каталог как в интернет-магазине: дерево категорий со
// счётчиками. Служебные разделы (данные, анализ, пользователи) — в меню
// кнопки пользователя внизу (NavUser).
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, logout } = useSession();
  const role: Role = user?.role ?? "manager";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/catalog">
                <Boxes className="size-5!" />
                <span className="text-base font-semibold">Furnica</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Каталог</SidebarGroupLabel>
          <SidebarGroupContent>
            {/* useSearchParams внутри — по правилам Next оборачиваем в Suspense */}
            <Suspense fallback={null}>
              <SidebarCategories />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <NavUser email={user.email} role={role} onLogout={logout} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

// Значение selectedId, не совпадающее ни с одной строкой дерева: вне витрины
// подсветки быть не должно (null подсветил бы «Все товары»).
const NOTHING_SELECTED = "__off__";

function SidebarCategories() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setOpenMobile } = useSidebar();

  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorized, setUncategorized] = useState(0);

  // Перезагружаем дерево при каждой смене страницы: категории и счётчики
  // могли измениться (правки на /categories, назначения на /products).
  // Запрос дешёвый, ответ маленький.
  useEffect(() => {
    apiFetch<{ categories?: Category[]; uncategorized_count?: number }>(
      "/api/v1/categories",
    )
      .then((d) => {
        setCategories(d.categories ?? []);
        setUncategorized(d.uncategorized_count ?? 0);
      })
      .catch(() => {});
  }, [pathname]);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const totalAll = useMemo(
    () => tree.reduce((acc, n) => acc + n.total_count, 0) + uncategorized,
    [tree, uncategorized],
  );

  const onCatalog = pathname === "/catalog";
  const selectedId = onCatalog
    ? searchParams.get("category")
    : NOTHING_SELECTED;

  return (
    <div className="px-1">
      <CategoryTree
        nodes={tree}
        totalAll={totalAll}
        uncategorized={uncategorized}
        selectedId={selectedId}
        onSelect={(id) => {
          router.push(id ? `/catalog?category=${id}` : "/catalog");
          setOpenMobile(false);
        }}
      />
    </div>
  );
}
