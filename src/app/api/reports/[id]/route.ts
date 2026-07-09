import { NextResponse } from "next/server";
import { adminGate } from "@/lib/auth";
import { deleteReportRow } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const { id } = await params;
  await deleteReportRow(id);
  return NextResponse.json({ ok: true });
}
