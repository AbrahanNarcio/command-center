import { NextResponse } from "next/server";
import { adminGate } from "@/lib/auth";
import { deleteConnectionRow } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ accountId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const { accountId } = await params;
  await deleteConnectionRow(accountId);
  return NextResponse.json({ ok: true });
}
