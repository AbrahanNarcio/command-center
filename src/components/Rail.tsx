"use client";

import { useState } from "react";
import {
  Activity,
  AtSign,
  CalendarDays,
  Database,
  FileText,
  Gauge,
  KeyRound,
  LayoutDashboard,
  ListChecks,
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

type NavItem = { id: ViewId; icon: React.ReactNode; label: string };

/* El menú en dos secciones: lo que ve el cliente y lo interno del equipo.
   El cliente (solo lectura) ve únicamente la primera; editor y admin ven
   ambas (el editor, acotado a su propia cuenta, como en toda la app). */
const NAV_GROUPS: { label: string; internal: boolean; items: NavItem[] }[] = [
  {
    label: "Vistas para el cliente",
    internal: false,
    items: [
      { id: "summary", icon: <Gauge />, label: "Resumen" },
      { id: "plan", icon: <ListChecks />, label: "Planeación" },
      { id: "overview", icon: <LayoutDashboard />, label: "Control" },
      { id: "reports", icon: <FileText />, label: "Reportes" },
    ],
  },
  {
    label: "Administración",
    internal: true,
    items: [
      { id: "pipeline", icon: <SquareKanban />, label: "Pipeline" },
      { id: "calendar", icon: <CalendarDays />, label: "Calendario" },
      { id: "generator", icon: <Sparkles />, label: "Generador" },
      { id: "sources", icon: <Database />, label: "Fuentes" },
      { id: "settings", icon: <AtSign />, label: "Conexión Instagram" },
    ],
  },
];

export default function Rail({ view, setView }: { view: ViewId; setView: (v: ViewId) => void }) {
  const { accounts, metrics, activeId, setActiveId, canEdit, isAdmin, me, signOut } = useStore();

  const avatarOf = (accountId: string) => metrics.find((m) => m.accountId === accountId)?.avatarUrl;
  const [modal, setModal] = useState<null | { account?: Account | null }>(null);
  const [passModal, setPassModal] = useState(false);

  const groups = NAV_GROUPS.filter((g) => canEdit || !g.internal);

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
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="eyebrow nav-group-label">{group.label}</p>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`nav-${item.id}${view === item.id ? " active" : ""}`}
                onClick={() => setView(item.id)}
                title={item.label}
              >
                <i>{item.icon}</i>
                <b>{item.label}</b>
              </button>
            ))}
          </div>
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
