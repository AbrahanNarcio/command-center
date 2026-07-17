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
  MessageCircle,
  PieChart,
  Pencil,
  Plus,
  Sparkles,
  SquareKanban,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store-context";
import { hideOnImgError } from "@/lib/utils";
import { ViewId } from "@/lib/views";
import AccountModal from "@/components/AccountModal";
import PasswordModal from "@/components/PasswordModal";
import ThemeSelector from "@/components/ThemeSelector";
import { Account } from "@/lib/types";

type NavItem = { id: ViewId; icon: React.ReactNode; label: string };

/* El menú en dos secciones: lo que ve el cliente y lo interno del equipo.
   El cliente (solo lectura) ve únicamente la primera; editor y admin ven
   ambas (el editor, acotado a su propia cuenta, como en toda la app).
   "Planeación" es la versión de solo lectura de "Calendario": para el
   equipo (que ya tiene Calendario, editable) se oculta por redundante —
   ver `internalHidden` más abajo, no borrar el item de aquí. */
const NAV_GROUPS: { label: string; internal: boolean; items: NavItem[] }[] = [
  {
    label: "Vistas para el cliente",
    internal: false,
    items: [
      { id: "summary", icon: <Gauge />, label: "Resumen" },
      { id: "messages", icon: <MessageCircle />, label: "Mensajes" },
      { id: "plan", icon: <ListChecks />, label: "Planeación" },
      { id: "overview", icon: <LayoutDashboard />, label: "Control" },
      { id: "audience", icon: <PieChart />, label: "Audiencia" },
      { id: "reports", icon: <FileText />, label: "Reportes" },
    ],
  },
  {
    // Orden por flujo real de trabajo: producción en el orden en que de
    // verdad se usa (Fuentes → Generador → Pipeline → Calendario), y
    // configuración que se toca una sola vez al final. Mensajes vive en el
    // grupo de arriba: el viewer también lo ve (solo lectura, sin responder
    // ni etiquetar); el equipo lo sigue teniendo disponible ahí.
    label: "Administración",
    internal: true,
    items: [
      { id: "sources", icon: <Database />, label: "Fuentes" },
      { id: "generator", icon: <Sparkles />, label: "Generador" },
      { id: "pipeline", icon: <SquareKanban />, label: "Pipeline" },
      { id: "calendar", icon: <CalendarDays />, label: "Calendario" },
      { id: "settings", icon: <AtSign />, label: "Conexión IG" },
    ],
  },
];

/** Items del grupo "cliente" que, para el equipo, duplican una vista interna
 *  equivalente (Planeación = solo-lectura de Calendario). Se ocultan solo
 *  cuando canEdit, para no quitarle nada al cliente real. */
const internalHidden = new Set<ViewId>(["plan"]);

interface RailProps {
  view: ViewId;
  setView: (v: ViewId) => void;
  /** En móvil el rail es un drawer: `open` lo muestra y `onClose` lo cierra
   *  (al elegir vista/cuenta o con la X). En escritorio no cambia nada. */
  open?: boolean;
  onClose?: () => void;
}

export default function Rail({ view, setView, open = false, onClose }: RailProps) {
  const { accounts, metrics, activeId, setActiveId, canEdit, isAdmin, me, signOut } = useStore();

  const avatarOf = (accountId: string) => metrics.find((m) => m.accountId === accountId)?.avatarUrl;
  const [modal, setModal] = useState<null | { account?: Account | null }>(null);
  const [passModal, setPassModal] = useState(false);

  const groups = NAV_GROUPS.filter((g) => canEdit || !g.internal);

  const pick = (id: ViewId) => {
    setView(id);
    onClose?.();
  };

  return (
    <aside className={`rail${open ? " open" : ""}`}>
      <div className="brand">
        <div className="mark">
          <Activity size={22} strokeWidth={2.6} />
        </div>
        <div>
          <strong>Content OS</strong>
          <span>Command Center</span>
        </div>
        <button className="rail-close" onClick={onClose} aria-label="Cerrar menú" title="Cerrar menú">
          <X size={17} />
        </button>
      </div>

      <div className="account-switch">
        <p className="eyebrow">{canEdit ? "Cuentas" : "Tu cuenta"}</p>
        {accounts.map((account) => (
          <div
            key={account.id}
            role="button"
            tabIndex={0}
            className={`account-btn${account.id === activeId ? " active" : ""}`}
            style={{ ["--accent" as string]: account.color }}
            onClick={() => {
              setActiveId(account.id);
              onClose?.();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveId(account.id);
                onClose?.();
              }
            }}
            title={account.handle}
          >
            {avatarOf(account.id) ? (
              <span className="avatar-ring">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="avatar" src={avatarOf(account.id)} alt="" loading="lazy" onError={hideOnImgError} />
              </span>
            ) : (
              <span className="dot" />
            )}
            <span className="who">
              <b>{account.name}</b>
              <small>{account.handle}</small>
            </span>
            {isAdmin ? (
              <button
                className="account-edit"
                title={`Editar ${account.handle}`}
                aria-label={`Editar ${account.handle}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setModal({ account });
                }}
              >
                <Pencil size={12} />
              </button>
            ) : (
              <span className="kind">{account.kind === "propia" ? "Yo" : "Cli"}</span>
            )}
          </div>
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
            {/* El rótulo de grupo solo tiene sentido cuando hay más de uno que
                distinguir (equipo interno); el cliente solo ve un grupo. */}
            {groups.length > 1 && <p className="eyebrow nav-group-label">{group.label}</p>}
            {group.items
              .filter((item) => !(canEdit && internalHidden.has(item.id)))
              .map((item) => (
              <button
                key={item.id}
                className={`nav-${item.id}${view === item.id ? " active" : ""}`}
                onClick={() => pick(item.id)}
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
