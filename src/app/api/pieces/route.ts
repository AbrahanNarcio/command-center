import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { insertPiece } from "@/lib/db";
import { newId } from "@/lib/seed";
import { ANGLES, Piece, PieceAngle } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const gate = await accountGate(String(body.accountId || ""));
  if (gate.response) return gate.response;
  const angle: PieceAngle = ANGLES.includes(body.angle) ? body.angle : "Problema";
  const piece: Piece = {
    // El id llega solo al RESTABLECER una pieza eliminada (deshacer del toast).
    id: typeof body.id === "string" && body.id ? body.id : newId("pz"),
    accountId: String(body.accountId),
    format: body.format || "Reel",
    status: body.status || "Idea",
    owner: String(body.owner || "Equipo"),
    day: body.day || "Lun",
    time: String(body.time || "10:00"),
    objective: body.objective || "DM",
    angle,
    hook: String(body.hook || ""),
    problema: String(body.problema || ""),
    solucion: String(body.solucion || ""),
    pruebaSocial: String(body.pruebaSocial || ""),
    cta: String(body.cta || ""),
    summary: String(body.summary || body.problema || ""),
    score: Math.max(0, Math.min(100, Number(body.score) || 70)),
  };
  await insertPiece(piece);
  return NextResponse.json(piece, { status: 201 });
}
