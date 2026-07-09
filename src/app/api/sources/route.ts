import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { insertSource } from "@/lib/db";
import { newId } from "@/lib/seed";
import { Source } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const gate = await accountGate(String(body.accountId || ""));
  if (gate.response) return gate.response;
  const source: Source = {
    // El id llega solo al RESTABLECER una fuente eliminada (deshacer del toast).
    id: typeof body.id === "string" && body.id ? body.id : newId("src"),
    accountId: String(body.accountId),
    name: String(body.name || "Fuente"),
    type: String(body.type || "Notas"),
    summary: String(body.summary || ""),
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
  };
  await insertSource(source);
  return NextResponse.json(source, { status: 201 });
}
