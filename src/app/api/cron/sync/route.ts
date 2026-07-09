import { NextResponse } from "next/server";
import { adminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { isConfigured } from "@/lib/instagram";
import { syncAccount } from "@/lib/sync";
import { getMetricsRow, insertReport, listReports } from "@/lib/db";
import { newId } from "@/lib/seed";

const TZ = process.env.SYNC_TIMEZONE || "America/Mexico_City";

/**
 * Reporte mensual automático: cada día 1 (hora local), congela las métricas de
 * cada cuenta como "Reporte mensual · {mes anterior}". Corre dentro del cron
 * diario para no gastar el segundo cron del plan gratuito de Vercel.
 */
async function monthlyReports(): Promise<Record<string, string>> {
  const now = new Date();
  const day = Number(now.toLocaleDateString("en-US", { timeZone: TZ, day: "numeric" }));
  if (day !== 1) return {};

  const prevMonth = new Date(now);
  prevMonth.setDate(0); // último día del mes anterior
  const monthLabel = prevMonth.toLocaleDateString("es-MX", { timeZone: TZ, month: "long", year: "numeric" });

  const { data: accounts } = await adminClient().from("accounts").select("id, handle");
  const out: Record<string, string> = {};
  for (const acc of accounts ?? []) {
    try {
      const metrics = await getMetricsRow(acc.id);
      if (!metrics) continue;
      const title = `Reporte mensual ${acc.handle} · ${monthLabel}`;
      const existing = await listReports(acc.id);
      if (existing.some((r) => r.title === title)) {
        out[acc.handle] = "ya existía";
        continue;
      }
      await insertReport({
        id: newId("rep"),
        accountId: acc.id,
        title,
        note: "Generado automáticamente el día 1 del mes.",
        createdAt: now.toISOString(),
        data: metrics,
      });
      out[acc.handle] = "generado";
    } catch (err) {
      out[acc.handle] = `error: ${err instanceof Error ? err.message : "?"}`;
    }
  }
  return out;
}

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

  // Después del sync (métricas frescas), el día 1 se congela el reporte mensual.
  const monthly = await monthlyReports();

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results, monthly });
}
