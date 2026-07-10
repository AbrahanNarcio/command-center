import { NextResponse } from "next/server";
import { adminClient, supabaseConfigured } from "./supabase/admin";
import { serverClient } from "./supabase/server";
import { crossOriginResponse, sameOriginOk } from "./security";

/**
 * Roles:
 * - admin: acceso total a todas las cuentas.
 * - editor: ve y mueve TODO pero solo de su propia cuenta (piezas, calendario,
 *   fuentes, métricas, reportes y conectar su Instagram).
 * - viewer: solo lectura de su cuenta. En la base se guarda como 'client'
 *   (nombre histórico) o 'viewer'; ambos se tratan igual.
 */
export type Role = "admin" | "editor" | "viewer";

export interface SessionProfile {
  userId: string;
  email: string;
  role: Role;
  /** Para editor/viewer: la única cuenta a la que pertenecen. */
  accountId: string | null;
}

function toRole(raw: unknown): Role {
  if (raw === "admin") return "admin";
  if (raw === "editor") return "editor";
  return "viewer";
}

/** Resolve the logged-in user + profile, or null. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient()
    .from("profiles")
    .select("role, account_id, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return null;
  return {
    userId: user.id,
    email: profile.email ?? user.email ?? "",
    role: toRole(profile.role),
    accountId: profile.account_id ?? null,
  };
}

/** ¿Puede esta sesión administrar (escribir sobre) la cuenta dada? */
export function canManageAccount(session: SessionProfile, accountId: string): boolean {
  if (session.role === "admin") return true;
  return session.role === "editor" && !!session.accountId && session.accountId === accountId;
}

export async function requireAdmin(): Promise<SessionProfile | null> {
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return null;
  return session;
}

export type AdminGate =
  | { session: SessionProfile; response: null }
  | { session: null; response: NextResponse };

/**
 * Guard para rutas de admin: 401 sin sesión (el cliente redirige a /login),
 * 403 con sesión sin permisos. Todas las que usan este gate son mutaciones,
 * así que también se verifica el origen (defensa CSRF).
 */
export async function adminGate(): Promise<AdminGate> {
  if (!(await sameOriginOk())) return { session: null, response: crossOriginResponse() };
  const session = await getSessionProfile();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (session.role !== "admin") {
    return { session: null, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { session, response: null };
}

/**
 * Guard para escrituras sobre UNA cuenta: admin siempre; editor solo si es SU
 * cuenta. Los viewers nunca escriben. Verifica origen (CSRF) + sesión + permiso.
 */
export async function accountGate(accountId: string): Promise<AdminGate> {
  if (!(await sameOriginOk())) return { session: null, response: crossOriginResponse() };
  const session = await getSessionProfile();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!accountId || !canManageAccount(session, accountId)) {
    return { session: null, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { session, response: null };
}
