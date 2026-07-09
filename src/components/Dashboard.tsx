"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function Dashboard() {
  const { loading, setupError, activeAccount, accountPieces, toast, notify, refresh, canEdit } = useStore();
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
    return <div className="loading-screen">Cargando command center…</div>;
  }

  const usesFilters = view === "overview" || view === "pipeline" || view === "calendar";

  return (
    <div className="app">
      <Rail view={view} setView={setView} />
      <main className="main">
        <section className="hero">
          <div className="hero-inner">
            <div>
              <p className="eyebrow">{activeAccount ? `${activeAccount.name} · Content OS` : "Content OS"}</p>
              <h1>IG Performance Command Center.</h1>
              <p className="hero-copy">
                {activeAccount ? (
                  <>
                    Operando <strong>{activeAccount.name}</strong> ({activeAccount.handle}). Métricas,
                    pipeline, calendario y generación en una sola pantalla — multi-cuenta, sin tocar Meta
                    hasta conectar por la vía oficial.
                  </>
                ) : (
                  "Agregá una cuenta para empezar."
                )}
              </p>
              <div className="hero-actions">
                {canEdit && (
                  <button className="button primary" onClick={() => setView("generator")}>
                    Crear pieza
                  </button>
                )}
                <button className="button" onClick={() => setView("pipeline")}>
                  Ver pipeline
                </button>
                {canEdit && (
                  <button className="button" onClick={() => setView("settings")}>
                    IG Ready
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
              <input
                className="search"
                type="search"
                placeholder="Buscar hook, CTA, responsable…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                className="icon-button"
                title="Limpiar filtros"
                onClick={() => {
                  setFormat("all");
                  setSearch("");
                }}
              >
                R
              </button>
            </div>
          </div>
        )}

        {view === "overview" && <OverviewView pieces={filtered} />}
        {view === "pipeline" && <PipelineView pieces={filtered} />}
        {view === "calendar" && <CalendarView pieces={filtered} />}
        {view === "generator" && canEdit && <GeneratorView />}
        {view === "sources" && canEdit && <SourcesView />}
        {view === "settings" && canEdit && <SettingsView />}
      </main>

      {toast && <div className="toast">{toast.text}</div>}
    </div>
  );
}
