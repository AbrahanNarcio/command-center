import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { getMetricsRow, upsertMetrics } from "@/lib/db";
import { AccountMetrics } from "@/lib/types";

type Params = { params: Promise<{ accountId: string }> };

const EDITABLE: (keyof Omit<AccountMetrics, "accountId" | "updatedAt">)[] = [
  "kpis", "growth", "growthNet", "engagementRate", "engagementMix", "reachByFormat",
  "reachTotal", "retention", "retentionAvg", "funnel", "ctrBio", "heatmap", "insights",
];

/**
 * Los campos color se usan en propiedades CSS (var(--accent)), así que solo se
 * aceptan formatos de color seguros; cualquier otra cosa cae a un gris neutro.
 * Evita inyección CSS vía valores como "red; background: url(...)".
 */
const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d.,\s%]+\)$|^hsla?\([\d.,\s%]+\)$/;
const safeColor = (c: unknown): string =>
  typeof c === "string" && SAFE_COLOR.test(c.trim()) ? c.trim() : "#8a93a6";

function sanitizeColors(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeColors);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k === "color" ? safeColor(v) : sanitizeColors(v);
    }
    return out;
  }
  return value;
}

export async function PUT(request: Request, { params }: Params) {
  const { accountId } = await params;
  const gate = await accountGate(accountId);
  if (gate.response) return gate.response;

  const body = await request.json();
  const current = await getMetricsRow(accountId);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

  const merged = { ...current } as AccountMetrics;
  for (const key of EDITABLE) {
    if (body[key] !== undefined) {
      (merged as unknown as Record<string, unknown>)[key] = sanitizeColors(body[key]);
    }
  }
  await upsertMetrics(merged);
  const fresh = await getMetricsRow(accountId);
  return NextResponse.json(fresh);
}
