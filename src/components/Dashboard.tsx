"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AtSign, ListChecks, Menu, RotateCcw, Search, Sparkles, SquareKanban } from "lucide-react";
import { useStore } from "@/lib/store-context";
import { FORMATS, PieceFormat } from "@/lib/types";
import { hideOnImgError } from "@/lib/utils";
import { ViewId } from "@/lib/views";
import { isoDate, piecesForDate, sameWeek, weekDays } from "@/lib/plan";
import { FORMAT_META } from "@/components/FormatIcon";
import Rail from "@/components/Rail";
import OverviewView from "@/components/views/OverviewView";
import PipelineView from "@/components/views/PipelineView";
import CalendarView from "@/components/views/CalendarView";
import GeneratorView from "@/components/views/GeneratorView";
import MessagesView from "@/components/views/MessagesView";
import SourcesView from "@/components/views/SourcesView";
import SettingsView from "@/components/views/SettingsView";
import ReportsView from "@/components/views/ReportsView";
import SummaryView from "@/components/views/SummaryView";
import PlanView from "@/components/views/PlanView";
import SplashScreen from "@/components/SplashScreen";
import TopLoader from "@/components/TopLoader";


/** "8 jul, 2:32 p.m." en la hora local del dispositivo. */
function syncStamp(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Próxima corrida del cron (13:00 UTC diario), expresada en hora local con a.m./p.m. */
function nextSyncLabel(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(13, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const time = next.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${next.toDateString() === now.toDateString() ? "hoy" : "mañana"} a las ${time}`;
}

export default function Dashboard() {
  const {
    loading,
    loadingStage,
    setupError,
    activeAccount,
    activeConnection,
    activeMetrics,
    accountPieces,
    toast,
    notify,
    refresh,
    canEdit,
  } = useStore();
  const [view, setView] = useState<ViewId>("overview");
  const [format, setFormat] = useState<PieceFormat | "all">("all");
  const [search, setSearch] = useState("");
  const today = new Date();
  // Drawer del menú en móvil (en escritorio el rail es fijo y esto no aplica).
  const [railOpen, setRailOpen] = useState(false);

  // Con el drawer abierto: sin scroll de fondo, Escape lo cierra y el foco
  // entra al botón de cerrar (y regresa a la hamburguesa al salir).
  useEffect(() => {
    document.body.style.overflow = railOpen ? "hidden" : "";
    if (!railOpen) return () => {
      document.body.style.overflow = "";
    };
    (document.querySelector(".rail-close") as HTMLElement | null)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRailOpen(false);
        (document.querySelector(".topbar-menu") as HTMLElement | null)?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [railOpen]);

  // El cliente (solo lectura) aterriza en el Resumen; el equipo, en Control.
  const landed = useRef(false);
  useEffect(() => {
    if (loading || landed.current) return;
    landed.current = true;
    if (!canEdit) setView("summary");
  }, [loading, canEdit]);

  // Handle the OAuth redirect back from Meta (?igconnected=... / ?igerror=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("igconnected");
    const error = params.get("igerror");
    if (connected || error) {
      if (connected) notify(`Instagram conectado: @${connected}`);
      if (error) notify(`Instagram: ${error}`);
      setView("settings");
      refresh();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [notify, refresh]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accountPieces.filter((p) => {
      const formatOk = format === "all" || p.format === format;
      const haystack = [p.hook, p.cuerpo, p.summary, p.cta, p.owner, p.status, p.objective]
        .join(" ")
        .toLowerCase();
      return formatOk && (!term || haystack.includes(term));
    });
  }, [accountPieces, format, search]);

  const gate = useMemo(() => {
    const total = accountPieces.length || 1;
    const avg = Math.round(accountPieces.reduce((s, p) => s + p.score, 0) / total);
    const ready = accountPieces.filter((p) => ["Aprobado", "Programado"].includes(p.status)).length;
    const blocked = accountPieces.filter((p) => p.score < 70).length;
    return { avg, ready, blocked };
  }, [accountPieces]);

  // Lo que ve el cliente en vez del panel de producción: su cuenta, no la cocina interna.
  const audienceStrip = useMemo(() => {
    const kpis = activeMetrics?.kpiRanges?.["30"] ?? activeMetrics?.kpis ?? [];
    const byLabel = (label: string) => kpis.find((k) => k.label === label);
    const followers = byLabel("Seguidores");
    const views = byLabel("Vistas");
    const next = weekDays(today)
      .filter((d) => isoDate(d) >= isoDate(today))
      .flatMap((date) => piecesForDate(accountPieces, date, sameWeek(date, today)).map((p) => ({ date, piece: p })))
      .sort((a, b) => isoDate(a.date).localeCompare(isoDate(b.date)) || a.piece.time.localeCompare(b.piece.time))[0];
    return { followers, views, next };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMetrics, accountPieces]);

  if (setupError) {
    return (
      <div className="loading-screen">
        <section className="panel" style={{ width: "min(560px, 92vw)" }}>
          <p className="eyebrow">Configuración pendiente</p>
          <h2 style={{ marginBottom: 10 }}>Falta conectar la base de datos</h2>
          <p style={{ color: "var(--soft)", lineHeight: 1.55 }}>{setupError}</p>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginBottom: 0 }}>
            Guía completa en <code>SUPABASE_SETUP.md</code> del proyecto.
          </p>
        </section>
      </div>
    );
  }

  if (loading) {
    return <SplashScreen stage={loadingStage} />;
  }

  // El filtro global de piezas solo tiene sentido donde TODA la vista son piezas.
  // En Control las piezas viven solo en "ganadoras", que trae su propio filtro.
  const usesFilters = view === "pipeline" || view === "calendar";

  return (
    <div className="app">
      <TopLoader />

      {/* Barra superior SOLO móvil: menú a la izquierda, cuenta activa a la derecha. */}
      <header className="mobile-topbar">
        <button
          className="topbar-menu"
          onClick={() => setRailOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={railOpen}
          title="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <div className="topbar-brand">
          <span className="mark">
            <Activity size={16} strokeWidth={2.8} />
          </span>
          <strong>Content OS</strong>
        </div>
        {activeAccount && (
          <button
            className="topbar-account"
            onClick={() => setRailOpen(true)}
            title="Cambiar de cuenta"
            aria-label={`Cuenta activa: ${activeAccount.handle}. Abrir menú para cambiar.`}
          >
            {activeMetrics?.avatarUrl ? (
              <span className="avatar-ring">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="avatar" src={activeMetrics.avatarUrl} alt="" loading="lazy" onError={hideOnImgError} />
              </span>
            ) : (
              <span className="dot" style={{ ["--accent" as string]: activeAccount.color }} />
            )}
            <span className="topbar-handle">{activeAccount.handle}</span>
          </button>
        )}
      </header>

      {railOpen && <div className="rail-backdrop" onClick={() => setRailOpen(false)} aria-hidden />}
      <Rail view={view} setView={setView} open={railOpen} onClose={() => setRailOpen(false)} />
      <main className="main">
        <section className="hero">
          <div className="hero-inner">
            <div>
              <p className="eyebrow">Content OS · Command Center</p>
              <div className="hero-id">
                {activeMetrics?.avatarUrl && (
                  <span className="avatar-ring hero-avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="avatar" src={activeMetrics.avatarUrl} alt="" loading="lazy" onError={hideOnImgError} />
                  </span>
                )}
                <div className="hero-id-text">
                  <h1>{activeAccount ? activeAccount.name : "Content OS"}</h1>
                  <p className="hero-copy">
                {!activeAccount ? (
                  "Agrega una cuenta para empezar."
                ) : activeConnection?.lastSyncAt ? (
                  <>
                    <strong>{activeAccount.handle}</strong> · Última actualización:{" "}
                    {syncStamp(activeConnection.lastSyncAt)} · Próxima: {nextSyncLabel()}
                  </>
                ) : activeConnection ? (
                  <>
                    <strong>{activeAccount.handle}</strong> · Conectada, primera sincronización pendiente.
                  </>
                ) : canEdit ? (
                  <>
                    <strong>{activeAccount.handle}</strong> · Sin conexión a Instagram — conéctala en{" "}
                    <strong>Conexión Instagram</strong>.
                  </>
                ) : (
                  <>
                    <strong>{activeAccount.handle}</strong> · Vista de solo lectura.
                  </>
                )}
                  </p>
                </div>
              </div>
              <div className="hero-actions">
                {canEdit && (
                  <button className="button ai" onClick={() => setView("generator")}>
                    <Sparkles size={15} /> Crear pieza
                  </button>
                )}
                {canEdit ? (
                  <button className="button" onClick={() => setView("pipeline")}>
                    <SquareKanban size={15} /> Ver pipeline
                  </button>
                ) : (
                  <button className="button" onClick={() => setView("plan")}>
                    <ListChecks size={15} /> Ver planeación
                  </button>
                )}
                {canEdit && (
                  <button className="button paint" onClick={() => setView("settings")}>
                    <AtSign size={15} /> Conexión Instagram
                  </button>
                )}
              </div>
            </div>
            {canEdit ? (
              <div className="command-strip" aria-label="Estado operativo">
                <div className="command-card">
                  <div className="row">
                    <strong>Quality gate</strong>
                    <span>{gate.avg}%</span>
                  </div>
                  <div className="pulse-bar">
                    <span style={{ ["--w" as string]: `${gate.avg}%` }} />
                  </div>
                </div>
                <div className="command-card">
                  <div className="row">
                    <strong>Listas para salir</strong>
                    <span>{gate.ready} piezas</span>
                  </div>
                  <div className="pulse-bar">
                    <span style={{ ["--w" as string]: `${Math.min(100, gate.ready * 12)}%` }} />
                  </div>
                </div>
                <div className="command-card">
                  <div className="row">
                    <strong>Bloqueos creativos</strong>
                    <span>{gate.blocked} rojos</span>
                  </div>
                  <div className="pulse-bar">
                    <span style={{ ["--w" as string]: `${Math.min(100, gate.blocked * 20)}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="command-strip" aria-label="Estado de tu cuenta">
                <div className="command-card">
                  <div className="row">
                    <strong>Seguidores</strong>
                    <span>{audienceStrip.followers?.value ?? "—"}</span>
                  </div>
                  <p className="command-card-hint">Total actual del perfil</p>
                </div>
                <div className="command-card">
                  <div className="row">
                    <strong>Vistas</strong>
                    <span>{audienceStrip.views?.value ?? "—"}</span>
                  </div>
                  <p className="command-card-hint">Últimos 30 días{audienceStrip.views?.delta ? ` · ${audienceStrip.views.delta}` : ""}</p>
                </div>
                <div className="command-card">
                  <div className="row">
                    <strong>Próxima publicación</strong>
                    <span>{audienceStrip.next ? FORMAT_META[audienceStrip.next.piece.format].label : "—"}</span>
                  </div>
                  <p className="command-card-hint">
                    {audienceStrip.next
                      ? `${isoDate(audienceStrip.next.date) === isoDate(today) ? "Hoy" : audienceStrip.next.piece.day} · ${audienceStrip.next.piece.time}`
                      : "Nada programado todavía"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {usesFilters && (
          <div className="top-row">
            <div className="filters">
              <button className={`chip${format === "all" ? " active" : ""}`} onClick={() => setFormat("all")}>
                Todo
              </button>
              {FORMATS.map((f) => (
                <button
                  key={f}
                  className={`chip${format === f ? " active" : ""}`}
                  onClick={() => setFormat(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="toolbar">
              {(format !== "all" || search.trim() !== "") && (
                <span className="filter-count">
                  {filtered.length} de {accountPieces.length} piezas
                </span>
              )}
              <div className="search-wrap">
                <Search size={15} />
                <input
                  className="search"
                  type="search"
                  placeholder="Buscar hook, CTA, responsable…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                className="icon-button"
                title="Limpiar filtros"
                onClick={() => {
                  setFormat("all");
                  setSearch("");
                }}
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
        )}

        <div className="view-anim" key={`${view}-${activeAccount?.id ?? ""}`}>
          {view === "summary" && <SummaryView go={setView} />}
          {view === "messages" && <MessagesView />}
          {view === "plan" && <PlanView />}
          {view === "overview" && <OverviewView pieces={accountPieces} />}
          {view === "pipeline" && canEdit && <PipelineView pieces={filtered} />}
          {view === "calendar" && canEdit && <CalendarView pieces={filtered} />}
          {view === "reports" && <ReportsView />}
          {view === "generator" && canEdit && <GeneratorView />}
          {view === "sources" && canEdit && <SourcesView />}
          {view === "settings" && canEdit && <SettingsView />}
        </div>
      </main>

      {toast && (
        <div className={`toast${toast.tone === "error" ? " error" : ""}`}>
          {toast.text}
          {toast.action && (
            <button className="toast-undo" onClick={() => toast.action?.run()}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
