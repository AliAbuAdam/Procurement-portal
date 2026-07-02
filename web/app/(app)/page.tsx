"use client";

import { useSession } from "@/lib/session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Dashboard() {
  const { user } = useSession();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Обзор</h1>
        <p className="text-[var(--muted-foreground)] text-sm">
          Добро пожаловать, {user?.email}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Поставщики</CardTitle>
            <CardDescription>Справочник источников цен</CardDescription>
          </CardHeader>
          <CardContent className="text-[var(--muted-foreground)] text-sm">
            Добавляйте поставщиков и загружайте их прайсы.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Импорт прайсов</CardTitle>
            <CardDescription>Excel / CSV с маппингом колонок</CardDescription>
          </CardHeader>
          <CardContent className="text-[var(--muted-foreground)] text-sm">
            Загружайте таблицы — система разберёт строки по вашему маппингу.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
