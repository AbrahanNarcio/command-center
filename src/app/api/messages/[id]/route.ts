import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { getConversation, listIgMessages, rowAccountId, updateConversationRow } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** Hilo completo de una conversación (mensajes + datos de la conversación). */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await accountGate((await rowAccountId("ig_conversations", id)) ?? "");
  if (gate.response) return gate.response;

  const conversation = await getConversation(id);
  if (!conversation) return NextResponse.json({ error: "not found" }, { status: 404 });
  const messages = await listIgMessages(id);
  // Abrir el hilo lo marca como leído.
  if (conversation.unread) await updateConversationRow(id, { unread: false });
  return NextResponse.json({ conversation: { ...conversation, unread: false }, messages });
}

/** Lo NUESTRO de la conversación: etiquetas de lead, nota y leído/no leído. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await accountGate((await rowAccountId("ig_conversations", id)) ?? "");
  if (gate.response) return gate.response;

  const body = await request.json().catch(() => ({}));
  const patch: { tags?: string[]; note?: string; unread?: boolean } = {};
  if (Array.isArray(body.tags)) {
    patch.tags = (body.tags as unknown[])
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().slice(0, 30))
      .filter(Boolean)
      .slice(0, 10);
  }
  if (typeof body.note === "string") patch.note = body.note.slice(0, 1000);
  if (typeof body.unread === "boolean") patch.unread = body.unread;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  await updateConversationRow(id, patch);
  const fresh = await getConversation(id);
  return NextResponse.json(fresh);
}
