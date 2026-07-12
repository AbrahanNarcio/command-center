"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, RefreshCcw, Send } from "lucide-react";
import { IgConversation, IgMessage, LEAD_TAGS, LEAD_TAG_COLORS, LeadTag } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import { trackBusy } from "@/lib/busy";
import { relativeTime } from "@/lib/utils";

/** Bandeja de DMs de Instagram + etiquetas de lead (las etiquetas son nuestras,
 *  viven en la base de Content OS; Meta solo aporta los mensajes). */
export default function MessagesView() {
  const { activeAccount, activeConnection, notify } = useStore();
  const [conversations, setConversations] = useState<IgConversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<IgMessage[] | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const threadEnd = useRef<HTMLDivElement>(null);

  const accountId = activeAccount?.id;
  const open = conversations?.find((c) => c.id === openId) ?? null;
  const hasMessagesScope = activeConnection?.scopes.includes("instagram_business_manage_messages");

  const load = useCallback(async () => {
    if (!accountId) return;
    setError(null);
    const res = await trackBusy(fetch(`/api/messages?account=${encodeURIComponent(accountId)}`));
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error || "No se pudieron cargar los mensajes.");
      setConversations([]);
      return;
    }
    setConversations(data as IgConversation[]);
  }, [accountId]);

  useEffect(() => {
    setConversations(null);
    setOpenId(null);
    setThread(null);
    load();
  }, [load]);

  const openConversation = async (id: string) => {
    setOpenId(id);
    setThread(null);
    const res = await trackBusy(fetch(`/api/messages/${id}`));
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error || "No se pudo abrir la conversación.");
      return;
    }
    setThread(data.messages as IgMessage[]);
    setConversations((prev) => prev?.map((c) => (c.id === id ? { ...c, unread: false } : c)) ?? prev);
    setTimeout(() => threadEnd.current?.scrollIntoView({ block: "end" }), 60);
  };

  const toggleTag = async (tag: LeadTag) => {
    if (!open) return;
    const tags = open.tags.includes(tag) ? open.tags.filter((t) => t !== tag) : [...open.tags, tag];
    // Optimista: la etiqueta responde al instante y el server confirma.
    setConversations((prev) => prev?.map((c) => (c.id === open.id ? { ...c, tags } : c)) ?? prev);
    try {
      await trackBusy(
        fetch(`/api/messages/${open.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags }),
        }),
      );
    } catch {
      load();
    }
  };

  const send = async () => {
    if (!open || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await trackBusy(
        fetch(`/api/messages/${open.id}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: reply }),
        }),
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "No se pudo enviar.");
        return;
      }
      setThread((prev) => [...(prev ?? []), data as IgMessage]);
      setConversations((prev) =>
        prev?.map((c) => (c.id === open.id ? { ...c, lastSnippet: reply, lastMessageAt: data.createdAt } : c)) ?? prev,
      );
      setReply("");
      setTimeout(() => threadEnd.current?.scrollIntoView({ block: "end" }), 60);
    } finally {
      setSending(false);
    }
  };

  const syncNow = async () => {
    if (!accountId) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await trackBusy(
        fetch("/api/messages/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        }),
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "No se pudo sincronizar.");
        return;
      }
      notify(`Bandeja sincronizada: ${data.conversations} conversaciones`);
      if (data.subscribeError) setError(`Webhook: ${data.subscribeError}`);
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const title = (c: IgConversation) => (c.username ? `@${c.username}` : `Usuario ${c.igsid.slice(-6)}`);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Bandeja de entrada · {activeAccount?.handle}</p>
          <h2>Mensajes</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
            Los DMs de Instagram llegan aquí en tiempo real. Responde dentro de las 24 horas
            posteriores al último mensaje de la persona (regla de Meta) y etiqueta cada lead para
            darle seguimiento.
          </p>
        </div>
        <div className="toolbar">
          <button className="button small" disabled={syncing || !activeConnection} onClick={syncNow}>
            {syncing ? <Loader2 size={13} className="spin" /> : <RefreshCcw size={13} />}{" "}
            {syncing ? "Sincronizando…" : "Sincronizar bandeja"}
          </button>
        </div>
      </div>

      {!activeConnection && (
        <div className="alert" style={{ ["--accent" as string]: "var(--amber)" }}>
          <p>Esta cuenta no está conectada a Instagram. Conéctala primero en Conexión IG.</p>
        </div>
      )}
      {activeConnection && !hasMessagesScope && (
        <div className="alert" style={{ ["--accent" as string]: "var(--amber)" }}>
          <strong>Falta el permiso de mensajes</strong>
          <p>
            Esta conexión se hizo antes de activar la mensajería. Desconecta y vuelve a conectar la
            cuenta en Conexión IG para otorgar el permiso de mensajes.
          </p>
        </div>
      )}
      {error && (
        <div className="alert" style={{ ["--accent" as string]: "var(--coral)", marginBottom: 12 }}>
          <p>{error}</p>
        </div>
      )}

      <div className={`inbox${openId ? " thread-open" : ""}`}>
        <div className="conv-list">
          {conversations === null ? (
            <div className="no-results">Cargando conversaciones…</div>
          ) : conversations.length === 0 ? (
            <div className="no-results">
              Sin conversaciones todavía. Cuando alguien escriba por DM aparecerá aquí; usa
              Sincronizar bandeja para traer las recientes.
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                className={`conv-item${c.id === openId ? " active" : ""}${c.unread ? " unread" : ""}`}
                onClick={() => openConversation(c.id)}
              >
                <span className="conv-top">
                  <b>{title(c)}</b>
                  <small>{c.lastMessageAt ? relativeTime(c.lastMessageAt) : ""}</small>
                </span>
                <span className="conv-snippet">{c.lastSnippet || "…"}</span>
                {c.tags.length > 0 && (
                  <span className="conv-tags">
                    {c.tags.map((t) => (
                      <em
                        key={t}
                        className="lead-tag"
                        style={{ ["--tag" as string]: LEAD_TAG_COLORS[t as LeadTag] ?? "var(--muted)" }}
                      >
                        {t}
                      </em>
                    ))}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="thread">
          {!open ? (
            <div className="no-results" style={{ margin: "auto" }}>
              Elige una conversación para ver el hilo.
            </div>
          ) : (
            <>
              <div className="thread-head">
                <button className="icon-button thread-back" onClick={() => setOpenId(null)} aria-label="Volver a la lista">
                  <ArrowLeft size={15} />
                </button>
                <strong>{title(open)}</strong>
                <div className="tagbar" role="group" aria-label="Etiquetas de lead">
                  {LEAD_TAGS.map((tag) => (
                    <button
                      key={tag}
                      className={`chip lead-chip${open.tags.includes(tag) ? " active" : ""}`}
                      style={{ ["--tag" as string]: LEAD_TAG_COLORS[tag] }}
                      aria-pressed={open.tags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="thread-scroll">
                {thread === null ? (
                  <div className="no-results">Cargando hilo…</div>
                ) : thread.length === 0 ? (
                  <div className="no-results">Sin mensajes guardados de esta conversación.</div>
                ) : (
                  thread.map((m) => (
                    <div className={`msg${m.fromMe ? " me" : ""}`} key={m.id}>
                      <p>{m.text || "(sin texto)"}</p>
                      <small>{relativeTime(m.createdAt)}</small>
                    </div>
                  ))
                )}
                <div ref={threadEnd} />
              </div>

              <div className="reply-row">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Escribe tu respuesta…"
                  aria-label="Respuesta"
                />
                <button className="button primary" disabled={sending || !reply.trim()} onClick={send}>
                  {sending ? <Loader2 size={15} className="spin" /> : <Send size={15} />}{" "}
                  {sending ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
