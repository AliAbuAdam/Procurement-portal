"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ChevronRight,
  Database,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";

import { NavUser } from "@/components/nav-user";
import { useSession, type Role } from "@/lib/session";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type NavItem =
  | { kind: "link"; title: string; url: string; icon: LucideIcon; roles: Role[] }
  | {
      kind: "group";
      title: string;
      icon: LucideIcon;
      roles: Role[];
      items: { title: string; url: string }[];
    };

const NAV: NavItem[] = [
  {
    kind: "link",
    title: "Сводные данные",
    url: "/",
    icon: LayoutDashboard,
    roles: ["admin", "manager"],
  },
  {
    kind: "group",
    title: "Каталог",
    icon: Database,
    roles: ["admin", "manager"],
    items: [
      { title: "Поставщики", url: "/suppliers" },
      { title: "Прайс-листы", url: "/imports" },
      { title: "Номенклатуры", url: "/products" },
    ],
  },
  {
    kind: "group",
    title: "Анализ",
    icon: BarChart3,
    roles: ["admin", "manager"],
    items: [
      { title: "Сопоставление", url: "/matching" },
      { title: "Сравнение цен", url: "/compare" },
    ],
  },
  {
    kind: "link",
    title: "Пользователи",
    url: "/users",
    icon: Users,
    roles: ["admin"],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const role: Role = user?.role ?? "manager";

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname.startsWith(url);

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
              {NAV.filter((n) => n.roles.includes(role)).map((n) =>
                n.kind === "link" ? (
                  <SidebarMenuItem key={n.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(n.url)}
                      tooltip={n.title}
                    >
                      <Link href={n.url}>
                        <n.icon />
                        <span>{n.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <Collapsible
                    key={n.title}
                    asChild
                    defaultOpen
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={n.title}>
                          <n.icon />
                          <span>{n.title}</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {n.items.map((s) => (
                            <SidebarMenuSubItem key={s.url}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive(s.url)}
                              >
                                <Link href={s.url}>
                                  <span>{s.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ),
              )}
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
