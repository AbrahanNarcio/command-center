import { NextResponse } from "next/server";
import { adminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { isConfigured } from "@/lib/instagram";
import { syncAccount } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincronización automática (Vercel Cron, diaria). Recorre todas las cuentas
 * conectadas y actualiza sus métricas + snapshot de seguidores.
 * Protegida: solo corre con el CRON_SECRET (Vercel lo manda como Bearer).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured() || !isConfigured()) {
    return NextResponse.json({ error: "app no configurada" }, { status: 503 });
  }

  const { data: connections, error } = await adminClient()
    .from("connections")
    .select("account_id, username");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Record<string, string> = {};
  for (const conn of connections ?? []) {
    const result = await syncAccount(conn.account_id, true);
    results[`@${conn.username}`] = result.ok ? "ok" : `error: ${result.error}`;
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}
