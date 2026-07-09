import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ userId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { userId } = await params;

  // Nunca permitir borrar un admin desde esta ruta.
  const { data: profile } = await adminClient()
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (profile.role === "admin") return NextResponse.json({ error: "No se puede eliminar un admin" }, { status: 400 });

  const { error } = await adminClient().auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
