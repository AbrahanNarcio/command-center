import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { getMetricsRow, upsertMetrics } from "@/lib/db";
import { safeColor } from "@/lib/security";
import { AccountMetrics } from "@/lib/types";

type Params = { params: Promise<{ accountId: string }> };

const EDITABLE: (keyof Omit<AccountMetrics, "accountId" | "updatedAt">)[] = [
  "kpis", "growth", "growthNet", "engagementRate", "engagementMix", "reachByFormat",
  "reachTotal", "retention", "retentionAvg", "funnel", "ctrBio", "heatmap", "insights",
];


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
