"use client";

import { useState } from "react";
import { Account } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import ModalPortal from "@/components/ModalPortal";
import ConfirmModal from "@/components/ConfirmModal";

const COLORS = ["#7a8cff", "#feda75", "#ff5c9c", "#ffa14e", "#80ffb5", "#b05ce6", "#ff5d51"];

export default function AccountModal({ account, onClose }: { account?: Account | null; onClose: () => void }) {
  const { createAccount, updateAccount, deleteAccount, accounts } = useStore();
  const [name, setName] = useState(account?.name ?? "");
  const [handle, setHandle] = useState(account?.handle ?? "@");
  const [kind, setKind] = useState<Account["kind"]>(account?.kind ?? "cliente");
  const [color, setColor] = useState(account?.color ?? COLORS[0]);
  const [missing, setMissing] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = Boolean(account);

  return (
    <ModalPortal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">{isEdit ? "Editar cuenta" : "Nueva cuenta"}</p>
        <h2>{isEdit ? "Ajustes de la cuenta" : "Agregar cuenta"}</h2>
        <p className="modal-sub">
          Tu propia cuenta o la de un cliente. Cada una tiene sus métricas, pipeline y fuentes. El nombre
          y el @ pueden ser provisionales: al conectar Instagram se actualizan solos con los del perfil real.
        </p>
        <div className="form-grid">
          <label>
            Nombre *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Marca / cliente"
              className={missing.includes("Nombre") ? "invalid" : undefined}
            />
          </label>
          <label>
            Handle *
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@cuenta"
              className={missing.includes("Handle") ? "invalid" : undefined}
            />
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
        {missing.length > 0 && (
          <div className="alert" style={{ ["--accent" as string]: "var(--coral)", marginTop: 12 }}>
            <p>Faltan campos obligatorios: {missing.join(", ")}.</p>
          </div>
        )}
        <div className="modal-actions">
          {isEdit && accounts.length > 1 && (
            <button
              className="button danger"
              style={{ marginRight: "auto" }}
              onClick={() => setConfirmDelete(true)}
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
              const faltantes: string[] = [];
              if (!name.trim()) faltantes.push("Nombre");
              if (!handle.replace("@", "").trim()) faltantes.push("Handle");
              setMissing(faltantes);
              if (faltantes.length) return;
              const cleanHandle = handle.trim().startsWith("@") ? handle.trim() : `@${handle.trim()}`;
              if (isEdit) updateAccount(account!.id, { name, handle: cleanHandle, kind, color });
              else createAccount({ name, handle: cleanHandle, kind, color });
              onClose();
            }}
          >
            {isEdit ? "Guardar" : "Crear cuenta"}
          </button>
        </div>
      </div>
      {confirmDelete && account && (
        <ConfirmModal
          danger
          title={`¿Eliminar la cuenta ${account.name}?`}
          message="Se borran para siempre sus métricas, piezas, fuentes, reportes y los accesos de sus usuarios. Si está conectada a Instagram, también se desconecta. Esta acción no se puede deshacer."
          confirmLabel="Sí, eliminar todo"
          cancelLabel="No, conservar"
          onConfirm={() => {
            deleteAccount(account.id);
            onClose();
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
    </ModalPortal>
  );
}
