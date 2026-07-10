"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import ModalPortal from "@/components/ModalPortal";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = acción destructiva (botón rojo). */
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/** Diálogo de confirmación genérico para acciones sensibles o destructivas. */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false);

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, 100%)" }}>
          <p className="eyebrow" style={{ color: danger ? "var(--coral)" : "var(--cyan)" }}>
            {danger ? "Acción irreversible" : "Confirmar"}
          </p>
          <h2>{title}</h2>
          <p className="modal-sub" style={{ lineHeight: 1.55 }}>
            {message}
          </p>
          <div className="modal-actions">
            <button className="button" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </button>
            <button
              className={`button ${danger ? "danger" : "primary"}`}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Loader2 size={15} className="spin" />} {busy ? "Procesando…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
