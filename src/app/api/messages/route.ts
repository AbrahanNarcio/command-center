import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { igTablesMissing, listConversations } from "@/lib/db";

const MIGRATION_HINT =
  "Faltan las tablas de mensajes. Corre el bloque MENSAJES DE INSTAGRAM de supabase/schema.sql en el SQL Editor de Supabase.";

/** Bandeja: conversaciones de una cuenta. Solo equipo (admin/editor de ESA cuenta). */
export async function GET(request: Request) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  let accountId = url.searchParams.get("account") ?? "";
  if (session.role === "admin") {
    if (!accountId) return NextResponse.json({ error: "Falta ?account=" }, { status: 400 });
  } else if (session.role === "editor" && session.accountId) {
    accountId = session.accountId;
  } else {
    // Los DMs los gestiona el equipo; el viewer no los ve (decisión de producto).
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    return NextResponse.json(await listConversations(accountId));
  } catch (err) {
    if (igTablesMissing(err)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 });
    throw err;
  }
}
