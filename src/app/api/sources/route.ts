import { NextResponse } from "next/server";
import { adminGate } from "@/lib/auth";
import { insertSource } from "@/lib/db";
import { newId } from "@/lib/seed";
import { Source } from "@/lib/types";

export async function POST(request: Request) {
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const body = await request.json();
  const source: Source = {
    id: newId("src"),
    accountId: String(body.accountId),
    name: String(body.name || "Fuente"),
    type: String(body.type || "Notas"),
    summary: String(body.summary || ""),
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
  };
  await insertSource(source);
  return NextResponse.json(source, { status: 201 });
}
