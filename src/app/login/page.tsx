"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = browserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "Email o contraseña incorrectos."
            : authError.message,
        );
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="loading-screen">
      <div style={{ width: "min(420px, 92vw)" }}>
        <div className="brand" style={{ marginBottom: 22 }}>
          <div className="mark">C</div>
          <div>
            <strong style={{ color: "var(--text)" }}>Content OS</strong>
            <span>IG Performance Command Center</span>
          </div>
        </div>
        <section className="panel">
          <p className="eyebrow">Acceso</p>
          <h2 style={{ marginBottom: 14 }}>Iniciar sesión</h2>
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
              Contraseña
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
            <button className="button primary" type="submit" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
            ¿Eres cliente y no tienes acceso? Pide tus credenciales al equipo.
          </p>
        </section>
      </div>
    </div>
  );
}
