import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { deleteReportRow, rowAccountId } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await accountGate((await rowAccountId("reports", id)) ?? "");
  if (gate.response) return gate.response;

  await deleteReportRow(id);
  return NextResponse.json({ ok: true });
}
