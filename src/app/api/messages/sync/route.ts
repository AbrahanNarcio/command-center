import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { open } from "@/lib/crypto";
import { getConnection, igTablesMissing, insertIgMessages, upsertConversation } from "@/lib/db";
import { fetchConversations, fetchIgUserProfile, subscribeMessaging } from "@/lib/instagram";

/**
 * Backfill de la bandeja + suscripción a webhooks. Se usa al activar Mensajes
 * en una cuenta: trae las conversaciones recientes de la API (Meta solo expone
 * ~20 mensajes por conversación) y suscribe la cuenta al campo "messages".
 * El flujo vivo lo mantiene el webhook.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  if (!accountId) return NextResponse.json({ error: "Falta accountId" }, { status: 400 });

  const gate = await accountGate(accountId);
  if (gate.response) return gate.response;

  const conn = await getConnection(accountId);
  if (!conn) return NextResponse.json({ error: "La cuenta no está conectada a Instagram." }, { status: 404 });
  if (!conn.scopes.includes("instagram_business_manage_messages")) {
    return NextResponse.json(
      { error: "La conexión no tiene el permiso de mensajes. Desconecta y vuelve a conectar la cuenta para otorgarlo." },
      { status: 409 },
    );
  }

  const token = open({ tokenEnc: conn.tokenEnc, tokenIv: conn.tokenIv, tokenTag: conn.tokenTag });

  let subscribed = false;
  let subscribeError: string | null = null;
  try {
    await subscribeMessaging(token);
    subscribed = true;
  } catch (err) {
    // Sin suscripción no llegan mensajes nuevos; el backfill igual puede servir.
    subscribeError = err instanceof Error ? err.message : "No se pudo suscribir a los webhooks.";
  }

  try {
    const conversations = await fetchConversations(token);
    let convCount = 0;
    let msgCount = 0;
    // Cada conversación se procesa en paralelo: perfil del contacto (foto),
    // un upsert de la conversación y sus mensajes en un solo lote.
    const results = await Promise.allSettled(
      conversations.map(async (conv) => {
        const ordered = [...conv.messages].sort(
          (a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime(),
        );
        // La persona del otro lado sale del primer mensaje que la identifique.
        let other: { id: string; username?: string } | undefined;
        for (const m of ordered) {
          const candidate = m.from?.id === conn.igUserId ? m.to?.data?.[0] : m.from;
          if (candidate?.id) { other = candidate; break; }
        }
        if (!other) return 0;
        const last = ordered[ordered.length - 1];
        // Foto de perfil (y username más fresco); tolerante: sin perfil no se cae.
        const profile = await fetchIgUserProfile(token, other.id);
        const convId = await upsertConversation({
          accountId,
          igsid: other.id,
          username: profile?.username ?? other.username ?? undefined,
          avatarUrl: profile?.profilePic ?? "",
          lastMessageAt: new Date(last.created_time).toISOString(),
          lastSnippet: last.message ?? "",
        });
        const rows = ordered
          .filter((m) => m.id)
          .map((m) => ({
            id: m.id,
            conversationId: convId,
            accountId,
            fromMe: m.from?.id === conn.igUserId,
            text: m.message ?? "",
            createdAt: new Date(m.created_time).toISOString(),
          }));
        await insertIgMessages(rows);
        return rows.length;
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value > 0) {
        convCount++;
        msgCount += r.value;
      }
    }
    return NextResponse.json({ ok: true, subscribed, subscribeError, conversations: convCount, messages: msgCount });
  } catch (err) {
    if (igTablesMissing(err)) {
      return NextResponse.json(
        { error: "Faltan las tablas de mensajes. Corre el bloque MENSAJES DE INSTAGRAM de supabase/schema.sql en Supabase." },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : "No se pudieron leer las conversaciones.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
