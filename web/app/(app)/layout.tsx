"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SessionProvider, useSession, type Role } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav: { href: string; label: string; roles: Role[] }[] = [
  { href: "/", label: "Обзор", roles: ["admin", "manager"] },
  { href: "/suppliers", label: "Поставщики", roles: ["admin", "manager"] },
  { href: "/imports", label: "Импорт прайсов", roles: ["admin", "manager"] },
  { href: "/products", label: "Номенклатура", roles: ["admin", "manager"] },
  { href: "/matching", label: "Сопоставление", roles: ["admin", "manager"] },
  { href: "/compare", label: "Сравнение цен", roles: ["admin", "manager"] },
  { href: "/users", label: "Пользователи", roles: ["admin"] },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useSession();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--muted-foreground)] text-sm">Загрузка…</p>
      </div>
    );
  }
  if (!user) return null; // редирект уже произошёл в провайдере

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-[var(--border)] p-4">
        <div className="mb-6 px-2 text-lg font-semibold">Furnica</div>
        <nav className="flex flex-col gap-1">
          {nav
            .filter((n) => n.roles.includes(user.role))
            .map((n) => {
              const active =
                n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm",
                    active
                      ? "bg-[var(--secondary)] font-medium"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
        </nav>
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <div className="px-2 text-xs text-[var(--muted-foreground)]">
            {user.email}
            <span className="ml-1 rounded bg-[var(--secondary)] px-1.5 py-0.5">
              {user.role}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            Выйти
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
