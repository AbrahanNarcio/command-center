import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { open } from "@/lib/crypto";
import { getConnection, getConversation, insertIgMessage, rowAccountId, upsertConversation } from "@/lib/db";
import { sendIgMessage } from "@/lib/instagram";

type Params = { params: Promise<{ id: string }> };

/** Responde un DM. Meta solo lo permite dentro de las 24h posteriores al último
 *  mensaje del usuario; fuera de la ventana devuelve error y se muestra tal cual. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await accountGate((await rowAccountId("ig_conversations", id)) ?? "");
  if (gate.response) return gate.response;

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!text) return NextResponse.json({ error: "Escribe un mensaje" }, { status: 400 });

  const conversation = await getConversation(id);
  if (!conversation) return NextResponse.json({ error: "not found" }, { status: 404 });

  const conn = await getConnection(conversation.accountId);
  if (!conn) return NextResponse.json({ error: "La cuenta no está conectada a Instagram." }, { status: 404 });

  const token = open({ tokenEnc: conn.tokenEnc, tokenIv: conn.tokenIv, tokenTag: conn.tokenTag });

  let messageId: string;
  try {
    const sent = await sendIgMessage(conn.igUserId, token, conversation.igsid, text);
    messageId = sent.message_id;
  } catch (err) {
    const raw = err instanceof Error ? err.message : "No se pudo enviar.";
    // La causa más común: ventana de 24h cerrada. Meta lo dice en inglés.
    const message = /24|window|time/i.test(raw)
      ? "No se pudo enviar: la ventana de 24 horas para responder ya se cerró. Se reabre cuando la persona vuelva a escribir."
      : raw;
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const createdAt = new Date().toISOString();
  await insertIgMessage({
    id: messageId,
    conversationId: id,
    accountId: conversation.accountId,
    fromMe: true,
    text,
    createdAt,
  });
  await upsertConversation({
    accountId: conversation.accountId,
    igsid: conversation.igsid,
    lastMessageAt: createdAt,
    lastSnippet: text,
    unread: false,
  });

  return NextResponse.json({ id: messageId, conversationId: id, fromMe: true, text, createdAt });
}
