import { NextResponse } from "next/server";
import { accountGate, accountMemberGate, getSessionProfile } from "@/lib/auth";
import { getMetricsRow, insertReport, listReports } from "@/lib/db";
import { newId } from "@/lib/seed";
import { Report, ReportSection } from "@/lib/types";
import { adminClient } from "@/lib/supabase/admin";

/** Periodos que el reporte puede congelar. Solo los que tienen KPIs REALES por
 *  rango en el sync (kpiRanges "7"/"30") — no se ofrecen rangos sin datos. */
const PERIODS: Record<string, { days: number; label: string }> = {
  "7": { days: 7, label: "Últimos 7 días" },
  "30": { days: 30, label: "Últimos 30 días" },
};

const SECTION_KEYS: ReportSection[] = ["kpis", "growth", "mix", "topPosts", "retention", "funnel"];

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

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
  const body = await request.json().catch(() => ({}));

  // Restablecer un reporte recién eliminado (deshacer del toast): se reinsertan
  // los datos originales tal cual, sin tomar un snapshot nuevo.
  if (body.restore && typeof body.restore === "object") {
    const r = body.restore as Report;
    if (!r.id || !r.accountId || !r.data) return NextResponse.json({ error: "restore inválido" }, { status: 400 });
    // Tope de tamaño: evita inflar el almacenamiento con un payload gigante.
    if (JSON.stringify(r.data).length > 200_000) {
      return NextResponse.json({ error: "El reporte a restablecer es demasiado grande." }, { status: 413 });
    }
    const restoreGate = await accountGate(String(r.accountId));
    if (restoreGate.response) return restoreGate.response;
    const restored: Report = {
      id: String(r.id),
      accountId: String(r.accountId),
      title: String(r.title || "Reporte"),
      note: String(r.note || "").slice(0, 600),
      createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
      data: r.data,
    };
    await insertReport(restored);
    return NextResponse.json(restored);
  }

  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  const note = typeof body.note === "string" ? body.note.slice(0, 600) : "";
  if (!accountId) return NextResponse.json({ error: "Falta accountId" }, { status: 400 });

  // Generar reportes lo puede hacer cualquier usuario de la cuenta (incluido el
  // viewer/cliente); eliminarlos sigue siendo solo del equipo (accountGate).
  const gate = await accountMemberGate(accountId);
  if (gate.response) return gate.response;

  const metrics = await getMetricsRow(accountId);
  if (!metrics) return NextResponse.json({ error: "La cuenta no tiene métricas" }, { status: 404 });

  const period = typeof body.period === "string" && PERIODS[body.period] ? body.period : undefined;
  const sections = Array.isArray(body.sections)
    ? SECTION_KEYS.filter((s) => (body.sections as unknown[]).includes(s))
    : undefined;
  if (sections && sections.length === 0) {
    return NextResponse.json({ error: "Elige al menos una sección para el reporte." }, { status: 400 });
  }

  // Congelar el snapshot al periodo elegido: KPIs del rango real del sync y la
  // serie de seguidores recortada a esos días. Lo que no existe por periodo
  // (top posts, retención, funnel...) se guarda tal cual, sin re-etiquetarlo.
  const data: Report["data"] = { ...metrics };
  if (period) {
    const { days } = PERIODS[period];
    data.kpis = metrics.kpiRanges?.[period] ?? metrics.kpis;
    const daily = metrics.followersDaily;
    if (daily?.length) {
      // Totales reconstruidos hacia atrás desde followersTotal (igual que Control).
      const net = daily.map((d) => d.gained - d.lost);
      let running = metrics.followersTotal ?? 0;
      const totals = [...net]
        .reverse()
        .map((n) => {
          const t = running;
          running -= n;
          return t;
        })
        .reverse();
      const sliceNet = net.slice(-days);
      const netSum = sliceNet.reduce((a, b) => a + b, 0);
      data.growth = totals.slice(-days);
      data.growthNet = `${netSum >= 0 ? "+" : "-"}${compact(Math.abs(netSum))}`;
    } else if (Array.isArray(metrics.growth) && metrics.growth.length) {
      // Sin serie diaria: growth ya es un punto por día; recortar es honesto.
      const g = metrics.growth.slice(-days);
      const netSum = g[g.length - 1] - g[0];
      data.growth = g;
      data.growthNet = `${netSum >= 0 ? "+" : "-"}${compact(Math.abs(netSum))}`;
    }
  }
  data.reportMeta = {
    ...(period ? { period, periodLabel: PERIODS[period].label } : {}),
    ...(sections ? { sections } : {}),
  };

  const { data: account } = await adminClient().from("accounts").select("handle").eq("id", accountId).maybeSingle();
  const stamp = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  const report: Report = {
    id: newId("rep"),
    accountId,
    title: `Reporte ${account?.handle ?? accountId} · ${stamp}`,
    note,
    createdAt: new Date().toISOString(),
    data,
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
