import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { deleteConnectionRow } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ accountId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { accountId } = await params;
  const gate = await accountGate(accountId);
  if (gate.response) return gate.response;

  await deleteConnectionRow(accountId);
  return NextResponse.json({ ok: true });
}
