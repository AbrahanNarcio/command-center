import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getConnection, getMetricsRow, patchConnection, upsertMetrics } from "@/lib/db";
import { open, seal } from "@/lib/crypto";
import {
  fetchAccountInsights,
  fetchProfile,
  formatCompact,
  isConfigured,
  metricValue,
  refreshLongToken,
} from "@/lib/instagram";
import { Kpi } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ accountId: string }> };

// Guía: no recalcular en tiempo real en cada carga. Throttle mínimo entre syncs.
const MIN_SYNC_MS = 30 * 60 * 1000;
// Refrescar el token si le quedan menos de 7 días de vida.
const REFRESH_BEFORE_MS = 7 * 24 * 3600 * 1000;

export async function POST(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { accountId } = await params;
  if (!isConfigured()) {
    return NextResponse.json({ error: "Instagram no configurado" }, { status: 400 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const conn = await getConnection(accountId);
  if (!conn) {
    return NextResponse.json({ error: "Cuenta no conectada" }, { status: 404 });
  }

  if (!force && conn.lastSyncAt) {
    const age = Date.now() - new Date(conn.lastSyncAt).getTime();
    if (age < MIN_SYNC_MS) {
      return NextResponse.json({ ok: true, throttled: true, lastSyncAt: conn.lastSyncAt });
    }
  }

  try {
    let token = open({ tokenEnc: conn.tokenEnc, tokenIv: conn.tokenIv, tokenTag: conn.tokenTag });
    let refreshed: { access_token: string; expires_in: number } | null = null;

    const expiresLeft = new Date(conn.expiresAt).getTime() - Date.now();
    if (expiresLeft < REFRESH_BEFORE_MS) {
      refreshed = await refreshLongToken(token);
      token = refreshed.access_token;
    }

    const profile = await fetchProfile(token);
    const insights = await fetchAccountInsights(conn.igUserId, token);

    const reach = metricValue(insights, "reach");
    const views = metricValue(insights, "views");
    const comments = metricValue(insights, "comments");
    const shares = metricValue(insights, "shares");
    const saves = metricValue(insights, "saves");

    const connPatch: Parameters<typeof patchConnection>[1] = {
      lastSyncAt: new Date().toISOString(),
      status: "connected",
      error: null,
    };
    if (refreshed) {
      const sealed = seal(refreshed.access_token);
      connPatch.tokenEnc = sealed.tokenEnc;
      connPatch.tokenIv = sealed.tokenIv;
      connPatch.tokenTag = sealed.tokenTag;
      connPatch.expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    }
    await patchConnection(accountId, connPatch);

    const metrics = await getMetricsRow(accountId);
    if (metrics) {
      const patchKpi = (kpis: Kpi[], label: string, value: string) =>
        kpis.map((k) => (k.label === label ? { ...k, value } : k));
      let kpis = metrics.kpis;
      if (profile.followers_count != null) kpis = patchKpi(kpis, "Seguidores", formatCompact(profile.followers_count));
      if (reach != null) kpis = patchKpi(kpis, "Reach", formatCompact(reach));
      if (views != null) kpis = patchKpi(kpis, "Vistas", formatCompact(views));
      if (comments != null) kpis = patchKpi(kpis, "Comentarios", formatCompact(comments));
      if (saves != null) kpis = patchKpi(kpis, "Saves", formatCompact(saves));
      if (shares != null) kpis = patchKpi(kpis, "Shares", formatCompact(shares));
      metrics.kpis = kpis;
      if (reach != null) metrics.reachTotal = formatCompact(reach);
      await upsertMetrics(metrics);
    }

    return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al sincronizar";
    await patchConnection(accountId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
