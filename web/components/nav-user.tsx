"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronsUpDown,
  Layers,
  LayoutDashboard,
  LogOut,
  Trash2,
  Users,
} from "lucide-react";

import { WipeDataDialog } from "@/components/wipe-data-dialog";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Role } from "@/lib/session";

// Служебные разделы живут в меню пользователя: основной сайдбар отдан
// каталогу (категориям), а «кухня» — поставщики, прайсы, сопоставление —
// спрятана сюда, чтобы не пугать обычных пользователей.
const DATA_ITEMS = [
  { title: "Поставщики", url: "/suppliers" },
  { title: "Прайс-листы", url: "/imports" },
  { title: "Номенклатуры", url: "/products" },
  { title: "Категории", url: "/categories" },
];

const ANALYSIS_ITEMS = [
  { title: "Сопоставление", url: "/matching" },
  { title: "Сравнение цен", url: "/compare" },
];

export function NavUser({
  email,
  role,
  onLogout,
}: {
  email: string;
  role: Role;
  onLogout: () => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [wipeOpen, setWipeOpen] = useState(false);
  const initials = (email || "?").slice(0, 2).toUpperCase();
  const roleLabel = role === "admin" ? "Администратор" : "Менеджер";

  // На мобильных сайдбар — выезжающая панель; после перехода закрываем её.
  const closeMobile = () => setOpenMobile(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{email}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {roleLabel}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{email}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/" onClick={closeMobile}>
                  <LayoutDashboard />
                  Сводные данные
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="size-3.5" />
              Данные
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {DATA_ITEMS.map((it) => (
                <DropdownMenuItem key={it.url} asChild>
                  <Link href={it.url} onClick={closeMobile}>
                    {it.title}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart3 className="size-3.5" />
              Анализ
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {ANALYSIS_ITEMS.map((it) => (
                <DropdownMenuItem key={it.url} asChild>
                  <Link href={it.url} onClick={closeMobile}>
                    {it.title}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            {role === "admin" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/users" onClick={closeMobile}>
                    <Users />
                    Пользователи
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setWipeOpen(true)}
                >
                  <Trash2 />
                  Очистить данные…
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <WipeDataDialog open={wipeOpen} onClose={() => setWipeOpen(false)} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
