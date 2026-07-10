"use client";

import { useState } from "react";
import { RefreshCw, Unplug } from "lucide-react";
import { useStore } from "@/lib/store-context";
import { relativeTime } from "@/lib/utils";

const DONT = [
  "Scraping de followers o viewers de stories",
  "Automatizar DMs fríos",
  "Usar cuentas personales para funciones de negocio",
  "Pegar o guardar tokens en el frontend / texto plano",
  "Pedir permisos que no vas a usar",
  "Prometer métricas que la API no entrega",
  "Publicar automáticamente sin aprobación humana",
];

const SETUP = [
  "Crear una app en Meta for Developers (developers.facebook.com) y agregar el producto Instagram.",
  "Configurar Business Login for Instagram y registrar la Redirect URI (IG_REDIRECT_URI).",
  "Copiar App ID y App Secret a .env.local (IG_APP_ID / IG_APP_SECRET).",
  "Generar la clave de cifrado: openssl rand -hex 32 → TOKEN_ENC_KEY.",
  "Agregar tu cuenta como tester mientras la app esté en modo desarrollo.",
  "Pasar App Review antes de usarla con cuentas de clientes reales.",
];

function ClientAccessPanel() {
  const { activeAccount, clientUsers, createClientUser, deleteClientUser } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"client" | "editor">("client");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accountUsers = clientUsers.filter((u) => u.accountId === activeAccount?.id);
  // Accesos que quedaron sin cuenta (p. ej. si se borró la cuenta antes de la cascada):
  // mostrarlos siempre para poder quitarlos, si no quedan invisibles para siempre.
  const orphanUsers = clientUsers.filter((u) => !u.accountId);

  return (
    <section className="panel" style={{ marginTop: 12 }}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Acceso de clientes · {activeAccount?.handle}</p>
          <h2>Accesos para esta cuenta</h2>
        </div>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
        Dos niveles: <strong>Solo lectura</strong> ve su dashboard sin tocar nada. <strong>Editor</strong>{" "}
        puede mover todo lo de su propia cuenta (piezas, calendario, fuentes, métricas, reportes y
        conectar su Instagram), pero no ve ninguna otra cuenta.
      </p>

      {accountUsers.length > 0 && (
        <div className="checklist" style={{ marginBottom: 14 }}>
          {accountUsers.map((u) => (
            <div key={u.userId}>
              <span className="check">✓</span>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span>
                  {u.email}{" "}
                  <em style={{ color: "var(--muted)", fontStyle: "normal", fontSize: 12 }}>
                    · {u.role === "editor" ? "Editor" : "Solo lectura"}
                  </em>
                </span>
                <button className="button small danger" onClick={() => deleteClientUser(u.userId)}>
                  Quitar
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {orphanUsers.length > 0 && (
        <div className="alert" style={{ ["--accent" as string]: "var(--amber)", marginBottom: 14 }}>
          <strong>Accesos sin cuenta asignada</strong>
          <p>Su cuenta fue eliminada. Quítalos o vuelve a crearlos en otra cuenta.</p>
          {orphanUsers.map((u) => (
            <p key={u.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              {u.email}
              <button className="button small danger" onClick={() => deleteClientUser(u.userId)}>
                Quitar
              </button>
            </p>
          ))}
        </div>
      )}

      <div className="form-grid two">
        <label>
          Email del cliente
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
        </label>
        <label>
          Contraseña (mín. 12)
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="contraseña temporal fuerte" />
        </label>
        <label>
          Nivel de acceso
          <select value={role} onChange={(e) => setRole(e.target.value === "editor" ? "editor" : "client")}>
            <option value="client">Solo lectura (ve su dashboard)</option>
            <option value="editor">Editor (mueve todo lo de su cuenta)</option>
          </select>
        </label>
      </div>
      {error && (
        <div className="alert" style={{ ["--accent" as string]: "var(--coral)", marginTop: 10 }}>
          <p>{error}</p>
        </div>
      )}
      <div className="hero-actions" style={{ marginTop: 12 }}>
        <button
          className="button primary"
          disabled={busy || !activeAccount}
          onClick={async () => {
            if (!activeAccount) return;
            setBusy(true);
            setError(null);
            const err = await createClientUser(activeAccount.id, email, password, role);
            setBusy(false);
            if (err) setError(err);
            else {
              setEmail("");
              setPassword("");
              setRole("client");
            }
          }}
        >
          {busy ? "Creando…" : "Crear acceso"}
        </button>
      </div>
    </section>
  );
}

/** Estado tipo semáforo con el texto que lo explica. */
type Health = { tone: "ok" | "warn" | "bad"; text: string };

const TONE_COLOR: Record<Health["tone"], string> = {
  ok: "var(--green)",
  warn: "var(--amber)",
  bad: "var(--coral)",
};

function HealthPanel() {
  const { accounts, connections, metrics } = useStore();
  const now = Date.now();

  const hoursAgo = (iso: string | null | undefined) =>
    iso ? (now - new Date(iso).getTime()) / 3_600_000 : null;

  const syncHealth = (h: number | null): Health => {
    if (h == null) return { tone: "warn", text: "nunca" };
    if (h < 26) return { tone: "ok", text: `hace ${Math.round(h)} h` };
    if (h < 50) return { tone: "warn", text: `hace ${Math.round(h)} h (el cron no corrió hoy)` };
    return { tone: "bad", text: `hace ${Math.round(h / 24)} días (cron caído)` };
  };

  const tokenHealth = (iso: string | null | undefined): Health => {
    if (!iso) return { tone: "warn", text: "—" };
    const days = Math.round((new Date(iso).getTime() - now) / 86_400_000);
    if (days > 10) return { tone: "ok", text: `en ${days} días (se renueva solo)` };
    if (days > 0) return { tone: "warn", text: `en ${days} días` };
    return { tone: "bad", text: "vencido: reconectar la cuenta" };
  };

  // Próxima corrida del cron: todos los días a las 13:00 UTC.
  const next = new Date();
  next.setUTCHours(13, 0, 0, 0);
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  const nextLabel = next.toLocaleString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <section className="panel" style={{ marginTop: 12 }}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Salud del sistema</p>
          <h2>Sincronización, tokens y datos por cuenta</h2>
        </div>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
        Próxima sincronización automática: {next.getUTCDate() === new Date().getUTCDate() ? "hoy" : "mañana"}{" "}
        a las {nextLabel} (hora local). Verde = todo bien; ámbar = vigilar; rojo = actuar.
      </p>
      <div className="health-list">
        {accounts.map((acc) => {
          const conn = connections.find((c) => c.accountId === acc.id);
          const met = metrics.find((m) => m.accountId === acc.id);
          const items: [string, Health][] = conn
            ? [
                [
                  "Conexión",
                  conn.status === "error"
                    ? { tone: "bad", text: conn.error || "error" }
                    : { tone: "ok", text: `@${conn.username}` },
                ],
                ["Último sync", syncHealth(hoursAgo(conn.lastSyncAt))],
                ["Token", tokenHealth(conn.expiresAt)],
              ]
            : [
                ["Conexión", { tone: "warn", text: "sin Instagram (datos manuales)" }],
                [
                  "Métricas",
                  met?.updatedAt
                    ? { tone: "ok", text: `editadas hace ${Math.round(hoursAgo(met.updatedAt) ?? 0)} h` }
                    : { tone: "warn", text: "sin métricas" },
                ],
              ];
          return (
            <div className="health-row" key={acc.id}>
              <span className="health-name">
                <b>{acc.name}</b>
                <small>{acc.handle}</small>
              </span>
              {items.map(([label, h]) => (
                <span className="health-cell" key={label}>
                  <small>{label}</small>
                  <b style={{ color: TONE_COLOR[h.tone] }}>{h.text}</b>
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function SettingsView() {
  const { activeAccount, activeConnection, igConfigured, isAdmin, syncConnection, disconnectConnection } = useStore();
  const [busy, setBusy] = useState(false);

  // Cualquier conexión existente (incluso con error) se muestra como conectada,
  // con su alerta — nunca esconder el error volviendo al botón de conectar.
  const connected = Boolean(activeConnection);

  return (
    <>
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Instagram connector · {activeAccount?.handle}</p>
            <h2>{connected ? "Cuenta conectada" : igConfigured ? "Listo para conectar" : "Preparado, no configurado"}</h2>
          </div>
        </div>

        {!igConfigured && (
          <div className="locked">
            <strong>OFFLINE MOCK</strong>
            <p style={{ color: "var(--soft)", lineHeight: 1.5 }}>
              Todavía no hay credenciales de Meta cargadas, así que la app trabaja con datos de ejemplo. En
              cuanto completes el <code>.env.local</code> se habilita la conexión oficial (Instagram API con
              Instagram Login). Sin scraping, sin tokens en el navegador, sin riesgo de baneo.
            </p>
          </div>
        )}

        {igConfigured && !connected && (
          <>
            <p style={{ color: "var(--soft)", lineHeight: 1.5, marginBottom: 14 }}>
              Conecta <strong>{activeAccount?.name}</strong> con su cuenta de Instagram Business o Creator. Se
              abre la pantalla oficial de Meta, aceptas permisos, y el token se guarda cifrado en el servidor.
            </p>
            <a className="button primary" href={`/api/connect/${activeAccount?.id}/start`}>
              Conectar Instagram con OAuth
            </a>
          </>
        )}

        {connected && activeConnection && (
          <>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <label>
                Cuenta de Instagram
                <input disabled value={`@${activeConnection.username} · ${activeConnection.accountType}`} />
              </label>
              <label>
                IG User ID
                <input disabled value={activeConnection.igUserId} />
              </label>
              <label>
                Última sincronización
                <input disabled value={activeConnection.lastSyncAt ? relativeTime(activeConnection.lastSyncAt) : "nunca"} />
              </label>
              <label>
                Token expira
                <input disabled value={relativeTime(activeConnection.expiresAt)} />
              </label>
            </div>
            {activeConnection.status === "error" && activeConnection.error && (
              <div className="alert" style={{ ["--accent" as string]: "var(--coral)", marginBottom: 14 }}>
                <strong>Error de Instagram</strong>
                <p>{activeConnection.error}</p>
              </div>
            )}
            <div className="hero-actions" style={{ marginTop: 0 }}>
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await syncConnection(activeConnection.accountId);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RefreshCw size={15} /> {busy ? "Sincronizando…" : "Sincronizar ahora"}
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => disconnectConnection(activeConnection.accountId)}
              >
                <Unplug size={15} /> Desconectar
              </button>
            </div>
          </>
        )}

        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
          Flujo oficial: clic en Conectar → pantalla de Meta → aceptas permisos → Meta redirige con un{" "}
          <code>code</code> → el backend lo cambia por un token de larga duración y lo guarda cifrado
          (AES-256-GCM). Nunca en el frontend. Sync con throttle y refresh automático del token.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">{igConfigured ? "Estado" : "Setup pendiente"}</p>
            <h2>{igConfigured ? "Checklist técnico" : "Cómo activar la conexión"}</h2>
          </div>
        </div>

        {!igConfigured ? (
          <div className="checklist">
            {SETUP.map((step, i) => (
              <div key={i}>
                <span className="empty" />
                {step}
              </div>
            ))}
          </div>
        ) : (
          <div className="checklist">
            <div>
              <span className="check">✓</span>Credenciales de Meta cargadas
            </div>
            <div>
              <span className="check">✓</span>Cifrado de tokens activo (AES-256-GCM)
            </div>
            <div>
              <span className="check">✓</span>Tokens fuera del frontend
            </div>
            <div>
              {connected ? <span className="check">✓</span> : <span className="empty" />}
              Cuenta conectada por OAuth
            </div>
            <div>
              {activeConnection?.lastSyncAt ? <span className="check">✓</span> : <span className="empty" />}
              Primer sync de insights realizado
            </div>
            <div>
              <span className="empty" />
              Publicación con confirmación humana (App Review)
            </div>
          </div>
        )}

        <div className="panel-head" style={{ margin: "18px 0 10px" }}>
          <div>
            <p className="eyebrow">Reglas anti-baneo</p>
            <h2>Lo que no hay que hacer</h2>
          </div>
        </div>
        <div className="alerts">
          {DONT.map((rule) => (
            <div className="alert" key={rule} style={{ ["--accent" as string]: "var(--coral)" }}>
              <p>{rule}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
    {isAdmin && <HealthPanel />}
    {isAdmin && <ClientAccessPanel />}
    </>
  );
}
