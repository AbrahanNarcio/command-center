"use client";

import { useState } from "react";
import { Account } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import ModalPortal from "@/components/ModalPortal";

const COLORS = ["#58e6ff", "#d8ff63", "#ff77bc", "#ffc857", "#80ffb5", "#9b7cff", "#ff6f61"];

export default function AccountModal({ account, onClose }: { account?: Account | null; onClose: () => void }) {
  const { createAccount, updateAccount, deleteAccount, accounts } = useStore();
  const [name, setName] = useState(account?.name ?? "");
  const [handle, setHandle] = useState(account?.handle ?? "@");
  const [kind, setKind] = useState<Account["kind"]>(account?.kind ?? "cliente");
  const [color, setColor] = useState(account?.color ?? COLORS[0]);

  const isEdit = Boolean(account);

  return (
    <ModalPortal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">{isEdit ? "Editar cuenta" : "Nueva cuenta"}</p>
        <h2>{isEdit ? "Ajustes de la cuenta" : "Agregar cuenta"}</h2>
        <p className="modal-sub">Tu propia cuenta o la de un cliente. Cada una tiene sus métricas, pipeline y fuentes.</p>
        <div className="form-grid">
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marca / cliente" />
          </label>
          <label>
            Handle
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@cuenta" />
          </label>
          <label>
            Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value as Account["kind"])}>
              <option value="propia">Propia</option>
              <option value="cliente">Cliente</option>
            </select>
          </label>
          <label>
            Color
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: c,
                    border: color === c ? "2px solid #fff" : "1px solid var(--line)",
                    padding: 0,
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </label>
        </div>
        <div className="modal-actions">
          {isEdit && accounts.length > 1 && (
            <button
              className="button danger"
              style={{ marginRight: "auto" }}
              onClick={() => {
                deleteAccount(account!.id);
                onClose();
              }}
            >
              Eliminar
            </button>
          )}
          <button className="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            onClick={() => {
              if (!name.trim()) return;
              if (isEdit) updateAccount(account!.id, { name, handle, kind, color });
              else createAccount({ name, handle, kind, color });
              onClose();
            }}
          >
            {isEdit ? "Guardar" : "Crear cuenta"}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
