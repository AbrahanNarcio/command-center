"use client";

import { useState } from "react";
import {
  Activity,
  AtSign,
  CalendarDays,
  Database,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Plus,
  Sparkles,
  SquareKanban,
} from "lucide-react";
import { useStore } from "@/lib/store-context";
import { ViewId } from "@/lib/views";
import AccountModal from "@/components/AccountModal";
import PasswordModal from "@/components/PasswordModal";
import ThemeSelector from "@/components/ThemeSelector";
import { Account } from "@/lib/types";

const NAV: { id: ViewId; icon: React.ReactNode; label: string; adminOnly: boolean }[] = [
  { id: "overview", icon: <LayoutDashboard />, label: "Control", adminOnly: false },
  { id: "pipeline", icon: <SquareKanban />, label: "Pipeline", adminOnly: false },
  { id: "calendar", icon: <CalendarDays />, label: "Calendario", adminOnly: false },
  { id: "reports", icon: <FileText />, label: "Reportes", adminOnly: false },
  { id: "generator", icon: <Sparkles />, label: "Generador", adminOnly: true },
  { id: "sources", icon: <Database />, label: "Fuentes", adminOnly: true },
  { id: "settings", icon: <AtSign />, label: "IG Ready", adminOnly: true },
];

export default function Rail({ view, setView }: { view: ViewId; setView: (v: ViewId) => void }) {
  const { accounts, metrics, activeId, setActiveId, canEdit, isAdmin, me, signOut } = useStore();

  const avatarOf = (accountId: string) => metrics.find((m) => m.accountId === accountId)?.avatarUrl;
  const [modal, setModal] = useState<null | { account?: Account | null }>(null);
  const [passModal, setPassModal] = useState(false);

  const nav = NAV.filter((item) => canEdit || !item.adminOnly);

  return (
    <aside className="rail">
      <div className="brand">
        <div className="mark">
          <Activity size={22} strokeWidth={2.6} />
        </div>
        <div>
          <strong>Content OS</strong>
          <span>Command Center</span>
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
            onDoubleClick={isAdmin ? () => setModal({ account }) : undefined}
            title={isAdmin ? "Doble clic para editar" : account.handle}
          >
            {avatarOf(account.id) ? (
              <span className="avatar-ring">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="avatar" src={avatarOf(account.id)} alt="" loading="lazy" />
              </span>
            ) : (
              <span className="dot" />
            )}
            <span className="who">
              <b>{account.name}</b>
              <small>{account.handle}</small>
            </span>
            <span className="kind">{account.kind === "propia" ? "Yo" : "Cli"}</span>
          </button>
        ))}
        {isAdmin && (
          <button className="add-account" onClick={() => setModal({ account: null })}>
            <Plus size={14} /> Agregar cuenta
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
        <div className="signal">{isAdmin ? "ADMIN" : canEdit ? "EDITOR" : "CLIENTE"}</div>
        <strong>{me?.email ?? ""}</strong>
        <span>{isAdmin ? "Acceso total al command center." : canEdit ? "Puedes mover todo lo de tu cuenta." : "Vista de solo lectura de tu cuenta."}</span>
        <ThemeSelector />
        <button className="button small" style={{ marginTop: 7, width: "100%" }} onClick={() => setPassModal(true)}>
          <KeyRound size={13} /> Cambiar contraseña
        </button>
        <button className="button small" style={{ marginTop: 7, width: "100%" }} onClick={signOut}>
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>

      {modal && <AccountModal account={modal.account} onClose={() => setModal(null)} />}
      {passModal && <PasswordModal onClose={() => setPassModal(false)} />}
    </aside>
  );
}
