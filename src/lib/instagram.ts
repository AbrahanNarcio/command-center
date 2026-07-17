import { hasEncryptionKey } from "./crypto";

/**
 * Instagram Graph API client — "Instagram API with Instagram Login" (Business Login).
 * Official, ban-safe path: no scraping, no cold-DM automation, no personal accounts,
 * tokens never touch the frontend. Endpoints verified against Meta's docs:
 * https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 *
 * Meta changes scope/version names periodically — everything tunable is env-driven.
 */

export const IG_CONFIG = {
  appId: process.env.IG_APP_ID ?? "",
  appSecret: process.env.IG_APP_SECRET ?? "",
  redirectUri: process.env.IG_REDIRECT_URI ?? "",
  apiVersion: process.env.IG_API_VERSION ?? "v21.0",
  // Comma-separated. basic = perfil + media; manage_insights = métricas (requerido para el sync).
  // Add instagram_business_content_publish / _manage_messages / _manage_comments only if used.
  scopes: (process.env.IG_SCOPES ?? "instagram_business_basic,instagram_business_manage_insights,instagram_business_manage_messages").trim(),
  graphHost: "https://graph.instagram.com",
  authHost: "https://www.instagram.com",
  tokenHost: "https://api.instagram.com",
};

export function isConfigured(): boolean {
  return Boolean(IG_CONFIG.appId && IG_CONFIG.appSecret && IG_CONFIG.redirectUri && hasEncryptionKey());
}

/**
 * Public origin of the app, derived from the registered redirect URI.
 * Robust behind an HTTPS tunnel/proxy where request.url may show the internal host.
 */
export function appOrigin(fallback: string): string {
  try {
    return new URL(IG_CONFIG.redirectUri).origin;
  } catch {
    return fallback;
  }
}

/** Human-readable list of what still needs to be set up. */
export function missingConfig(): string[] {
  const missing: string[] = [];
  if (!IG_CONFIG.appId) missing.push("IG_APP_ID");
  if (!IG_CONFIG.appSecret) missing.push("IG_APP_SECRET");
  if (!IG_CONFIG.redirectUri) missing.push("IG_REDIRECT_URI");
  if (!hasEncryptionKey()) missing.push("TOKEN_ENC_KEY");
  return missing;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: IG_CONFIG.appId,
    redirect_uri: IG_CONFIG.redirectUri,
    response_type: "code",
    scope: IG_CONFIG.scopes,
    state,
  });
  return `${IG_CONFIG.authHost}/oauth/authorize?${params.toString()}`;
}

export interface ShortToken {
  access_token: string;
  user_id: string;
  permissions?: string;
}

export async function exchangeCodeForShortToken(code: string): Promise<ShortToken> {
  const body = new URLSearchParams({
    client_id: IG_CONFIG.appId,
    client_secret: IG_CONFIG.appSecret,
    grant_type: "authorization_code",
    redirect_uri: IG_CONFIG.redirectUri,
    code,
  });
  const res = await fetch(`${IG_CONFIG.tokenHost}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error_message || data?.error?.message || "No se pudo obtener el token corto.");
  }
  return data as ShortToken;
}

export interface LongToken {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds (~60 days)
}

export async function exchangeForLongToken(shortToken: string): Promise<LongToken> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: IG_CONFIG.appSecret,
    access_token: shortToken,
  });
  const res = await fetch(`${IG_CONFIG.graphHost}/access_token?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error?.message || "No se pudo obtener el token de larga duración.");
  }
  return data as LongToken;
}

export async function refreshLongToken(longToken: string): Promise<LongToken> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: longToken,
  });
  const res = await fetch(`${IG_CONFIG.graphHost}/refresh_access_token?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error?.message || "No se pudo refrescar el token.");
  }
  return data as LongToken;
}

export interface IgProfile {
  user_id: string;
  username: string;
  account_type: string;
  /** Nombre visible del perfil (para autocompletar la cuenta al conectar). */
  name?: string;
  media_count?: number;
  followers_count?: number;
  follows_count?: number;
  profile_picture_url?: string;
}

export async function fetchProfile(token: string): Promise<IgProfile> {
  const params = new URLSearchParams({
    fields: "user_id,username,account_type,name,media_count,followers_count,follows_count,profile_picture_url",
    access_token: token,
  });
  const res = await fetch(`${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/me?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || !data.user_id) {
    throw new Error(data?.error?.message || "No se pudo leer el perfil.");
  }
  return data as IgProfile;
}

export interface InsightValue {
  name: string;
  values: { value: number }[];
  total_value?: { value: number };
}

/** Lista completa de métricas de cuenta que intentamos leer (verificadas en la referencia). */
export const ACCOUNT_METRICS_FULL =
  "reach,views,total_interactions,likes,comments,shares,saves,replies,reposts,profile_links_taps,accounts_engaged,follows_and_unfollows";
/** Subconjunto núcleo que siempre funciona; fallback si el full falla en alguna versión. */
export const ACCOUNT_METRICS_CORE =
  "reach,views,total_interactions,likes,comments,shares,saves,profile_links_taps";

/**
 * Account-level insights. Metric names verified against the insights reference.
 * `impressions` intentionally omitted (removed for v22+).
 */
export async function fetchAccountInsights(
  igUserId: string,
  token: string,
  metrics: string = ACCOUNT_METRICS_FULL,
  windowDays?: number,
  endDaysAgo = 0,
): Promise<InsightValue[]> {
  const params = new URLSearchParams({
    metric: metrics,
    period: "day",
    metric_type: "total_value",
    access_token: token,
  });
  if (windowDays) {
    // total_value + since/until = suma del rango completo (máx. 30 días por petición).
    // endDaysAgo desplaza la ventana hacia atrás (p. ej. 30 = el periodo ANTERIOR de 30 días).
    const until = Math.floor(Date.now() / 1000) - endDaysAgo * 86400;
    params.set("since", String(until - windowDays * 86400));
    params.set("until", String(until));
  }
  const res = await fetch(
    `${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${igUserId}/insights?${params.toString()}`,
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "No se pudieron leer los insights.");
  }
  return (data.data ?? []) as InsightValue[];
}

export type FollowersDay = { date: string; gained: number; lost: number };

/**
 * Serie diaria de seguidores ganados y perdidos (últimos ~29 días).
 * follower_count da los buckets diarios de ganados en una llamada; el breakdown
 * ganados/perdidos solo existe como total por ventana, así que se pide una
 * ventana de ±60s alrededor del end_time de cada bucket (verificado: devuelve
 * exactamente ese día). Las llamadas por día van en paralelo.
 */
export async function fetchFollowersDaily(igUserId: string, token: string): Promise<FollowersDay[]> {
  const now = Math.floor(Date.now() / 1000);
  const qs = new URLSearchParams({
    metric: "follower_count",
    period: "day",
    since: String(now - 29 * 86400),
    until: String(now),
    access_token: token,
  });
  const res = await fetch(`${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${igUserId}/insights?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "No se pudo leer follower_count.");
  const buckets: { value?: number; end_time?: string }[] = data.data?.[0]?.values ?? [];

  const days = await Promise.all(
    buckets.map(async (b) => {
      if (!b.end_time) return null;
      const end = Math.floor(Date.parse(b.end_time) / 1000);
      const day: FollowersDay = { date: b.end_time.slice(0, 10), gained: b.value ?? 0, lost: 0 };
      try {
        const q = new URLSearchParams({
          metric: "follows_and_unfollows",
          period: "day",
          metric_type: "total_value",
          breakdown: "follow_type",
          since: String(end - 60),
          until: String(end + 60),
          access_token: token,
        });
        const r = await fetch(`${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${igUserId}/insights?${q}`);
        const j = await r.json();
        const results: { dimension_values?: string[]; value?: number }[] =
          j?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
        for (const item of results) {
          if (item.dimension_values?.[0] === "FOLLOWER") day.gained = item.value ?? day.gained;
          if (item.dimension_values?.[0] === "NON_FOLLOWER") day.lost = item.value ?? 0;
        }
      } catch {
        // Sin breakdown ese día: se queda gained del bucket y lost 0.
      }
      return day;
    }),
  );
  return days.filter((d): d is FollowersDay => d !== null);
}

export interface MediaItem {
  id: string;
  caption?: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS | STORY
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  permalink?: string;
  media_url?: string;
  /** Miniatura (solo VIDEO/REELS; para imágenes usar media_url). */
  thumbnail_url?: string;
}

/** Últimas publicaciones de la cuenta (1 sola llamada). */
export async function fetchMediaList(igUserId: string, token: string, limit = 50): Promise<MediaItem[]> {
  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,media_url,thumbnail_url",
    limit: String(limit),
    access_token: token,
  });
  const res = await fetch(
    `${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${igUserId}/media?${params.toString()}`,
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "No se pudieron leer las publicaciones.");
  }
  return (data.data ?? []) as MediaItem[];
}

/**
 * Insights de una publicación individual (una sola llamada para varias métricas).
 * Devuelve mapa métrica→valor; {} si la publicación no las soporta (p. ej. stories viejas).
 */
export interface StoryInsights {
  views: number | null;
  replies: number | null;
  /** Salidas de la historia (tap_exit). */
  exits: number | null;
  tapsBack: number | null;
  tapsForward: number | null;
}

/** Métricas de una historia activa: vistas/respuestas + navegación con breakdown. */
export async function fetchStoryInsights(mediaId: string, token: string): Promise<StoryInsights> {
  const out: StoryInsights = { views: null, replies: null, exits: null, tapsBack: null, tapsForward: null };
  try {
    const base = await fetchMediaMetrics(mediaId, token, "views,replies");
    out.views = base.views ?? null;
    out.replies = base.replies ?? null;
  } catch {
    // historia sin métricas base
  }
  try {
    const params = new URLSearchParams({
      metric: "navigation",
      breakdown: "story_navigation_action_type",
      access_token: token,
    });
    const res = await fetch(`${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${mediaId}/insights?${params}`);
    const data = await res.json();
    if (res.ok) {
      const results: { dimension_values?: string[]; value?: number }[] =
        data?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      for (const r of results) {
        const key = r.dimension_values?.[0];
        if (key === "tap_exit") out.exits = r.value ?? null;
        if (key === "tap_back") out.tapsBack = r.value ?? null;
        if (key === "tap_forward") out.tapsForward = r.value ?? null;
      }
    }
  } catch {
    // navegación no disponible
  }
  return out;
}

export async function fetchMediaMetrics(
  mediaId: string,
  token: string,
  metrics: string,
): Promise<Record<string, number>> {
  const params = new URLSearchParams({ metric: metrics, access_token: token });
  const res = await fetch(
    `${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${mediaId}/insights?${params.toString()}`,
  );
  const data = await res.json();
  if (!res.ok) return {};
  const out: Record<string, number> = {};
  for (const item of (data.data ?? []) as InsightValue[]) {
    const value = item.values?.[0]?.value ?? item.total_value?.value;
    if (typeof value === "number") out[item.name] = value;
  }
  return out;
}

/** Par (edad, género) → conteo, tal como lo entrega el breakdown combinado. */
export type DemographicPair = { age: string; gender: string; value: number };

/**
 * Demografía de un público con el breakdown combinado age,gender en UNA llamada
 * (verificado en vivo 2026-07-17): el que llama agrega los márgenes por edad y
 * por género. Géneros: F / M / U (sin especificar). Edades: 13-17 … 65+.
 * - follower_demographics: foto actual de los seguidores (timeframe irrelevante).
 * - reached/engaged_audience_demographics: requieren timeframe (last_14_days,
 *   last_30_days, last_90_days, this_week, this_month, prev_month).
 * Meta responde error si la cuenta no tiene suficientes seguidores (~100+):
 * el que llama debe tratarlo como "sin datos", no como falla del sync.
 */
export async function fetchAudienceDemographics(
  igUserId: string,
  token: string,
  metric: "follower_demographics" | "reached_audience_demographics" | "engaged_audience_demographics",
  timeframe: string,
): Promise<DemographicPair[]> {
  const params = new URLSearchParams({
    metric,
    period: "lifetime",
    metric_type: "total_value",
    breakdown: "age,gender",
    timeframe,
    access_token: token,
  });
  const res = await fetch(
    `${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${igUserId}/insights?${params.toString()}`,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `No se pudo leer ${metric}.`);
  const results: { dimension_values?: string[]; value?: number }[] =
    data?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  return results
    .filter((r) => r.dimension_values?.length === 2 && typeof r.value === "number")
    .map((r) => ({ age: r.dimension_values![0], gender: r.dimension_values![1], value: r.value as number }));
}

export function metricValue(insights: InsightValue[], name: string): number | null {
  const item = insights.find((i) => i.name === name);
  if (!item) return null;
  if (item.total_value) return item.total_value.value;
  return item.values?.[0]?.value ?? null;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/* ── Mensajería (DMs) — Instagram API with Instagram Login ──────
   Docs verificadas 2026-07-12:
   - Enviar:        POST {graph}/{ver}/{IG_ID}/messages  body {recipient:{id:IGSID}, message:{text}}
   - Conversaciones: GET {graph}/{ver}/me/conversations?platform=instagram
   - Mensajes:       GET {graph}/{ver}/{CONVERSATION_ID}?fields=messages  (solo ~20 recientes)
   - Detalle:        GET {graph}/{ver}/{MESSAGE_ID}?fields=id,created_time,from,to,message
   - Webhook:        producto Instagram, campo "messages"; además la cuenta debe
                     suscribirse con POST /me/subscribed_apps?subscribed_fields=messages
   Regla de plataforma: solo se puede responder dentro de las 24h posteriores al
   último mensaje del usuario. */

/** Envía un DM de texto. Lanza Error con el mensaje de Meta si falla
 *  (p. ej. fuera de la ventana de 24 horas). */
export async function sendIgMessage(
  igUserId: string,
  token: string,
  recipientIgsid: string,
  text: string,
): Promise<{ message_id: string }> {
  const res = await fetch(`${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipient: { id: recipientIgsid }, message: { text } }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.message_id) {
    throw new Error(data?.error?.message || "No se pudo enviar el mensaje.");
  }
  return data as { message_id: string };
}

/** Suscribe la cuenta profesional a los webhooks de mensajes de la app.
 *  Sin esto, Meta no envía notificaciones de DMs para esta cuenta. */
export async function subscribeMessaging(token: string): Promise<void> {
  const params = new URLSearchParams({ subscribed_fields: "messages", access_token: token });
  const res = await fetch(`${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/me/subscribed_apps?${params.toString()}`, {
    method: "POST",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || "No se pudo suscribir a los webhooks de mensajes.");
}

export interface IgApiMessage {
  id: string;
  created_time: string;
  from?: { id: string; username?: string };
  to?: { data?: { id: string; username?: string }[] };
  message?: string;
}
export interface IgApiConversation {
  id: string;
  messages: IgApiMessage[];
}

/** Backfill: conversaciones recientes con sus mensajes (Meta solo expone ~20
 *  mensajes por conversación; el histórico vivo lo mantiene el webhook). */
export async function fetchConversations(token: string): Promise<IgApiConversation[]> {
  const params = new URLSearchParams({ platform: "instagram", access_token: token });
  const res = await fetch(`${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/me/conversations?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || "No se pudieron leer las conversaciones.");
  const convs = (data?.data ?? []) as { id: string }[];

  // En paralelo: una conversación ilegible no tumba el backfill (null → se filtra).
  const results = await Promise.all(
    convs.slice(0, 25).map(async (conv): Promise<IgApiConversation | null> => {
      const mp = new URLSearchParams({
        fields: "messages{id,created_time,from,to,message}",
        access_token: token,
      });
      const mres = await fetch(`${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${conv.id}?${mp.toString()}`).catch(() => null);
      if (!mres?.ok) return null;
      const mdata = await mres.json().catch(() => null);
      return { id: conv.id, messages: (mdata?.messages?.data ?? []) as IgApiMessage[] };
    }),
  );
  return results.filter((c): c is IgApiConversation => c !== null);
}

/** Perfil público de un contacto por su IGSID (User Profile API; requiere el
 *  scope de mensajes). `profile_pic` puede faltar y su URL caduca — refrescar
 *  en cada sync. Devuelve null si Meta no expone el perfil. */
export async function fetchIgUserProfile(
  token: string,
  igsid: string,
): Promise<{ username?: string; profilePic?: string } | null> {
  const params = new URLSearchParams({ fields: "username,profile_pic", access_token: token });
  const res = await fetch(`${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${igsid}?${params.toString()}`).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  return { username: data.username, profilePic: data.profile_pic };
}
