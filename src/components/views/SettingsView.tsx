"use client";

import { useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accountUsers = clientUsers.filter((u) => u.accountId === activeAccount?.id);

  return (
    <section className="panel" style={{ marginTop: 12 }}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Acceso de clientes · {activeAccount?.handle}</p>
          <h2>Login de solo lectura para esta cuenta</h2>
        </div>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
        El cliente entra con estas credenciales y ve únicamente su dashboard (métricas, pipeline y
        calendario), sin poder editar nada.
      </p>

      {accountUsers.length > 0 && (
        <div className="checklist" style={{ marginBottom: 14 }}>
          {accountUsers.map((u) => (
            <div key={u.userId}>
              <span className="check">✓</span>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {u.email}
                <button className="button small danger" onClick={() => deleteClientUser(u.userId)}>
                  Quitar
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="form-grid two">
        <label>
          Email del cliente
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
        </label>
        <label>
          Contraseña (mín. 8)
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="contraseña temporal" />
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
            const err = await createClientUser(activeAccount.id, email, password);
            setBusy(false);
            if (err) setError(err);
            else {
              setEmail("");
              setPassword("");
            }
          }}
        >
          {busy ? "Creando…" : "Crear acceso"}
        </button>
      </div>
    </section>
  );
}

export default function SettingsView() {
  const { activeAccount, activeConnection, igConfigured, syncConnection, disconnectConnection } = useStore();
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
                {busy ? "Sincronizando…" : "Sincronizar ahora"}
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => disconnectConnection(activeConnection.accountId)}
              >
                Desconectar
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
    <ClientAccessPanel />
    </>
  );
}
