import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverClient } from "@/lib/supabase/server";
import { crossOriginResponse, passwordProblem, rateLimited, sameOriginOk, tooManyResponse } from "@/lib/security";

/** Cambio de contraseña del usuario logueado (cualquier rol). Exige la actual. */
export async function POST(request: Request) {
  if (!(await sameOriginOk())) return crossOriginResponse();
  if (await rateLimited("password", 5, 15 * 60_000)) return tooManyResponse();

  const body = await request.json().catch(() => ({}));
  const current = String(body.current || "");
  const password = String(body.password || "");

  const strength = await passwordProblem(password);
  if (strength) return NextResponse.json({ error: strength }, { status: 400 });

  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Reautenticación: verificar la contraseña actual en un cliente aparte (sin tocar
  // las cookies de sesión). Así una sesión robada no basta para cambiar la clave.
  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: badCurrent } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (badCurrent) {
    return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const msg = /different from the old/i.test(error.message)
      ? "La contraseña nueva debe ser distinta a la actual."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
