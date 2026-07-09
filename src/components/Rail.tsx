"use client";

import { useState } from "react";
import { useStore } from "@/lib/store-context";
import { ViewId } from "@/lib/views";
import AccountModal from "@/components/AccountModal";
import { Account } from "@/lib/types";

const NAV: { id: ViewId; icon: string; label: string; adminOnly: boolean }[] = [
  { id: "overview", icon: "C", label: "Control", adminOnly: false },
  { id: "pipeline", icon: "P", label: "Pipeline", adminOnly: false },
  { id: "calendar", icon: "7", label: "Calendario", adminOnly: false },
  { id: "generator", icon: "AI", label: "Generador", adminOnly: true },
  { id: "sources", icon: "F", label: "Fuentes", adminOnly: true },
  { id: "settings", icon: "IG", label: "IG Ready", adminOnly: true },
];

export default function Rail({ view, setView }: { view: ViewId; setView: (v: ViewId) => void }) {
  const { accounts, activeId, setActiveId, canEdit, me, signOut } = useStore();
  const [modal, setModal] = useState<null | { account?: Account | null }>(null);

  const nav = NAV.filter((item) => canEdit || !item.adminOnly);

  return (
    <aside className="rail">
      <div className="brand">
        <div className="mark">S</div>
        <div>
          <strong>SYK Command</strong>
          <span>Content OS</span>
        </div>
      </div>

      <div className="account-switch">
        <p className="eyebrow">{canEdit ? "Cuentas" : "Tu cuenta"}</p>
        {accounts.map((account) => (
          <button
            key={account.id}
            className={`account-btn${account.id === activeId ? " active" : ""}`}
            style={{ ["--accent" as string]: account.color }}
            onClick={() => setActiveId(account.id)}
            onDoubleClick={canEdit ? () => setModal({ account }) : undefined}
            title={canEdit ? "Doble clic para editar" : account.handle}
          >
            <span className="dot" />
            <span className="who">
              <b>{account.name}</b>
              <small>{account.handle}</small>
            </span>
            <span className="kind">{account.kind === "propia" ? "Yo" : "Cli"}</span>
          </button>
        ))}
        {canEdit && (
          <button className="add-account" onClick={() => setModal({ account: null })}>
            + Agregar cuenta
          </button>
        )}
      </div>

      <nav className="nav" aria-label="Vistas">
        {nav.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? "active" : ""}
            onClick={() => setView(item.id)}
            title={item.label}
          >
            <i>{item.icon}</i>
            <b>{item.label}</b>
          </button>
        ))}
      </nav>

      <div className="mini-card">
        <div className="signal">{canEdit ? "ADMIN" : "CLIENTE"}</div>
        <strong>{me?.email ?? ""}</strong>
        <span>{canEdit ? "Acceso total al command center." : "Vista de solo lectura de tu cuenta."}</span>
        <button className="button small" style={{ marginTop: 10, width: "100%" }} onClick={signOut}>
          Cerrar sesión
        </button>
      </div>

      {modal && <AccountModal account={modal.account} onClose={() => setModal(null)} />}
    </aside>
  );
}
