import { NextResponse } from "next/server";
import { adminGate } from "@/lib/auth";
import { deleteSourceRow, updateSourceRow } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const { id } = await params;
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
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const { id } = await params;
  await deleteSourceRow(id);
  return NextResponse.json({ ok: true });
}
