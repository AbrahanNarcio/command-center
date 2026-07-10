"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Destino del enlace de "Olvidé mi contraseña". El cliente de Supabase detecta
 * el código de recuperación en la URL y abre una sesión temporal; aquí solo se
 * define la contraseña nueva.
 */
export default function ResetPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = browserClient();
    // El enlace del correo trae ?code=... : el cliente lo intercambia por sesión.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Mínimo 12 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const supabase = browserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
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
        <section className="panel">
          <p className="eyebrow">Recuperar acceso</p>
          <h2 style={{ marginBottom: 14 }}>Nueva contraseña</h2>
          {!ready ? (
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              Verificando el enlace… Si esta pantalla no avanza, el enlace ya expiró: vuelve a{" "}
              <a href="/login" style={{ color: "var(--cyan)" }}>iniciar sesión</a> y pide uno nuevo.
            </p>
          ) : (
            <form className="form-grid" onSubmit={save}>
              <label>
                Nueva contraseña (mín. 12)
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Confirmar contraseña
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              {error && (
                <div className="alert" style={{ ["--accent" as string]: "var(--coral)" }}>
                  <p>{error}</p>
                </div>
              )}
              <button className="button primary" type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Guardar y entrar"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
