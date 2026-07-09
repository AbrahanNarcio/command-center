import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getFullData, listClientUsers } from "@/lib/db";
import { supabaseConfigured } from "@/lib/supabase/admin";
import { PublicDb, toPublicConnection } from "@/lib/types";
import { isConfigured } from "@/lib/instagram";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "setup", detail: "Supabase no configurado. Completa las variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const isAdmin = session.role === "admin";
  // Viewer sin cuenta asignada: no ve nada.
  if (!isAdmin && !session.accountId) {
    return NextResponse.json({ error: "no-account", detail: "Tu acceso no tiene una cuenta asignada. Pide al administrador que la vincule." }, { status: 403 });
  }

  const data = await getFullData(isAdmin ? undefined : session.accountId!);
  const clientUsers = isAdmin ? await listClientUsers() : [];

  const payload: PublicDb = {
    accounts: data.accounts,
    pieces: data.pieces,
    sources: data.sources,
    metrics: data.metrics,
    connections: data.connections.map(toPublicConnection),
    igConfigured: isConfigured(),
    me: { email: session.email, role: session.role },
    clientUsers,
  };
  return NextResponse.json(payload);
}
