"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  Truck,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

import { NavUser } from "@/components/nav-user";
import { useSession, type Role } from "@/lib/session";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const nav: { title: string; url: string; icon: LucideIcon; roles: Role[] }[] = [
  { title: "Обзор", url: "/", icon: LayoutDashboard, roles: ["admin", "manager"] },
  { title: "Поставщики", url: "/suppliers", icon: Truck, roles: ["admin", "manager"] },
  { title: "Импорт прайсов", url: "/imports", icon: Upload, roles: ["admin", "manager"] },
  { title: "Номенклатура", url: "/products", icon: Package, roles: ["admin", "manager"] },
  { title: "Сопоставление", url: "/matching", icon: ArrowLeftRight, roles: ["admin", "manager"] },
  { title: "Сравнение цен", url: "/compare", icon: BarChart3, roles: ["admin", "manager"] },
  { title: "Пользователи", url: "/users", icon: Users, roles: ["admin"] },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
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
              <Link href="/">
                <Boxes className="size-5!" />
                <span className="text-base font-semibold">Furnica</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav
                .filter((n) => n.roles.includes(role))
                .map((n) => {
                  const active =
                    n.url === "/"
                      ? pathname === "/"
                      : pathname.startsWith(n.url);
                  return (
                    <SidebarMenuItem key={n.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={n.title}
                      >
                        <Link href={n.url}>
                          <n.icon />
                          <span>{n.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <NavUser email={user.email} role={user.role} onLogout={logout} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
