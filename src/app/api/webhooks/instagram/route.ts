import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getConnectionByIgUser, insertIgMessage, upsertConversation } from "@/lib/db";
import { IG_CONFIG } from "@/lib/instagram";

/**
 * Webhook de mensajes de Instagram (producto Instagram → campo "messages").
 * - GET: verificación de Meta (hub.mode/hub.verify_token/hub.challenge).
 * - POST: notificaciones firmadas con X-Hub-Signature-256 (HMAC del app secret).
 * Siempre responde 200 rápido a eventos válidos: si Meta ve errores, reintenta
 * y puede terminar desactivando el webhook.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.IG_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verificación inválida" }, { status: 403 });
}

/** Valida la firma HMAC-SHA256 del payload con el app secret (timing-safe). */
function validSignature(rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=") || !IG_CONFIG.appSecret) return false;
  const theirs = header.slice("sha256=".length);
  const ours = createHmac("sha256", IG_CONFIG.appSecret).update(rawBody, "utf8").digest("hex");
  if (theirs.length !== ours.length) return false;
  return timingSafeEqual(Buffer.from(theirs, "hex"), Buffer.from(ours, "hex"));
}

/** Evento de mensajería (forma estándar de la plataforma de mensajes de Meta). */
type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let payload: { object?: string; entry?: { id?: string; messaging?: MessagingEvent[] }[] } | null = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  for (const entry of payload?.entry ?? []) {
    // entry.id = IG user id de la cuenta profesional que recibió/emitió el evento.
    const igAccountId = String(entry.id ?? "");
    if (!igAccountId) continue;
    const conn = await getConnectionByIgUser(igAccountId).catch(() => null);
    if (!conn) continue; // cuenta no conectada a Content OS: se ignora

    for (const ev of entry.messaging ?? []) {
      const mid = ev.message?.mid;
      const text = ev.message?.text ?? "";
      if (!mid) continue; // reacciones/lecturas u otros eventos: por ahora no se guardan
      // is_echo = lo envió la propia cuenta (p. ej. respondió desde la app de IG).
      const fromMe = Boolean(ev.message?.is_echo) || ev.sender?.id === igAccountId;
      const otherIgsid = fromMe ? ev.recipient?.id : ev.sender?.id;
      if (!otherIgsid) continue;

      const createdAt = new Date(ev.timestamp ?? Date.now()).toISOString();
      try {
        const convId = await upsertConversation({
          accountId: conn.accountId,
          igsid: String(otherIgsid),
          lastMessageAt: createdAt,
          lastSnippet: text,
          unread: !fromMe,
        });
        await insertIgMessage({
          id: mid,
          conversationId: convId,
          accountId: conn.accountId,
          fromMe,
          text,
          createdAt,
        });
      } catch (err) {
        // Falta la migración o error puntual: registrar y seguir (Meta reintenta).
        console.error("webhook instagram:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
