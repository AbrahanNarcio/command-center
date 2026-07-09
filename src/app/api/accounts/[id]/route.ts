import { NextResponse } from "next/server";
import { adminGate } from "@/lib/auth";
import { deleteAccountRow, deleteClientUsersOf, updateAccountRow } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const { id } = await params;
  const body = await request.json();
  await updateAccountRow(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    handle: typeof body.handle === "string" ? body.handle : undefined,
    kind: body.kind === "propia" || body.kind === "cliente" ? body.kind : undefined,
    color: typeof body.color === "string" ? body.color : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const { id } = await params;
  // Los logins de cliente de esta cuenta no sirven sin ella: fuera también.
  await deleteClientUsersOf(id);
  await deleteAccountRow(id);
  return NextResponse.json({ ok: true });
}
