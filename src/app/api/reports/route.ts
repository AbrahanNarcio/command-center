import { NextResponse } from "next/server";
import { adminGate, getSessionProfile } from "@/lib/auth";
import { getMetricsRow, insertReport, listReports } from "@/lib/db";
import { newId } from "@/lib/seed";
import { Report } from "@/lib/types";
import { adminClient } from "@/lib/supabase/admin";

/** La tabla `reports` se crea con supabase/schema.sql; si falta, avisar en claro. */
function tableMissing(err: unknown): boolean {
  return err instanceof Error && /reports/.test(err.message) && /(does not exist|schema cache)/i.test(err.message);
}

export async function GET(request: Request) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  let accountId = url.searchParams.get("account") ?? "";
  if (session.role !== "admin") {
    if (!session.accountId) return NextResponse.json({ error: "no-account" }, { status: 403 });
    accountId = session.accountId;
  }
  if (!accountId) return NextResponse.json({ error: "Falta ?account=" }, { status: 400 });

  try {
    return NextResponse.json(await listReports(accountId));
  } catch (err) {
    if (tableMissing(err)) {
      return NextResponse.json(
        { error: "Falta la tabla reports. Corre el bloque de reports de supabase/schema.sql en el SQL Editor de Supabase." },
        { status: 503 },
      );
    }
    throw err;
  }
}

export async function POST(request: Request) {
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const body = await request.json().catch(() => ({}));
  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  const note = typeof body.note === "string" ? body.note.slice(0, 600) : "";
  if (!accountId) return NextResponse.json({ error: "Falta accountId" }, { status: 400 });

  const metrics = await getMetricsRow(accountId);
  if (!metrics) return NextResponse.json({ error: "La cuenta no tiene métricas" }, { status: 404 });

  const { data: account } = await adminClient().from("accounts").select("handle").eq("id", accountId).maybeSingle();
  const stamp = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  const report: Report = {
    id: newId("rep"),
    accountId,
    title: `Reporte ${account?.handle ?? accountId} · ${stamp}`,
    note,
    createdAt: new Date().toISOString(),
    data: metrics,
  };

  try {
    await insertReport(report);
  } catch (err) {
    if (tableMissing(err)) {
      return NextResponse.json(
        { error: "Falta la tabla reports. Corre el bloque de reports de supabase/schema.sql en el SQL Editor de Supabase." },
        { status: 503 },
      );
    }
    throw err;
  }
  return NextResponse.json(report);
}
