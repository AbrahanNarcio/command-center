import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deletePieceRow, updatePieceRow } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const updated = await updatePieceRow(id, body);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  await deletePieceRow(id);
  return NextResponse.json({ ok: true });
}
