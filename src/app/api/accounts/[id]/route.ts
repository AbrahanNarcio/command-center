import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteAccountRow, updateAccountRow } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

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
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  await deleteAccountRow(id);
  return NextResponse.json({ ok: true });
}
