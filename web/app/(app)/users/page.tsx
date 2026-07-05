"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function UsersPage() {
  const { user } = useSession();
  const isAdmin = user?.role === "admin";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("manager");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await apiFetch<{ users?: User[] }>("/api/v1/users");
      setUsers(d.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({ email, name, role, password }),
      });
      setEmail("");
      setName("");
      setRole("manager");
      setPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать");
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-2 px-4 lg:px-6">
        <h1 className="text-2xl font-semibold">Пользователи</h1>
        <p className="text-[var(--muted-foreground)] text-sm">
          Доступно только администратору.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Пользователи</h1>

      <form
        onSubmit={onCreate}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] p-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Имя</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role">Роль</Label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 rounded-md border border-[var(--input)] bg-transparent px-3 text-sm"
          >
            <option value="manager">Менеджер</option>
            <option value="admin">Администратор</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="мин. 8 символов"
            required
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Создание…" : "Создать"}
        </Button>
      </form>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {loading ? (
        <p className="text-[var(--muted-foreground)] text-sm">Загрузка…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Имя</TableHead>
              <TableHead>Роль</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>{u.name || "—"}</TableCell>
                <TableCell>{u.role || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
