"use client";

import { useEffect, useMemo, useState } from "react";
import { AtSign, RotateCcw, Search, Sparkles, SquareKanban } from "lucide-react";
import { useStore } from "@/lib/store-context";
import { FORMATS, PieceFormat } from "@/lib/types";
import { ViewId } from "@/lib/views";
import Rail from "@/components/Rail";
import OverviewView from "@/components/views/OverviewView";
import PipelineView from "@/components/views/PipelineView";
import CalendarView from "@/components/views/CalendarView";
import GeneratorView from "@/components/views/GeneratorView";
import SourcesView from "@/components/views/SourcesView";
import SettingsView from "@/components/views/SettingsView";
import ReportsView from "@/components/views/ReportsView";
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
      const haystack = [p.hook, p.summary, p.cta, p.owner, p.status, p.objective].join(" ").toLowerCase();
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
      <Rail view={view} setView={setView} />
      <main className="main">
        <section className="hero">
          <div className="hero-inner">
            <div>
              <p className="eyebrow">Content OS · Command Center</p>
              <div className="hero-id">
                {activeMetrics?.avatarUrl && (
                  <span className="avatar-ring hero-avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="avatar" src={activeMetrics.avatarUrl} alt="" loading="lazy" />
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
                    <strong>IG Ready</strong>.
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
                <button className="button" onClick={() => setView("pipeline")}>
                  <SquareKanban size={15} /> Ver pipeline
                </button>
                {canEdit && (
                  <button className="button" onClick={() => setView("settings")}>
                    <AtSign size={15} /> IG Ready
                  </button>
                )}
              </div>
            </div>
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
          {view === "overview" && <OverviewView pieces={accountPieces} />}
          {view === "pipeline" && <PipelineView pieces={filtered} />}
          {view === "calendar" && <CalendarView pieces={filtered} />}
          {view === "reports" && <ReportsView />}
          {view === "generator" && canEdit && <GeneratorView />}
          {view === "sources" && canEdit && <SourcesView />}
          {view === "settings" && canEdit && <SettingsView />}
        </div>
      </main>

      {toast && (
        <div className="toast">
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
