"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Printer, Trash2, X } from "lucide-react";
import { Report } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import { trackBusy } from "@/lib/busy";
import { Donut, LineChart } from "@/components/charts";
import ModalPortal from "@/components/ModalPortal";
import KpiIcon from "@/components/KpiIcon";

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ReportsView() {
  const { activeAccount, canEdit, notify } = useStore();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Report | null>(null);

  const accountId = activeAccount?.id;

  const load = useCallback(async () => {
    if (!accountId) return;
    setError(null);
    const res = await fetch(`/api/reports?account=${encodeURIComponent(accountId)}`);
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "No se pudieron cargar los reportes.");
      setReports([]);
      return;
    }
    setReports(data as Report[]);
  }, [accountId]);

  useEffect(() => {
    setReports(null);
    load();
  }, [load]);

  const generate = async () => {
    if (!accountId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await trackBusy(
        fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, note }),
        }),
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "No se pudo generar el reporte.");
        return;
      }
      setNote("");
      notify("Reporte generado");
      await load();
      setOpen(data as Report);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const removed = reports?.find((r) => r.id === id);
    await trackBusy(fetch(`/api/reports/${id}`, { method: "DELETE" }));
    notify(
      "Reporte eliminado",
      removed && {
        label: "Restablecer",
        run: async () => {
          const res = await trackBusy(
            fetch("/api/reports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restore: removed }),
            }),
          );
          if (res.ok) notify("Reporte restablecido");
          await load();
        },
      },
    );
    await load();
  };

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Histórico · {activeAccount?.handle}</p>
            <h2>Reportes</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
              Guarda una foto de tus métricas de hoy para ver cómo evolucionas con el tiempo y compartir
              resultados en PDF con tu cliente.
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="report-generate">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota opcional (contexto del periodo, campañas activas...)"
            />
            <button className="button primary" disabled={busy || !accountId} onClick={generate}>
              {busy ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}{" "}
              {busy ? "Generando…" : "Generar reporte"}
            </button>
          </div>
        )}

        {error && (
          <div className="alert" style={{ ["--accent" as string]: "var(--coral)", marginBottom: 12 }}>
            <p>{error}</p>
          </div>
        )}

        <div className="report-list">
          {reports === null ? (
            <div className="no-results">Cargando reportes…</div>
          ) : reports.length === 0 && !error ? (
            <div className="no-results">
              Sin reportes todavía. {canEdit ? "Genera el primero con el botón de arriba." : ""}
            </div>
          ) : (
            reports.map((r, i) => (
              <div className="report-row" key={r.id} style={{ ["--i" as string]: i }}>
                <div className="report-row-main" onClick={() => setOpen(r)}>
                  <strong>{r.title}</strong>
                  <span>
                    {stamp(r.createdAt)}
                    {r.note ? ` · ${r.note.slice(0, 60)}` : ""}
                  </span>
                </div>
                <div className="report-row-kpis">
                  {r.data.kpis.slice(0, 4).map((k) => (
                    <span key={k.label}>
                      {k.label}: <b>{k.value}</b>
                    </span>
                  ))}
                </div>
                <div className="card-actions" style={{ marginTop: 0 }}>
                  <button onClick={() => setOpen(r)}>Ver</button>
                  {canEdit && (
                    <button className="warn" onClick={() => remove(r.id)}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {open && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setOpen(null)}>
            <div className="modal report-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="report-head">
                <div>
                  <p className="eyebrow">Content OS · Reporte</p>
                  <h2>{open.title}</h2>
                  <p className="modal-sub" style={{ marginBottom: 0 }}>
                    Generado: {stamp(open.createdAt)} · Datos al {stamp(open.data.updatedAt)}
                    {open.note ? ` · ${open.note}` : ""}
                  </p>
                </div>
                <div className="report-tools no-print">
                  <button className="button small" onClick={() => window.print()}>
                    <Printer size={13} /> PDF
                  </button>
                  <button className="button small" onClick={() => setOpen(null)}>
                    <X size={13} /> Cerrar
                  </button>
                </div>
              </div>

              <div className="metric-grid report-kpis">
                {open.data.kpis.map((kpi) => (
                  <article className="metric-card" key={kpi.label} style={{ ["--accent" as string]: kpi.color }}>
                    <span>{kpi.label}</span>
                    <strong>{kpi.value}</strong>
                    <p>{kpi.detail}</p>
                    <KpiIcon label={kpi.label} />
                  </article>
                ))}
              </div>

              <div className="report-charts">
                <section className="chart-card">
                  <div className="chart-top">
                    <div>
                      <p className="eyebrow">Crecimiento</p>
                      <h2>Seguidores</h2>
                    </div>
                    <div className="chart-value">
                      <strong>{open.data.growthNet}</strong>netos
                    </div>
                  </div>
                  <LineChart values={open.data.growth} />
                </section>
                <section className="chart-card">
                  <div className="chart-top">
                    <div>
                      <p className="eyebrow">Mix engagement</p>
                      <h2>Qué generó acción</h2>
                    </div>
                  </div>
                  <div className="donut-wrap">
                    <Donut metrics={open.data} />
                    <div className="legend">
                      {open.data.engagementMix.map((m) => (
                        <div className="legend-row" key={m.label} style={{ ["--accent" as string]: m.color }}>
                          <span className="legend-dot" />
                          <span>{m.label}</span>
                          <b>{m.value}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              <div className="report-charts">
                {open.data.topPosts?.length ? (
                  <section className="chart-card">
                    <div className="chart-top">
                      <div>
                        <p className="eyebrow">Top publicaciones</p>
                        <h2>Más interacción</h2>
                      </div>
                    </div>
                    <div className="funnel-list">
                      {open.data.topPosts.map((p, i) => (
                        <div className="funnel-step" key={`${p.label}-${i}`}>
                          <div>
                            <span>{p.label}</span>
                            <b>{p.value}</b>
                          </div>
                          <div className="meter">
                            <span
                              style={{
                                ["--score" as string]: `${p.pct}%`,
                                ["--meter" as string]: `linear-gradient(90deg, ${p.color}, rgba(255,255,255,.18))`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {open.data.reelsRetention?.length ? (
                  <section className="chart-card">
                    <div className="chart-top">
                      <div>
                        <p className="eyebrow">Retención reels</p>
                        <h2>Tiempo promedio visto</h2>
                      </div>
                      <div className="chart-value">
                        <strong>{open.data.retentionAvg}</strong>promedio
                      </div>
                    </div>
                    <div className="funnel-list">
                      {open.data.reelsRetention.map((r, i) => (
                        <div className="funnel-step" key={`${r.label}-${i}`}>
                          <div>
                            <span>{r.label}</span>
                            <b>{r.value}</b>
                          </div>
                          <div className="meter">
                            <span
                              style={{
                                ["--score" as string]: `${r.pct}%`,
                                ["--meter" as string]: `linear-gradient(90deg, ${r.color}, rgba(255,255,255,.18))`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                <section className="chart-card">
                  <div className="chart-top">
                    <div>
                      <p className="eyebrow">Funnel</p>
                      <h2>Ruta a la acción</h2>
                    </div>
                    <div className="chart-value">
                      <strong>{open.data.ctrBio}</strong>CTR bio
                    </div>
                  </div>
                  <div className="funnel-list">
                    {open.data.funnel.map((f) => (
                      <div className="funnel-step" key={f.label}>
                        <div>
                          <span>{f.label}</span>
                          <b>{f.value}</b>
                        </div>
                        <div className="meter">
                          <span
                            style={{
                              ["--score" as string]: `${f.pct}%`,
                              ["--meter" as string]: `linear-gradient(90deg, ${f.color}, rgba(255,255,255,.18))`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
