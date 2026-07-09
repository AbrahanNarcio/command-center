import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getMetricsRow, upsertMetrics } from "@/lib/db";
import { AccountMetrics } from "@/lib/types";

type Params = { params: Promise<{ accountId: string }> };

const EDITABLE: (keyof Omit<AccountMetrics, "accountId" | "updatedAt">)[] = [
  "kpis", "growth", "growthNet", "engagementRate", "engagementMix", "reachByFormat",
  "reachTotal", "retention", "retentionAvg", "funnel", "ctrBio", "heatmap", "insights",
];

export async function PUT(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { accountId } = await params;
  const body = await request.json();
  const current = await getMetricsRow(accountId);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

  const merged = { ...current } as AccountMetrics;
  for (const key of EDITABLE) {
    if (body[key] !== undefined) {
      (merged as unknown as Record<string, unknown>)[key] = body[key];
    }
  }
  await upsertMetrics(merged);
  const fresh = await getMetricsRow(accountId);
  return NextResponse.json(fresh);
}
