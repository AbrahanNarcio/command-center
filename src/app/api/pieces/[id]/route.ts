import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { deletePieceRow, rowAccountId, updatePieceRow } from "@/lib/db";
import { dayFromDate } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await accountGate((await rowAccountId("pieces", id)) ?? "");
  if (gate.response) return gate.response;

  const body = await request.json();
  // Con fecha válida, el día de la semana se deriva de ella (coherencia).
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    body.day = dayFromDate(body.date);
  }
  const updated = await updatePieceRow(id, body);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await accountGate((await rowAccountId("pieces", id)) ?? "");
  if (gate.response) return gate.response;

  await deletePieceRow(id);
  return NextResponse.json({ ok: true });
}
