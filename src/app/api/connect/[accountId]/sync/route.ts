import { NextResponse } from "next/server";
import { adminGate } from "@/lib/auth";
import { isConfigured } from "@/lib/instagram";
import { syncAccount } from "@/lib/sync";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ accountId: string }> };

export async function POST(request: Request, { params }: Params) {
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const { accountId } = await params;
  if (!isConfigured()) {
    return NextResponse.json({ error: "Instagram no configurado" }, { status: 400 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const result = await syncAccount(accountId, force);
  if (!result.ok) {
    const status = result.error === "Cuenta no conectada" ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, throttled: result.throttled ?? false, syncedAt: new Date().toISOString() });
}
