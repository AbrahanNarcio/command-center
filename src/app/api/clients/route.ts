import { NextResponse } from "next/server";
import { adminGate } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const gate = await adminGate();
  if (gate.response) return gate.response;

  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const accountId = String(body.accountId || "");

  if (!email.includes("@")) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
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
    role: "client",
    account_id: accountId,
  });
  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ userId: created.user.id, email, accountId }, { status: 201 });
}
