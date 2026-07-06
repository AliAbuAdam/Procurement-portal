"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LoginFlow, UiText } from "@ory/client";
import { Boxes } from "lucide-react";

import { ory } from "@/lib/ory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";

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

// Иконка Яндекса (красный кружок с «Я»).
function YandexMark() {
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-[#FC3F1D] text-[13px] font-bold text-white">
      Я
    </span>
  );
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
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Вход в Furnica</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Введите e-mail и пароль для входа
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="identifier">E-mail</FieldLabel>
          <Input
            id="identifier"
            name="identifier"
            type="email"
            placeholder="you@example.ru"
            autoComplete="username"
            required
          />
        </Field>

        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Пароль</FieldLabel>
            {/* Восстановление пароля — функция появится позже. */}
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Забыли пароль?
            </a>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        {messages.length > 0 && (
          <ul className="text-destructive text-sm">
            {messages.map((m) => (
              <li key={m.id}>{m.text}</li>
            ))}
          </ul>
        )}

        <Field>
          <Button type="submit" disabled={submitting || !flow}>
            {submitting ? "Вход…" : "Войти"}
          </Button>
        </Field>

        <FieldSeparator>или</FieldSeparator>

        <Field>
          {/* Вход через Yandex — реализация OAuth будет подключена позже. */}
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              setMessages([
                {
                  id: 1,
                  type: "info",
                  text: "Вход через Yandex будет подключён позже.",
                },
              ])
            }
          >
            <YandexMark />
            Войти через Yandex
          </Button>
          <FieldDescription className="text-center">
            Аккаунты заводит администратор.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Левая колонка — логотип + форма */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <span className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <Boxes className="size-4" />
            </div>
            Furnica
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Правая колонка — брендовая панель (вместо картинки; можно заменить на фото). */}
      <div className="bg-muted relative hidden lg:block">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-emerald-600/15 via-transparent to-slate-500/10">
          <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl">
            <Boxes className="size-9" />
          </div>
          <div className="text-3xl font-semibold">Furnica</div>
          <p className="text-muted-foreground max-w-xs text-center text-sm text-balance">
            Аналитика закупок мебельной фурнитуры: цены, номенклатура, сравнение
            поставщиков.
          </p>
        </div>
      </div>
    </div>
  );
}
