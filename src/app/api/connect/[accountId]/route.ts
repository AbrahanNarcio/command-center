import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteConnectionRow } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ accountId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { accountId } = await params;
  await deleteConnectionRow(accountId);
  return NextResponse.json({ ok: true });
}
