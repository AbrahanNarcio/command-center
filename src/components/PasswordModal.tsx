"use client";

import { useState } from "react";
import ModalPortal from "@/components/ModalPortal";
import { useStore } from "@/lib/store-context";

/** Cambio de contraseña del usuario logueado (cualquier rol). */
export default function PasswordModal({ onClose }: { onClose: () => void }) {
  const { notify } = useStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo cambiar la contraseña.");
        return;
      }
      notify("Contraseña actualizada");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(420px, 100%)" }}>
          <p className="eyebrow">Tu acceso</p>
          <h2>Cambiar contraseña</h2>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <label>
              Nueva contraseña (mín. 8)
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirmar contraseña
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {error && (
              <div className="alert" style={{ ["--accent" as string]: "var(--coral)" }}>
                <p>{error}</p>
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button className="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="button primary" disabled={busy} onClick={save}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
