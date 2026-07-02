"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LoginFlow, UiText } from "@ory/client";

import { ory } from "@/lib/ory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const basePath =
  process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ?? "http://localhost:4433";

// Достаёт значение скрытого узла (например, csrf_token) из flow.ui.nodes.
function hiddenValue(flow: LoginFlow, name: string): string {
  for (const node of flow.ui.nodes) {
    const attrs = node.attributes as { name?: string; value?: unknown };
    if (attrs.name === name) return String(attrs.value ?? "");
  }
  return "";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [flow, setFlow] = useState<LoginFlow | null>(null);
  const [messages, setMessages] = useState<UiText[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Инициализация: если уже есть активная сессия — на главную (иначе будет
  // петля «мигания»). Иначе без параметра flow уходим в Kratos за новым flow —
  // он вернёт нас сюда с ?flow=<id> и выставит нужные куки.
  useEffect(() => {
    let cancelled = false;
    ory
      .toSession()
      .then(() => {
        if (!cancelled) router.replace("/");
      })
      .catch(() => {
        if (cancelled) return;
        const flowId = params.get("flow");
        if (!flowId) {
          window.location.href = `${basePath}/self-service/login/browser`;
          return;
        }
        ory
          .getLoginFlow({ id: flowId })
          .then(({ data }) => {
            if (!cancelled) setFlow(data);
          })
          .catch(() => {
            window.location.href = `${basePath}/self-service/login/browser`;
          });
      });
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!flow) return;
    setSubmitting(true);
    setMessages([]);

    const form = new FormData(e.currentTarget);
    try {
      await ory.updateLoginFlow({
        flow: flow.id,
        updateLoginFlowBody: {
          method: "password",
          identifier: String(form.get("identifier") ?? ""),
          password: String(form.get("password") ?? ""),
          csrf_token: hiddenValue(flow, "csrf_token"),
        },
      });
      router.push("/");
    } catch (err: unknown) {
      // Kratos возвращает обновлённый flow с сообщениями об ошибке (401/400).
      const resp = (err as { response?: { data?: LoginFlow } }).response;
      if (resp?.data?.ui) {
        setFlow(resp.data);
        setMessages(resp.data.ui.messages ?? []);
      } else {
        setMessages([{ id: 0, type: "error", text: "Не удалось войти" }]);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Вход в Furnica</CardTitle>
          <CardDescription>Введите e-mail и пароль</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="identifier">E-mail</Label>
              <Input
                id="identifier"
                name="identifier"
                type="email"
                autoComplete="username"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {messages.length > 0 && (
              <ul className="text-sm text-[var(--destructive)]">
                {messages.map((m) => (
                  <li key={m.id}>{m.text}</li>
                ))}
              </ul>
            )}

            <Button type="submit" disabled={submitting || !flow}>
              {submitting ? "Вход…" : "Войти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
