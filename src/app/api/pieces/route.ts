import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { insertPiece } from "@/lib/db";
import { newId } from "@/lib/seed";
import { Piece } from "@/lib/types";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const piece: Piece = {
    id: newId("pz"),
    accountId: String(body.accountId),
    format: body.format || "Reel",
    status: body.status || "Idea",
    owner: String(body.owner || "Equipo"),
    day: body.day || "Lun",
    time: String(body.time || "10:00"),
    objective: body.objective || "DM",
    hook: String(body.hook || ""),
    summary: String(body.summary || ""),
    cta: String(body.cta || ""),
    score: Math.max(0, Math.min(100, Number(body.score) || 70)),
  };
  await insertPiece(piece);
  return NextResponse.json(piece, { status: 201 });
}
