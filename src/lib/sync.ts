import { getConnection, getMetricsRow, patchConnection, updateAccountRow, upsertMetrics } from "./db";
import { open, seal } from "./crypto";
import {
  ACCOUNT_METRICS_CORE,
  DemographicPair,
  MediaItem,
  fetchAccountInsights,
  fetchAudienceDemographics,
  fetchFollowersDaily,
  fetchMediaList,
  fetchMediaMetrics,
  fetchProfile,
  fetchStoryInsights,
  formatCompact,
  metricValue,
  refreshLongToken,
} from "./instagram";
import {
  AudienceBreakdown,
  AudienceSlice,
  FollowsPost,
  FunnelStep,
  HeatCell,
  Kpi,
  LabeledPct,
  LabeledValue,
  RecentPost,
  ReelRetention,
} from "./types";

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

/** Etiquetas legibles de género tal como los entrega Meta (F/M/U). */
const GENDER_ES: Record<string, string> = { F: "Mujeres", M: "Hombres", U: "Sin especificar" };
/** Orden natural de los rangos de edad de Meta. */
const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

/** Agrega los pares (edad, género) del breakdown combinado a sus dos márgenes:
 *  distribución por género y por edad, cada una con conteo y % del total. */
function aggregateDemographics(pairs: DemographicPair[]): AudienceBreakdown | null {
  const total = pairs.reduce((s, p) => s + p.value, 0);
  if (!total) return null;
  const margin = (key: "gender" | "age"): Map<string, number> => {
    const m = new Map<string, number>();
    for (const p of pairs) m.set(p[key], (m.get(p[key]) ?? 0) + p.value);
    return m;
  };
  const slice = (label: string, value: number): AudienceSlice => ({
    label,
    value,
    pct: Math.round((value / total) * 100),
  });
  const gender = [...margin("gender").entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([g, v]) => slice(GENDER_ES[g] ?? g, v));
  // Meta también devuelve "U" como EDAD desconocida: se traduce y va al final.
  const ageIdx = (a: string) => (AGE_ORDER.indexOf(a) === -1 ? 99 : AGE_ORDER.indexOf(a));
  const age = [...margin("age").entries()]
    .sort((a, b) => ageIdx(a[0]) - ageIdx(b[0]))
    .map(([a, v]) => slice(a === "U" ? "Sin especificar" : a, v));
  return { total, gender, age };
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

    // Arroba y nombre siempre espejo del perfil real (si se renombra en IG, aquí también).
    try {
      await updateAccountRow(accountId, {
        handle: `@${profile.username}`,
        ...(profile.name?.trim() ? { name: profile.name.trim() } : {}),
      });
    } catch {
      // No bloquear el sync por esto.
    }

    // Insights por ventana real (since/until). FULL con fallback a CORE por ventana.
    const fetchWindow = async (days?: number, endDaysAgo = 0) => {
      try {
        return await fetchAccountInsights(conn.igUserId, token, undefined, days, endDaysAgo);
      } catch {
        return await fetchAccountInsights(conn.igUserId, token, ACCOUNT_METRICS_CORE, days, endDaysAgo);
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

    // ── Ventanas ANTERIORES (mismo tamaño, desplazadas) para el delta comparativo ──
    const prevOf: Record<string, typeof insights | undefined> = {};
    await Promise.all(
      ([[1, 1], [7, 7], [30, 30]] as const).map(async ([days, off]) => {
        try {
          prevOf[String(days)] = await fetchWindow(days, off);
        } catch {
          // sin periodo anterior: el KPI queda sin delta
        }
      }),
    );

    /** Delta % contra el periodo anterior: "+12%" / "-8.3%" / "" si no se puede. */
    const dPct = (cur: number | null, prv: number | null | undefined): string => {
      if (cur == null || prv == null || prv === 0) return "";
      const p = ((cur - prv) / Math.abs(prv)) * 100;
      if (!Number.isFinite(p)) return "";
      return `${p >= 0 ? "+" : ""}${Math.abs(p) >= 10 ? p.toFixed(0) : p.toFixed(1)}%`;
    };

    // ── KPIs: set completo, todo real, por rango de tiempo ──
    const buildKpis = (ins: typeof insights, label: string, prev?: typeof insights): Kpi[] => {
      const g = (name: string) => metricValue(ins, name);
      const pg = (name: string) => (prev ? metricValue(prev, name) : null);
      const rReach = g("reach");
      const rViews = g("views");
      const rInteractions = g("total_interactions");
      const rLinkTaps = g("profile_links_taps");
      const rEr = rInteractions != null && rReach ? (rInteractions / rReach) * 100 : null;
      const rCtr = rLinkTaps != null && rReach ? (rLinkTaps / rReach) * 100 : null;
      const rFreq = rViews != null && rReach ? rViews / rReach : null;
      const rFollows = g("follows_and_unfollows");
      const pReach = pg("reach");
      const pViews = pg("views");
      const pInteractions = pg("total_interactions");
      const pLinkTaps = pg("profile_links_taps");
      const pEr = pInteractions != null && pReach ? (pInteractions / pReach) * 100 : null;
      const pCtr = pLinkTaps != null && pReach ? (pLinkTaps / pReach) * 100 : null;
      const pFreq = pViews != null && pReach ? pViews / pReach : null;
      const val = (n: number | null, fmt: (x: number) => string = formatCompact) =>
        n == null ? "—" : fmt(n);
      const kpis: Kpi[] = [
        { label: "Vistas", value: val(rViews), delta: dPct(rViews, pViews), detail: `Reproducciones · ${label}`, color: C.cyan },
        { label: "Alcance", value: val(rReach), delta: dPct(rReach, pReach), detail: `Cuentas alcanzadas · ${label}`, color: C.lime },
        { label: "Seguidores", value: val(profile.followers_count ?? null), delta: "", detail: "Total actual del perfil", color: C.green },
        { label: "Interacción", value: rEr == null ? "—" : `${rEr.toFixed(1)}%`, delta: dPct(rEr, pEr), detail: `Interacciones / alcance · ${label}`, color: C.pink },
        { label: "Me gusta", value: val(g("likes")), delta: dPct(g("likes"), pg("likes")), detail: `Recibidos · ${label}`, color: C.amber },
        { label: "Comentarios", value: val(g("comments")), delta: dPct(g("comments"), pg("comments")), detail: `Recibidos · ${label}`, color: C.violet },
        { label: "Guardados", value: val(g("saves")), delta: dPct(g("saves"), pg("saves")), detail: `Contenido guardado · ${label}`, color: C.cyan },
        { label: "Compartidos", value: val(g("shares")), delta: dPct(g("shares"), pg("shares")), detail: `Contenido compartido · ${label}`, color: C.lime },
        { label: "Cuentas con engagement", value: val(g("accounts_engaged")), delta: dPct(g("accounts_engaged"), pg("accounts_engaged")), detail: `Interactuaron contigo · ${label}`, color: C.green },
        { label: "Taps al link", value: val(rLinkTaps), delta: dPct(rLinkTaps, pLinkTaps), detail: `Clics en el link del perfil · ${label}`, color: C.coral },
        { label: "CTR bio", value: rCtr == null ? "—" : `${rCtr.toFixed(2)}%`, delta: dPct(rCtr, pCtr), detail: `Taps al link / alcance · ${label}`, color: C.pink },
        { label: "Frecuencia", value: rFreq == null ? "—" : `${rFreq.toFixed(1)}x`, delta: dPct(rFreq, pFreq), detail: `Vistas por cuenta alcanzada · ${label}`, color: C.amber },
      ];
      if (rFollows != null) {
        kpis[11] = { label: "Seguidores netos", value: formatCompact(rFollows), delta: dPct(rFollows, pg("follows_and_unfollows")), detail: `Follows - unfollows · ${label}`, color: C.amber };
      }
      return kpis;
    };

    metrics.kpis = buildKpis(insights, windowLabel, prevOf["30"]);

    // Rangos para el selector (el sync los deja listos; la UI cambia al instante).
    const kpiRanges: Record<string, Kpi[]> = { "30": metrics.kpis };
    for (const [days, label] of [[1, "hoy"], [7, "últimos 7 días"]] as [number, string][]) {
      try {
        kpiRanges[String(days)] = buildKpis(await fetchWindow(days), label, prevOf[String(days)]);
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
      // Código de colores por tramo de segundos (coherente en toda la app):
      // 0-3s azul · 3-8s verde · 8-15s amarillo · 15-30s naranja · 30s+ rojo.
      const colorForSeconds = (sec: number): string => {
        if (sec < 3) return C.cyan;
        if (sec < 8) return C.green;
        if (sec < 15) return C.lime;
        if (sec < 30) return C.amber;
        return C.coral;
      };
      metrics.reelsRetention = reelWatch.slice(0, 8).map(({ media: m, ms }): ReelRetention => ({
        label: (m.caption || "Reel").replace(/\s+/g, " ").slice(0, 46),
        value: `${(ms / 1000).toFixed(1)}s`,
        pct: Math.max(4, Math.round((ms / maxMs) * 100)),
        color: colorForSeconds(ms / 1000),
        thumb: m.thumbnail_url ?? m.media_url ?? "",
        permalink: m.permalink ?? "",
      }));
      const avgMs = reelWatch.reduce((sum, r) => sum + r.ms, 0) / reelWatch.length;
      metrics.retentionAvg = `${(avgMs / 1000).toFixed(1)}s`;

      // Curva por tramos (mismo formato que el mock): % de reels cuyo tiempo
      // promedio visto SUPERA cada tramo. Mismos colores por tramo que arriba.
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

    // ── Historias activas (duran 24 h: cada sync guarda las que encuentre) ──
    const activeStories = media.filter((m) => m.media_product_type === "STORY").slice(0, 10);
    metrics.stories = await Promise.all(
      activeStories.map(async (m) => {
        const ins = await fetchStoryInsights(m.id, token);
        const completion =
          ins.views && ins.exits != null ? Math.max(0, Math.round((1 - ins.exits / ins.views) * 100)) : null;
        const label = m.timestamp
          ? new Date(m.timestamp).toLocaleString("es-MX", {
              timeZone: SYNC_TZ,
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          : "Historia";
        return { label, views: ins.views, replies: ins.replies, exits: ins.exits, completion };
      }),
    );

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

    // ── Demografía de audiencia (género + edad, breakdown combinado en 1 llamada) ──
    // Si Meta no la expone (cuenta con pocos seguidores), se conserva lo anterior.
    try {
      const agg = aggregateDemographics(
        await fetchAudienceDemographics(conn.igUserId, token, "follower_demographics", "this_month"),
      );
      if (agg) metrics.audienceFollowers = agg;
    } catch {
      // sin demografía de seguidores este sync
    }
    // Meta puede responder VACÍO para una ventana y con datos para otra
    // (verificado en vivo: last_30_days vacío, this_month con datos). Se intenta
    // en cascada y se guarda la etiqueta del periodo que sí respondió.
    for (const [tf, label] of [
      ["last_30_days", "últimos 30 días"],
      ["this_month", "este mes"],
      ["last_14_days", "últimos 14 días"],
    ] as const) {
      try {
        const agg = aggregateDemographics(
          await fetchAudienceDemographics(conn.igUserId, token, "reached_audience_demographics", tf),
        );
        if (agg) {
          metrics.audienceReached = { ...agg, windowLabel: label };
          break;
        }
      } catch {
        // esta ventana no respondió; se intenta la siguiente
      }
    }

    // ── Seguidores ganados por publicación (métrica follows) ──
    // Meta SOLO la expone para publicaciones del feed (posts/carruseles); para
    // reels responde error de tipo de media (verificado en vivo 2026-07-17).
    const feedPosts = media.filter((m) => m.media_product_type === "FEED").slice(0, 25);
    if (feedPosts.length) {
      const withFollows = await Promise.all(
        feedPosts.map(async (m) => ({ m, follows: (await fetchMediaMetrics(m.id, token, "follows")).follows })),
      );
      const rankedFollows = withFollows
        .filter((x): x is { m: MediaItem; follows: number } => typeof x.follows === "number")
        .sort((a, b) => b.follows - a.follows)
        .slice(0, 10)
        .map(({ m, follows }): FollowsPost => ({
          id: m.id,
          thumb: m.thumbnail_url ?? m.media_url ?? "",
          permalink: m.permalink ?? "",
          caption: (m.caption ?? "").replace(/\s+/g, " ").slice(0, 90),
          follows,
          date: m.timestamp?.slice(0, 10) ?? "",
          format: formatLabel(m),
        }));
      if (rankedFollows.length) metrics.followsPosts = rankedFollows;
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

    // ── Serie diaria de seguidores ganados/perdidos (para la gráfica con selector) ──
    // La API solo da ~30 días hacia atrás, así que cada sync FUSIONA lo nuevo con lo
    // acumulado en la base: con el tiempo se juntan 60/90/365 días de histórico.
    try {
      const daily = await fetchFollowersDaily(conn.igUserId, token);
      if (daily.length) {
        const merged = new Map<string, { date: string; gained: number; lost: number }>();
        for (const d of metrics.followersDaily ?? []) merged.set(d.date, d);
        for (const d of daily) merged.set(d.date, d);
        metrics.followersDaily = [...merged.values()]
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-400);
        if (profile.followers_count != null) metrics.followersTotal = profile.followers_count;

        // Anomalías: días de los últimos 30 cuyo cambio neto se sale de lo normal
        // (mediana ± 6·MAD, robusto a los propios picos). Se guardan las 3 más recientes.
        const serie = metrics.followersDaily;
        if (serie.length >= 7) {
          const nets = serie.map((d) => d.gained - d.lost);
          const mid = (arr: number[]) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
          const med = mid(nets);
          const mad = mid(nets.map((n) => Math.abs(n - med))) || 1;
          metrics.anomalies = serie
            .slice(-30)
            .filter((d) => Math.abs(d.gained - d.lost - med) > Math.max(6 * mad, 120))
            .map((d) => ({ date: d.date, net: d.gained - d.lost }))
            .slice(-3);
        }
      }
    } catch {
      // Sin serie diaria: la gráfica cae al snapshot acumulado de siempre.
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
