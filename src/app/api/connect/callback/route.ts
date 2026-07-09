import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canManageAccount, getSessionProfile } from "@/lib/auth";
import { upsertConnection } from "@/lib/db";
import { seal } from "@/lib/crypto";
import {
  IG_CONFIG,
  appOrigin,
  exchangeCodeForShortToken,
  exchangeForLongToken,
  fetchProfile,
  isConfigured,
} from "@/lib/instagram";
import { AccountConnection } from "@/lib/types";

export const dynamic = "force-dynamic";

function back(origin: string, params: Record<string, string>): NextResponse {
  const qs = new URLSearchParams(params).toString();
  const res = NextResponse.redirect(`${origin}/?${qs}`);
  res.cookies.delete("ig_oauth_state");
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin(url.origin);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  if (denied) {
    return back(origin, { igerror: url.searchParams.get("error_description") || "Permiso denegado en Meta" });
  }
  if (!isConfigured()) {
    return back(origin, { igerror: "Instagram no configurado" });
  }

  const session = await getSessionProfile();
  if (!session) {
    return back(origin, { igerror: "Inicia sesión para conectar la cuenta" });
  }
  if (!code || !state) {
    return back(origin, { igerror: "Respuesta de Meta incompleta (sin code/state)" });
  }

  const cookieStore = await cookies();
  const expected = cookieStore.get("ig_oauth_state")?.value;
  if (!expected || expected !== state) {
    return back(origin, { igerror: "State inválido (posible CSRF). Reintenta la conexión." });
  }

  const accountId = state.split(".")[0];
  if (!canManageAccount(session, accountId)) {
    return back(origin, { igerror: "No tienes permiso para conectar esta cuenta" });
  }

  try {
    const short = await exchangeCodeForShortToken(code);
    const long = await exchangeForLongToken(short.access_token);
    const profile = await fetchProfile(long.access_token);

    // Ban-safe requirement: only Business/Creator accounts are eligible for the API.
    const type = (profile.account_type || "").toUpperCase();
    if (type && !["BUSINESS", "CREATOR", "MEDIA_CREATOR"].includes(type)) {
      return back(origin, {
        igerror: `La cuenta @${profile.username} es ${profile.account_type}. Conviértela a Business o Creator para usar la API oficial.`,
      });
    }

    const sealed = seal(long.access_token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (long.expires_in ?? 60 * 24 * 3600) * 1000);

    const connection: AccountConnection = {
      accountId,
      igUserId: profile.user_id,
      username: profile.username,
      accountType: profile.account_type || "BUSINESS",
      scopes: IG_CONFIG.scopes.split(",").map((s) => s.trim()).filter(Boolean),
      tokenEnc: sealed.tokenEnc,
      tokenIv: sealed.tokenIv,
      tokenTag: sealed.tokenTag,
      expiresAt: expiresAt.toISOString(),
      connectedAt: now.toISOString(),
      lastSyncAt: null,
      status: "connected",
      error: null,
    };

    await upsertConnection(connection);
    return back(origin, { igconnected: profile.username });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al conectar";
    return back(origin, { igerror: message });
  }
}
