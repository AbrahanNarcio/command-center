import { getConnection, getMetricsRow, patchConnection, upsertMetrics } from "./db";
import { open, seal } from "./crypto";
import {
  ACCOUNT_METRICS_CORE,
  MediaItem,
  fetchAccountInsights,
  fetchMediaList,
  fetchMediaReach,
  fetchProfile,
  formatCompact,
  metricValue,
  refreshLongToken,
} from "./instagram";
import { FunnelStep, HeatCell, Kpi, LabeledPct, LabeledValue } from "./types";

// Guía: no recalcular en tiempo real en cada carga. Throttle mínimo entre syncs manuales.
const MIN_SYNC_MS = 30 * 60 * 1000;
// Refrescar el token si le quedan menos de 7 días de vida.
const REFRESH_BEFORE_MS = 7 * 24 * 3600 * 1000;
// El gráfico de crecimiento guarda hasta 30 puntos (uno por día).
const GROWTH_POINTS = 30;
// Publicaciones a las que se les pide reach individual (para alcance por formato).
const MEDIA_REACH_LIMIT = 20;
// Zona horaria para el heatmap de horarios de publicación (audiencia del usuario).
const SYNC_TZ = process.env.SYNC_TIMEZONE ?? "America/Mexico_City";

const TZ_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: SYNC_TZ,
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});
const WEEKDAY_ES: Record<string, string> = {
  Sun: "Dom", Mon: "Lun", Tue: "Mar", Wed: "Mie", Thu: "Jue", Fri: "Vie", Sat: "Sab",
};

/** Día y franja AM/PM de una fecha, en la zona horaria del negocio (no UTC). */
function localDaySlot(date: Date): { day: string; slot: "AM" | "PM" } | null {
  const parts = TZ_FMT.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  if (!weekday || Number.isNaN(hour)) return null;
  return { day: WEEKDAY_ES[weekday] ?? weekday, slot: hour < 12 ? "AM" : "PM" };
}

const C = {
  cyan: "#58e6ff",
  lime: "#d8ff63",
  green: "#80ffb5",
  pink: "#ff77bc",
  amber: "#ffc857",
  violet: "#9b7cff",
  coral: "#ff6f61",
};

export interface SyncResult {
  ok: boolean;
  throttled?: boolean;
  error?: string;
}

function pctOf(value: number | null, base: number | null): number {
  if (value == null || !base) return 0;
  return Math.max(1, Math.min(100, Math.round((value / base) * 100)));
}

function formatLabel(media: MediaItem): string {
  if (media.media_product_type === "REELS") return "Reels";
  if (media.media_product_type === "STORY") return "Stories";
  if (media.media_type === "CAROUSEL_ALBUM") return "Carruseles";
  return "Posts";
}

/** Sincroniza una cuenta conectada: KPIs y TODAS las gráficas desde la API oficial. */
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

    // Insights de cuenta: lista completa, con fallback al núcleo si alguna métrica no existe.
    let insights;
    try {
      insights = await fetchAccountInsights(conn.igUserId, token);
    } catch {
      insights = await fetchAccountInsights(conn.igUserId, token, ACCOUNT_METRICS_CORE);
    }

    // Publicaciones recientes (para formato, top posts y heatmap).
    let media: MediaItem[] = [];
    try {
      media = await fetchMediaList(conn.igUserId, token);
    } catch {
      media = [];
    }

    const reach = metricValue(insights, "reach");
    const views = metricValue(insights, "views");
    const likes = metricValue(insights, "likes");
    const comments = metricValue(insights, "comments");
    const shares = metricValue(insights, "shares");
    const saves = metricValue(insights, "saves");
    const reposts = metricValue(insights, "reposts");
    const interactions = metricValue(insights, "total_interactions");
    const linkTaps = metricValue(insights, "profile_links_taps");
    const engaged = metricValue(insights, "accounts_engaged");
    const followsNet = metricValue(insights, "follows_and_unfollows");

    const er = interactions != null && reach ? (interactions / reach) * 100 : null;
    const ctrBio = linkTaps != null && reach ? (linkTaps / reach) * 100 : null;
    const frequency = views != null && reach ? views / reach : null;

    // ── Persistir conexión (token refrescado si aplica) ──
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
    if (!metrics) return { ok: true };

    // ── KPIs: set completo, todo real ──
    const val = (n: number | null, fmt: (x: number) => string = formatCompact) =>
      n == null ? "—" : fmt(n);
    metrics.kpis = [
      { label: "Vistas", value: val(views), delta: "", detail: "Views en 30d", color: C.cyan },
      { label: "Reach", value: val(reach), delta: "", detail: "Cuentas alcanzadas", color: C.lime },
      { label: "Seguidores", value: val(profile.followers_count ?? null), delta: "", detail: "Total actual", color: C.green },
      { label: "Interaccion", value: er == null ? "—" : `${er.toFixed(1)}%`, delta: "", detail: "Interacciones / reach", color: C.pink },
      { label: "Likes", value: val(likes), delta: "", detail: "Me gusta", color: C.amber },
      { label: "Comentarios", value: val(comments), delta: "", detail: "Señal de conversación", color: C.violet },
      { label: "Saves", value: val(saves), delta: "", detail: "Contenido de alta utilidad", color: C.cyan },
      { label: "Shares", value: val(shares), delta: "", detail: "Contenido reenviable", color: C.lime },
      { label: "Cuentas con engagement", value: val(engaged), delta: "", detail: "Interactuaron con tu contenido", color: C.green },
      { label: "Taps al link", value: val(linkTaps), delta: "", detail: "Clics en links del perfil", color: C.coral },
      { label: "CTR bio", value: ctrBio == null ? "—" : `${ctrBio.toFixed(2)}%`, delta: "", detail: "Taps al link / reach", color: C.pink },
      { label: "Frecuencia", value: frequency == null ? "—" : `${frequency.toFixed(1)}x`, delta: "", detail: "Views por cuenta alcanzada", color: C.amber },
    ];
    if (followsNet != null) {
      metrics.kpis[11] = { label: "Follows netos", value: formatCompact(followsNet), delta: "", detail: "Seguidos - dejados de seguir (día)", color: C.amber };
    }
    if (reach != null) metrics.reachTotal = formatCompact(reach);
    if (er != null) metrics.engagementRate = `${er.toFixed(1)}% ER`;
    if (ctrBio != null) metrics.ctrBio = `${ctrBio.toFixed(2)}%`;

    // ── Donut: mix real de engagement ──
    const mixParts: [string, number | null, string][] = [
      ["Likes", likes, C.cyan],
      ["Comentarios", comments, C.lime],
      ["Saves", saves, C.pink],
      ["Shares", shares, C.amber],
      ["Reposts", reposts, C.coral],
    ];
    const mixTotal = mixParts.reduce((s, [, v]) => s + (v ?? 0), 0);
    if (mixTotal > 0) {
      metrics.engagementMix = mixParts
        .filter(([, v]) => v != null && v > 0)
        .map(([label, v, color]): LabeledValue => ({
          label,
          value: `${Math.round(((v as number) / mixTotal) * 100)}%`,
          color,
        }));
    }

    // ── Alcance por formato: reach real de las últimas publicaciones ──
    const nonStories = media.filter((m) => m.media_product_type !== "STORY").slice(0, MEDIA_REACH_LIMIT);
    const formatReach = new Map<string, number>();
    for (const item of nonStories) {
      const r = await fetchMediaReach(item.id, token);
      if (r != null) formatReach.set(formatLabel(item), (formatReach.get(formatLabel(item)) ?? 0) + r);
    }
    if (formatReach.size > 0) {
      const max = Math.max(...formatReach.values());
      const colors = [C.cyan, C.lime, C.pink, C.amber, C.green];
      metrics.reachByFormat = [...formatReach.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, total], i): LabeledPct => ({
          label,
          pct: Math.max(4, Math.round((total / max) * 100)),
          color: colors[i % colors.length],
        }));
    }

    // ── Top publicaciones reales (por likes + comentarios) ──
    const ranked = media
      .filter((m) => m.media_product_type !== "STORY")
      .map((m) => ({ media: m, score: (m.like_count ?? 0) + (m.comments_count ?? 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    if (ranked.length) {
      const top = ranked[0].score || 1;
      const colors = [C.cyan, C.green, C.lime, C.amber, C.coral];
      metrics.topPosts = ranked.map(({ media: m, score }, i): FunnelStep => ({
        label: (m.caption || formatLabel(m)).replace(/\s+/g, " ").slice(0, 52),
        value: formatCompact(score),
        pct: Math.max(4, Math.round((score / top) * 100)),
        color: colors[i % colors.length],
      }));
    }

    // ── Funnel real: reach → engagement → interacciones → taps → follows ──
    const funnelParts: [string, number | null, string][] = [
      ["Reach", reach, C.cyan],
      ["Cuentas con engagement", engaged, C.lime],
      ["Interacciones", interactions, C.amber],
      ["Taps al link", linkTaps, C.pink],
      ["Follows netos", followsNet, C.green],
    ];
    const funnelReal = funnelParts.filter(([, v]) => v != null);
    if (funnelReal.length >= 3) {
      metrics.funnel = funnelReal.map(([label, v, color]): FunnelStep => ({
        label,
        value: formatCompact(v as number),
        pct: pctOf(v, reach),
        color,
      }));
    }

    // ── Heatmap real: interacción promedio por día/franja de publicación ──
    if (media.length >= 5) {
      const buckets = new Map<string, { sum: number; n: number }>();
      for (const m of media) {
        if (!m.timestamp) continue;
        const local = localDaySlot(new Date(m.timestamp));
        if (!local) continue;
        const key = `${local.day}|${local.slot}`;
        const cur = buckets.get(key) ?? { sum: 0, n: 0 };
        cur.sum += (m.like_count ?? 0) + (m.comments_count ?? 0);
        cur.n += 1;
        buckets.set(key, cur);
      }
      const avgs = new Map<string, number>();
      for (const [key, { sum, n }] of buckets) avgs.set(key, sum / n);
      const maxAvg = Math.max(1, ...avgs.values());
      const order = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
      const cells: HeatCell[] = [];
      for (const slot of ["AM", "PM"]) {
        for (const day of order) {
          const avg = avgs.get(`${day}|${slot}`) ?? 0;
          cells.push({ day, hour: slot, heat: Math.round((avg / maxAvg) * 100) });
        }
      }
      metrics.heatmap = cells;
    }

    // ── Snapshot diario de seguidores → gráfico de crecimiento real ──
    if (profile.followers_count != null) {
      const today = new Date().toISOString().slice(0, 10);
      if (metrics.growthStamp !== today) {
        let growth = Array.isArray(metrics.growth) ? [...metrics.growth] : [];
        if (!growth.some((v) => v > 0)) growth = []; // descartar placeholder de ceros
        growth.push(profile.followers_count);
        if (growth.length > GROWTH_POINTS) growth = growth.slice(-GROWTH_POINTS);
        metrics.growth = growth;
        metrics.growthStamp = today;
        const net = growth[growth.length - 1] - growth[0];
        metrics.growthNet = `${net >= 0 ? "+" : "-"}${formatCompact(Math.abs(net))}`;
      }
    }

    await upsertMetrics(metrics);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al sincronizar";
    await patchConnection(accountId, { status: "error", error: message });
    return { ok: false, error: message };
  }
}
