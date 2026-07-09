import { getConnection, getMetricsRow, patchConnection, upsertMetrics } from "./db";
import { open, seal } from "./crypto";
import {
  fetchAccountInsights,
  fetchProfile,
  formatCompact,
  metricValue,
  refreshLongToken,
} from "./instagram";
import { Kpi } from "./types";

// Guía: no recalcular en tiempo real en cada carga. Throttle mínimo entre syncs manuales.
const MIN_SYNC_MS = 30 * 60 * 1000;
// Refrescar el token si le quedan menos de 7 días de vida.
const REFRESH_BEFORE_MS = 7 * 24 * 3600 * 1000;
// El gráfico de crecimiento guarda hasta 30 puntos (uno por día).
const GROWTH_POINTS = 30;

export interface SyncResult {
  ok: boolean;
  throttled?: boolean;
  error?: string;
}

/** Sincroniza una cuenta conectada: KPIs desde la API oficial + snapshot diario de seguidores. */
export async function syncAccount(accountId: string, force: boolean): Promise<SyncResult> {
  const conn = await getConnection(accountId);
  if (!conn) return { ok: false, error: "Cuenta no conectada" };

  if (!force && conn.lastSyncAt) {
    const age = Date.now() - new Date(conn.lastSyncAt).getTime();
    if (age < MIN_SYNC_MS) return { ok: true, throttled: true };
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
    const interactions = metricValue(insights, "total_interactions");
    // ER = interacciones totales / alcance. La API no da un engagement rate directo.
    const engagementRate =
      interactions != null && reach ? `${((interactions / reach) * 100).toFixed(1)}%` : null;

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
      if (engagementRate) kpis = patchKpi(kpis, "Interaccion", engagementRate);
      metrics.kpis = kpis;
      if (reach != null) metrics.reachTotal = formatCompact(reach);
      if (engagementRate) metrics.engagementRate = `${engagementRate} ER`;

      // Snapshot diario de seguidores → gráfico de crecimiento real (máx. un punto por día).
      if (profile.followers_count != null) {
        const today = new Date().toISOString().slice(0, 10);
        const withStamp = metrics as typeof metrics & { growthStamp?: string };
        if (withStamp.growthStamp !== today) {
          let growth = Array.isArray(metrics.growth) ? [...metrics.growth] : [];
          if (!growth.some((v) => v > 0)) growth = []; // descartar placeholder de ceros
          growth.push(profile.followers_count);
          if (growth.length > GROWTH_POINTS) growth = growth.slice(-GROWTH_POINTS);
          metrics.growth = growth;
          withStamp.growthStamp = today;
          const net = growth[growth.length - 1] - growth[0];
          metrics.growthNet = `${net >= 0 ? "+" : ""}${formatCompact(Math.abs(net))}`;
        }
      }

      await upsertMetrics(metrics);
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al sincronizar";
    await patchConnection(accountId, { status: "error", error: message });
    return { ok: false, error: message };
  }
}
