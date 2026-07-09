"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Account,
  AccountMetrics,
  ClientUserView,
  Me,
  Piece,
  PublicConnection,
  PublicDb,
  Source,
} from "./types";
import { browserClient } from "./supabase/browser";

type Toast = { id: number; text: string };

interface StoreValue {
  loading: boolean;
  setupError: string | null;
  accounts: Account[];
  pieces: Piece[];
  sources: Source[];
  metrics: AccountMetrics[];
  connections: PublicConnection[];
  clientUsers: ClientUserView[];
  igConfigured: boolean;
  me: Me | null;
  canEdit: boolean;
  activeId: string;
  activeAccount: Account | undefined;
  activeMetrics: AccountMetrics | undefined;
  activeConnection: PublicConnection | undefined;
  accountPieces: Piece[];
  accountSources: Source[];
  toast: Toast | null;
  setActiveId: (id: string) => void;
  notify: (text: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  createAccount: (input: Partial<Account>) => Promise<void>;
  updateAccount: (id: string, patch: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  createPiece: (input: Partial<Piece>) => Promise<void>;
  updatePiece: (id: string, patch: Partial<Piece>) => Promise<void>;
  deletePiece: (id: string) => Promise<void>;
  createSource: (input: Partial<Source>) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  saveMetrics: (accountId: string, patch: Partial<AccountMetrics>) => Promise<void>;
  syncConnection: (accountId: string) => Promise<void>;
  disconnectConnection: (accountId: string) => Promise<void>;
  createClientUser: (accountId: string, email: string, password: string) => Promise<string | null>;
  deleteClientUser: (userId: string) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("No autenticado");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `${method} ${url} -> ${res.status}`);
  }
  return res.json();
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<PublicDb | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>("");
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(async (selectFirst: boolean) => {
    const res = await fetch("/api/bootstrap");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setSetupError(data?.detail || data?.error || "Error al cargar");
      return;
    }
    setSetupError(null);
    setDb(data as PublicDb);
    if (selectFirst) setActiveId((data as PublicDb).accounts[0]?.id ?? "");
  }, []);

  useEffect(() => {
    load(true).catch(() => setSetupError("No se pudo conectar con el servidor."));
  }, [load]);

  const refresh = useCallback(async () => {
    await load(false);
  }, [load]);

  const notify = useCallback((text: string) => {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2400);
  }, []);

  const signOut = useCallback(async () => {
    await browserClient().auth.signOut();
    window.location.href = "/login";
  }, []);

  const createAccount = useCallback(
    async (input: Partial<Account>) => {
      const account = await api<Account>("/api/accounts", "POST", input);
      await load(false);
      setActiveId(account.id);
      notify("Cuenta creada");
    },
    [load, notify],
  );

  const updateAccount = useCallback(
    async (id: string, patch: Partial<Account>) => {
      await api(`/api/accounts/${id}`, "PATCH", patch);
      setDb((prev) =>
        prev
          ? { ...prev, accounts: prev.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }
          : prev,
      );
      notify("Cuenta actualizada");
    },
    [notify],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      await api(`/api/accounts/${id}`, "DELETE");
      setDb((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          accounts: prev.accounts.filter((a) => a.id !== id),
          pieces: prev.pieces.filter((p) => p.accountId !== id),
          sources: prev.sources.filter((s) => s.accountId !== id),
          metrics: prev.metrics.filter((m) => m.accountId !== id),
          connections: prev.connections.filter((c) => c.accountId !== id),
        };
      });
      setActiveId((current) => {
        if (current !== id) return current;
        const remaining = db?.accounts.filter((a) => a.id !== id) ?? [];
        return remaining[0]?.id ?? "";
      });
      notify("Cuenta eliminada");
    },
    [db, notify],
  );

  const createPiece = useCallback(
    async (input: Partial<Piece>) => {
      const piece = await api<Piece>("/api/pieces", "POST", { ...input, accountId: activeId });
      setDb((prev) => (prev ? { ...prev, pieces: [...prev.pieces, piece] } : prev));
      notify("Pieza agregada");
    },
    [activeId, notify],
  );

  const updatePiece = useCallback(async (id: string, patch: Partial<Piece>) => {
    setDb((prev) =>
      prev
        ? { ...prev, pieces: prev.pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)) }
        : prev,
    );
    await api(`/api/pieces/${id}`, "PATCH", patch);
  }, []);

  const deletePiece = useCallback(
    async (id: string) => {
      await api(`/api/pieces/${id}`, "DELETE");
      setDb((prev) => (prev ? { ...prev, pieces: prev.pieces.filter((p) => p.id !== id) } : prev));
      notify("Pieza eliminada");
    },
    [notify],
  );

  const createSource = useCallback(
    async (input: Partial<Source>) => {
      const source = await api<Source>("/api/sources", "POST", { ...input, accountId: activeId });
      setDb((prev) => (prev ? { ...prev, sources: [...prev.sources, source] } : prev));
      notify("Fuente agregada");
    },
    [activeId, notify],
  );

  const deleteSource = useCallback(
    async (id: string) => {
      await api(`/api/sources/${id}`, "DELETE");
      setDb((prev) => (prev ? { ...prev, sources: prev.sources.filter((s) => s.id !== id) } : prev));
      notify("Fuente eliminada");
    },
    [notify],
  );

  const saveMetrics = useCallback(
    async (accountId: string, patch: Partial<AccountMetrics>) => {
      const updated = await api<AccountMetrics>(`/api/metrics/${accountId}`, "PUT", patch);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              metrics: prev.metrics.map((m) => (m.accountId === accountId ? updated : m)),
            }
          : prev,
      );
      notify("Métricas guardadas");
    },
    [notify],
  );

  const syncConnection = useCallback(
    async (accountId: string) => {
      const res = await fetch(`/api/connect/${accountId}/sync?force=1`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify(data?.error || "No se pudo sincronizar");
        await refresh();
        return;
      }
      await refresh();
      notify(data?.throttled ? "Ya estaba al día" : "Métricas sincronizadas desde Instagram");
    },
    [notify, refresh],
  );

  const disconnectConnection = useCallback(
    async (accountId: string) => {
      await api(`/api/connect/${accountId}`, "DELETE");
      await refresh();
      notify("Cuenta desconectada");
    },
    [notify, refresh],
  );

  const createClientUser = useCallback(
    async (accountId: string, email: string, password: string): Promise<string | null> => {
      try {
        await api("/api/clients", "POST", { accountId, email, password });
        await refresh();
        notify("Acceso de cliente creado");
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Error al crear el acceso";
      }
    },
    [notify, refresh],
  );

  const deleteClientUser = useCallback(
    async (userId: string) => {
      await api(`/api/clients/${userId}`, "DELETE");
      await refresh();
      notify("Acceso eliminado");
    },
    [notify, refresh],
  );

  const value = useMemo<StoreValue>(() => {
    const accounts = db?.accounts ?? [];
    const pieces = db?.pieces ?? [];
    const sources = db?.sources ?? [];
    const metrics = db?.metrics ?? [];
    const connections = db?.connections ?? [];
    const me = db?.me ?? null;
    return {
      loading: db === null && setupError === null,
      setupError,
      accounts,
      pieces,
      sources,
      metrics,
      connections,
      clientUsers: db?.clientUsers ?? [],
      igConfigured: db?.igConfigured ?? false,
      me,
      canEdit: me?.role === "admin",
      activeId,
      activeAccount: accounts.find((a) => a.id === activeId),
      activeMetrics: metrics.find((m) => m.accountId === activeId),
      activeConnection: connections.find((c) => c.accountId === activeId),
      accountPieces: pieces.filter((p) => p.accountId === activeId),
      accountSources: sources.filter((s) => s.accountId === activeId),
      toast,
      setActiveId,
      notify,
      refresh,
      signOut,
      createAccount,
      updateAccount,
      deleteAccount,
      createPiece,
      updatePiece,
      deletePiece,
      createSource,
      deleteSource,
      saveMetrics,
      syncConnection,
      disconnectConnection,
      createClientUser,
      deleteClientUser,
    };
  }, [
    db,
    setupError,
    activeId,
    toast,
    notify,
    refresh,
    signOut,
    createAccount,
    updateAccount,
    deleteAccount,
    createPiece,
    updatePiece,
    deletePiece,
    createSource,
    deleteSource,
    saveMetrics,
    syncConnection,
    disconnectConnection,
    createClientUser,
    deleteClientUser,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
