import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { insertPiece } from "@/lib/db";
import { newId } from "@/lib/seed";
import { ANGLES, dayFromDate, Piece, PieceAngle } from "@/lib/types";

/** Valida una fecha en formato YYYY-MM-DD; devuelve undefined si no lo es. */
function cleanDate(v: unknown): string | undefined {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

export async function POST(request: Request) {
  const body = await request.json();
  const gate = await accountGate(String(body.accountId || ""));
  if (gate.response) return gate.response;
  const angle: PieceAngle = ANGLES.includes(body.angle) ? body.angle : "Problema";
  const date = cleanDate(body.date);
  const piece: Piece = {
    // El id llega solo al RESTABLECER una pieza eliminada (deshacer del toast).
    id: typeof body.id === "string" && body.id ? body.id : newId("pz"),
    accountId: String(body.accountId),
    format: body.format || "Reel",
    status: body.status || "Idea",
    owner: String(body.owner || "Equipo"),
    // Si hay fecha, el día de la semana se deriva de ella (coherencia).
    day: date ? dayFromDate(date) : body.day || "Lun",
    time: String(body.time || "10:00"),
    objective: body.objective || "DM",
    date,
    angle,
    hook: String(body.hook || ""),
    cuerpo: String(body.cuerpo || ""),
    cta: String(body.cta || ""),
    summary: String(body.summary || body.cuerpo || ""),
    score: Math.max(0, Math.min(100, Number(body.score) || 70)),
  };
  await insertPiece(piece);
  return NextResponse.json(piece, { status: 201 });
}
