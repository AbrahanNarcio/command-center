import { NextResponse } from "next/server";
import { adminClient, supabaseConfigured } from "./supabase/admin";
import { serverClient } from "./supabase/server";

export type Role = "admin" | "client";

export interface SessionProfile {
  userId: string;
  email: string;
  role: Role;
  /** For client role: the single account they can view. */
  accountId: string | null;
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
    role: profile.role === "admin" ? "admin" : "client",
    accountId: profile.account_id ?? null,
  };
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
 * 403 con sesión sin permisos. No mezclar ambos en un solo 403.
 */
export async function adminGate(): Promise<AdminGate> {
  const session = await getSessionProfile();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (session.role !== "admin") {
    return { session: null, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { session, response: null };
}
