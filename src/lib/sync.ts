import { getConnection, getMetricsRow, patchConnection, upsertMetrics } from "./db";
import { open, seal } from "./crypto";
import {
  ACCOUNT_METRICS_CORE,
  MediaItem,
  fetchAccountInsights,
  fetchMediaList,
  fetchMediaMetrics,
  fetchProfile,
  formatCompact,
  metricValue,
  refreshLongToken,
} from "./instagram";
import { FunnelStep, HeatCell, Kpi, LabeledPct, LabeledValue, RecentPost, ReelRetention } from "./types";

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
  cyan: "#7a8cff",
  lime: "#feda75",
  green: "#80ffb5",
  pink: "#ff5c9c",
  amber: "#ffa14e",
  violet: "#b05ce6",
  coral: "#ff5d51",
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
  if (media.media_product_type === "STORY") return "Historias";
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

    // Insights por ventana real (since/until). FULL con fallback a CORE por ventana.
    const fetchWindow = async (days?: number) => {
      try {
        return await fetchAccountInsights(conn.igUserId, token, undefined, days);
      } catch {
        return await fetchAccountInsights(conn.igUserId, token, ACCOUNT_METRICS_CORE, days);
      }
    };

    let insights;
    let windowLabel = "últimos 30 días";
    try {
      insights = await fetchWindow(30);
    } catch {
      windowLabel = "hoy (ventana diaria)";
      insights = await fetchWindow(undefined);
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

    // ── KPIs: set completo, todo real, por rango de tiempo ──
    const buildKpis = (ins: typeof insights, label: string): Kpi[] => {
      const g = (name: string) => metricValue(ins, name);
      const rReach = g("reach");
      const rViews = g("views");
      const rInteractions = g("total_interactions");
      const rLinkTaps = g("profile_links_taps");
      const rEr = rInteractions != null && rReach ? (rInteractions / rReach) * 100 : null;
      const rCtr = rLinkTaps != null && rReach ? (rLinkTaps / rReach) * 100 : null;
      const rFreq = rViews != null && rReach ? rViews / rReach : null;
      const rFollows = g("follows_and_unfollows");
      const val = (n: number | null, fmt: (x: number) => string = formatCompact) =>
        n == null ? "—" : fmt(n);
      const kpis: Kpi[] = [
        { label: "Vistas", value: val(rViews), delta: "", detail: `Reproducciones · ${label}`, color: C.cyan },
        { label: "Alcance", value: val(rReach), delta: "", detail: `Cuentas alcanzadas · ${label}`, color: C.lime },
        { label: "Seguidores", value: val(profile.followers_count ?? null), delta: "", detail: "Total actual del perfil", color: C.green },
        { label: "Interacción", value: rEr == null ? "—" : `${rEr.toFixed(1)}%`, delta: "", detail: `Interacciones / alcance · ${label}`, color: C.pink },
        { label: "Me gusta", value: val(g("likes")), delta: "", detail: `Recibidos · ${label}`, color: C.amber },
        { label: "Comentarios", value: val(g("comments")), delta: "", detail: `Recibidos · ${label}`, color: C.violet },
        { label: "Guardados", value: val(g("saves")), delta: "", detail: `Contenido guardado · ${label}`, color: C.cyan },
        { label: "Compartidos", value: val(g("shares")), delta: "", detail: `Contenido compartido · ${label}`, color: C.lime },
        { label: "Cuentas con engagement", value: val(g("accounts_engaged")), delta: "", detail: `Interactuaron contigo · ${label}`, color: C.green },
        { label: "Taps al link", value: val(rLinkTaps), delta: "", detail: `Clics en el link del perfil · ${label}`, color: C.coral },
        { label: "CTR bio", value: rCtr == null ? "—" : `${rCtr.toFixed(2)}%`, delta: "", detail: `Taps al link / alcance · ${label}`, color: C.pink },
        { label: "Frecuencia", value: rFreq == null ? "—" : `${rFreq.toFixed(1)}x`, delta: "", detail: `Vistas por cuenta alcanzada · ${label}`, color: C.amber },
      ];
      if (rFollows != null) {
        kpis[11] = { label: "Seguidores netos", value: formatCompact(rFollows), delta: "", detail: `Follows - unfollows · ${label}`, color: C.amber };
      }
      return kpis;
    };

    metrics.kpis = buildKpis(insights, windowLabel);

    // Rangos para el selector (el sync los deja listos; la UI cambia al instante).
    const kpiRanges: Record<string, Kpi[]> = { "30": metrics.kpis };
    for (const [days, label] of [[1, "hoy"], [7, "últimos 7 días"]] as [number, string][]) {
      try {
        kpiRanges[String(days)] = buildKpis(await fetchWindow(days), label);
      } catch {
        // sin ese rango; el selector lo omite
      }
    }
    metrics.kpiRanges = kpiRanges;

    if (reach != null) metrics.reachTotal = formatCompact(reach);
    if (er != null) metrics.engagementRate = `${er.toFixed(1)}% ER`;
    if (ctrBio != null) metrics.ctrBio = `${ctrBio.toFixed(2)}%`;

    // ── Donut: mix real de engagement ──
    const mixParts: [string, number | null, string][] = [
      ["Me gusta", likes, C.cyan],
      ["Comentarios", comments, C.lime],
      ["Guardados", saves, C.pink],
      ["Compartidos", shares, C.amber],
      ["Reposteos", reposts, C.coral],
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

    // ── Alcance por formato + watch time de reels (una llamada por publicación) ──
    const nonStories = media.filter((m) => m.media_product_type !== "STORY").slice(0, MEDIA_REACH_LIMIT);
    const formatReach = new Map<string, number>();
    const reelWatch: { media: MediaItem; ms: number }[] = [];
    for (const item of nonStories) {
      const isReel = item.media_product_type === "REELS";
      const values = await fetchMediaMetrics(
        item.id,
        token,
        isReel ? "reach,ig_reels_avg_watch_time" : "reach",
      );
      const r = values.reach;
      if (r != null) formatReach.set(formatLabel(item), (formatReach.get(formatLabel(item)) ?? 0) + r);
      if (isReel && values.ig_reels_avg_watch_time != null) {
        reelWatch.push({ media: item, ms: values.ig_reels_avg_watch_time });
      }
    }

    // ── Retención real de reels: tiempo promedio de visualización (la API no da caída por tramo) ──
    if (reelWatch.length) {
      const maxMs = Math.max(...reelWatch.map((r) => r.ms));
      const colors = [C.cyan, C.lime, C.pink, C.amber, C.violet, C.coral];
      metrics.reelsRetention = reelWatch.slice(0, 8).map(({ media: m, ms }, i): ReelRetention => ({
        label: (m.caption || "Reel").replace(/\s+/g, " ").slice(0, 46),
        value: `${(ms / 1000).toFixed(1)}s`,
        pct: Math.max(4, Math.round((ms / maxMs) * 100)),
        color: colors[i % colors.length],
        thumb: m.thumbnail_url ?? m.media_url ?? "",
        permalink: m.permalink ?? "",
      }));
      const avgMs = reelWatch.reduce((sum, r) => sum + r.ms, 0) / reelWatch.length;
      metrics.retentionAvg = `${(avgMs / 1000).toFixed(1)}s`;

      // Curva por tramos (mismo formato que el mock): % de reels cuyo tiempo
      // promedio visto SUPERA cada tramo. La API no da la curva real por espectador.
      const total = reelWatch.length;
      const over = (ms: number) => Math.round((reelWatch.filter((r) => r.ms >= ms).length / total) * 100);
      metrics.retention = [
        { label: "0-3s", pct: 100, color: C.cyan },
        { label: "3-8s", pct: over(3000), color: C.green },
        { label: "8-15s", pct: over(8000), color: C.lime },
        { label: "15-30s", pct: over(15000), color: C.amber },
        { label: "30s+", pct: over(30000), color: C.coral },
      ];
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

    // ── Foto de perfil + vista previa de publicaciones (URLs caducan: se renuevan aquí) ──
    if (profile.profile_picture_url) metrics.avatarUrl = profile.profile_picture_url;
    const recent = media
      .filter((m) => m.media_product_type !== "STORY")
      .map((m): RecentPost => ({
        id: m.id,
        thumb: m.thumbnail_url ?? m.media_url ?? "",
        permalink: m.permalink ?? "",
        caption: (m.caption ?? "").replace(/\s+/g, " ").slice(0, 80),
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
        format: formatLabel(m),
      }))
      .filter((m) => m.thumb)
      .slice(0, 12);
    if (recent.length) metrics.recentPosts = recent;

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
      ["Alcance", reach, C.cyan],
      ["Cuentas con engagement", engaged, C.lime],
      ["Interacciones", interactions, C.amber],
      ["Taps al link", linkTaps, C.pink],
      ["Seguidores netos", followsNet, C.green],
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
