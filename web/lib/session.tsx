"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@ory/client";

import { ory } from "@/lib/ory";

export type Role = "admin" | "manager";

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  role: Role;
}

interface SessionCtx {
  user: CurrentUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function useSession() {
  return useContext(Ctx);
}

function toUser(session: Session): CurrentUser {
  const identity = session.identity;
  const traits = (identity?.traits ?? {}) as { email?: string; name?: string };
  const meta = (identity?.metadata_public ?? {}) as { role?: string };
  const role: Role = meta.role === "admin" ? "admin" : "manager";
  return {
    id: identity?.id ?? "",
    email: traits.email ?? "",
    name: traits.name,
    role,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ory
      .toSession()
      .then(({ data }) => setUser(toUser(data)))
      .catch(() => router.replace("/auth/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const logout = useCallback(async () => {
    try {
      const { data } = await ory.createBrowserLogoutFlow();
      window.location.href = data.logout_url;
    } catch {
      router.replace("/auth/login");
    }
  }, [router]);

  return (
    <Ctx.Provider value={{ user, loading, logout }}>{children}</Ctx.Provider>
  );
}
