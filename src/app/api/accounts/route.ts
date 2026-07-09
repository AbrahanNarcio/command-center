import { NextResponse } from "next/server";
import { adminGate } from "@/lib/auth";
import { insertAccount, upsertMetrics } from "@/lib/db";
import { emptyMetrics, newId } from "@/lib/seed";
import { Account } from "@/lib/types";

export async function POST(request: Request) {
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const body = await request.json();
  const account: Account = {
    id: newId("acc"),
    name: String(body.name || "Cuenta nueva"),
    handle: String(body.handle || "@cuenta"),
    kind: body.kind === "propia" ? "propia" : "cliente",
    color: String(body.color || "#9b7cff"),
  };
  await insertAccount(account);
  // Cuentas nuevas arrancan vacías: métricas en cero, sin piezas ni fuentes.
  await upsertMetrics(emptyMetrics(account.id));
  return NextResponse.json(account, { status: 201 });
}
