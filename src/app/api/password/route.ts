import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";

/** Cambio de contraseña del usuario logueado (cualquier rol). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const msg = /different from the old/i.test(error.message)
      ? "La contraseña nueva debe ser distinta a la actual."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
