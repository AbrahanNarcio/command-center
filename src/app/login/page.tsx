"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { authErrorEs } from "@/lib/auth-errors";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const forgot = async () => {
    setError(null);
    setNotice(null);
    if (!email.includes("@")) {
      setError("Escribe tu email arriba y vuelve a tocar el enlace.");
      return;
    }
    setBusy(true);
    try {
      const supabase = browserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (resetError) setError(authErrorEs(resetError.message));
      else setNotice("Listo: revisa tu correo y abre el enlace para crear una contraseña nueva.");
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = browserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authErrorEs(authError.message));
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <svg className="auth-logo" viewBox="0 0 64 64" role="img" aria-label="Content OS">
          <defs>
            <linearGradient id="auth-g" x1="0" y1="64" x2="64" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#feda75" />
              <stop offset="0.3" stopColor="#fa7e1e" />
              <stop offset="0.62" stopColor="#d62976" />
              <stop offset="1" stopColor="#962fbf" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="15" fill="url(#auth-g)" />
          <path
            d="M13 36h9l5-13 9 22 6-13h9"
            fill="none"
            stroke="#fff"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1 className="auth-title">Inicia sesión en Content OS</h1>
        <p className="auth-sub">Tus métricas, piezas y calendario de Instagram en un solo lugar.</p>
        <section className="panel auth-card">
          <form className="form-grid" onSubmit={signIn}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              <span className="auth-pass-row">
                Contraseña
                <button type="button" className="auth-link" disabled={busy} onClick={forgot}>
                  ¿La olvidaste?
                </button>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <div className="alert" style={{ ["--accent" as string]: "var(--coral)" }}>
                <p>{error}</p>
              </div>
            )}
            {notice && (
              <div className="alert" style={{ ["--accent" as string]: "var(--green)" }}>
                <p>{notice}</p>
              </div>
            )}
            <button className="button primary auth-submit" type="submit" disabled={busy}>
              {busy && <Loader2 size={15} className="spin" />} {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </section>
        <p className="auth-foot">¿Eres cliente y aún no tienes acceso? Pide tus credenciales al equipo.</p>
        <p className="auth-foot auth-legal">
          <a href="/privacidad">Política de privacidad</a> · <a href="/eliminar-datos">Eliminación de datos</a>
        </p>
      </div>
    </div>
  );
}
