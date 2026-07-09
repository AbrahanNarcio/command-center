import { NextResponse } from "next/server";
import crypto from "crypto";
import { canManageAccount, getSessionProfile } from "@/lib/auth";
import { appOrigin, buildAuthUrl, isConfigured } from "@/lib/instagram";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ accountId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { accountId } = await params;
  const origin = appOrigin(new URL(request.url).origin);

  const session = await getSessionProfile();
  if (!session || !canManageAccount(session, accountId)) {
    return NextResponse.redirect(`${origin}/?igerror=${encodeURIComponent("No tienes permiso para conectar esta cuenta")}`);
  }
  if (!isConfigured()) {
    return NextResponse.redirect(`${origin}/?igerror=${encodeURIComponent("Instagram no configurado (faltan variables de entorno)")}`);
  }

  const { data: account } = await adminClient().from("accounts").select("id").eq("id", accountId).maybeSingle();
  if (!account) {
    return NextResponse.redirect(`${origin}/?igerror=${encodeURIComponent("Cuenta inexistente")}`);
  }

  // CSRF-safe state: random nonce bound to the account, echoed back and checked in callback.
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = `${accountId}.${nonce}`;

  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    maxAge: 600,
    path: "/",
  });
  return res;
}
