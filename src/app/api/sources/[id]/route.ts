import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteSourceRow } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  await deleteSourceRow(id);
  return NextResponse.json({ ok: true });
}
