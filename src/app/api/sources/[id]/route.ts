import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { deleteSourceRow, rowAccountId, updateSourceRow } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await accountGate((await rowAccountId("sources", id)) ?? "");
  if (gate.response) return gate.response;

  const body = await request.json();
  await updateSourceRow(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    type: typeof body.type === "string" ? body.type : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await accountGate((await rowAccountId("sources", id)) ?? "");
  if (gate.response) return gate.response;

  await deleteSourceRow(id);
  return NextResponse.json({ ok: true });
}
