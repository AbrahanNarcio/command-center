import { NextResponse } from "next/server";
import { adminGate } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { passwordProblem, rateLimited, tooManyResponse } from "@/lib/security";

export async function POST(request: Request) {
  const gate = await adminGate();
  if (gate.response) return gate.response;
  if (await rateLimited("clients", 10, 10 * 60_000)) return tooManyResponse();

  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const accountId = String(body.accountId || "");
  // 'client' = solo lectura (nombre histórico de viewer); 'editor' = mueve su propia cuenta.
  const role = body.role === "editor" ? "editor" : "client";

  if (!email.includes("@")) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  const weak = await passwordProblem(password);
  if (weak) return NextResponse.json({ error: weak }, { status: 400 });
  if (!accountId) return NextResponse.json({ error: "Falta la cuenta a vincular" }, { status: 400 });

  const supabase = adminClient();
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) {
    return NextResponse.json({ error: error?.message || "No se pudo crear el usuario" }, { status: 400 });
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    user_id: created.user.id,
    email,
    role,
    account_id: accountId,
  });
  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    const hint = /profiles_role_check/.test(profileError.message)
      ? " Falta la migración de roles: corre el bloque de roles de supabase/schema.sql en el SQL Editor de Supabase."
      : "";
    return NextResponse.json({ error: profileError.message + hint }, { status: 400 });
  }

  return NextResponse.json({ userId: created.user.id, email, accountId, role }, { status: 201 });
}
