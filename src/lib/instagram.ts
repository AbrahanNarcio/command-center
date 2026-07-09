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
  scopes: (process.env.IG_SCOPES ?? "instagram_business_basic,instagram_business_manage_insights").trim(),
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
  media_count?: number;
  followers_count?: number;
  follows_count?: number;
}

export async function fetchProfile(token: string): Promise<IgProfile> {
  const params = new URLSearchParams({
    fields: "user_id,username,account_type,media_count,followers_count,follows_count",
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

/**
 * Account-level insights. Metric names verified against the insights reference.
 * `impressions` intentionally omitted (removed for v22+).
 */
export async function fetchAccountInsights(igUserId: string, token: string): Promise<InsightValue[]> {
  const params = new URLSearchParams({
    metric: "reach,views,total_interactions,likes,comments,shares,saves,profile_links_taps",
    period: "day",
    metric_type: "total_value",
    access_token: token,
  });
  const res = await fetch(
    `${IG_CONFIG.graphHost}/${IG_CONFIG.apiVersion}/${igUserId}/insights?${params.toString()}`,
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "No se pudieron leer los insights.");
  }
  return (data.data ?? []) as InsightValue[];
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
