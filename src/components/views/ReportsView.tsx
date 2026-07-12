"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Printer, Trash2, X } from "lucide-react";
import { Report, ReportSection } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import { trackBusy } from "@/lib/busy";
import { Donut, LineChart } from "@/components/charts";
import ModalPortal from "@/components/ModalPortal";
import KpiIcon from "@/components/KpiIcon";
import { accentVar } from "@/lib/utils";

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

/** Periodos ofrecidos: solo los que tienen KPIs reales por rango (sync). */
const PERIOD_OPTIONS: { key: string; label: string }[] = [
  { key: "7", label: "7 días" },
  { key: "30", label: "30 días" },
  { key: "all", label: "Todo" },
];

const SECTION_OPTIONS: { key: ReportSection; label: string }[] = [
  { key: "kpis", label: "KPIs" },
  { key: "growth", label: "Seguidores" },
  { key: "mix", label: "Qué genera reacciones" },
  { key: "topPosts", label: "Top publicaciones" },
  { key: "retention", label: "Retención reels" },
  { key: "funnel", label: "Ruta a la acción" },
];

export default function ReportsView() {
  const { activeAccount, activeMetrics, canEdit, notify } = useStore();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Report | null>(null);
  const [period, setPeriod] = useState("30");
  const [sections, setSections] = useState<ReportSection[]>(SECTION_OPTIONS.map((s) => s.key));

  const accountId = activeAccount?.id;

  // Solo se ofrecen secciones que tienen datos en las métricas actuales.
  const available = useMemo(() => {
    const m = activeMetrics;
    const has: Record<ReportSection, boolean> = {
      kpis: Boolean(m?.kpis?.length),
      growth: Boolean(m?.followersDaily?.length || m?.growth?.length),
      mix: Boolean(m?.engagementMix?.length),
      topPosts: Boolean(m?.topPosts?.length),
      retention: Boolean(m?.reelsRetention?.length),
      funnel: Boolean(m?.funnel?.length),
    };
    return SECTION_OPTIONS.filter((s) => has[s.key]);
  }, [activeMetrics]);

  // Periodos con respaldo real: KPIs por rango o serie diaria de seguidores.
  const periodChoices = useMemo(() => {
    const m = activeMetrics;
    const backed = PERIOD_OPTIONS.filter(
      (o) => o.key !== "all" && (m?.kpiRanges?.[o.key] || m?.followersDaily?.length),
    );
    return backed.length ? [...backed, PERIOD_OPTIONS[PERIOD_OPTIONS.length - 1]] : [];
  }, [activeMetrics]);

  // Al cambiar de cuenta: todas las secciones disponibles y el periodo por defecto.
  useEffect(() => {
    setSections(available.map((s) => s.key));
    setPeriod(periodChoices.some((o) => o.key === "30") ? "30" : periodChoices[0]?.key ?? "all");
  }, [accountId, available, periodChoices]);

  const toggleSection = (key: ReportSection) =>
    setSections((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));

  // Reportes viejos (sin reportMeta.sections) muestran todo, como siempre.
  const inReport = (r: Report, key: ReportSection) =>
    !r.data.reportMeta?.sections || r.data.reportMeta.sections.includes(key);

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
          body: JSON.stringify({
            accountId,
            note,
            ...(period !== "all" ? { period } : {}),
            sections: sections.filter((s) => available.some((a) => a.key === s)),
          }),
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
              Elige el periodo y qué secciones incluir, y guarda una foto de tus métricas para ver cómo
              evolucionas con el tiempo y compartir resultados en PDF.
            </p>
          </div>
        </div>

        <div className="report-config">
          {periodChoices.length > 0 && (
            <div className="report-config-row">
              <span className="report-config-label">Periodo</span>
              <div className="filters" role="group" aria-label="Periodo del reporte">
                {periodChoices.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    className={`chip${period === o.key ? " active" : ""}`}
                    onClick={() => setPeriod(o.key)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {available.length > 0 && (
            <div className="report-config-row">
              <span className="report-config-label">Incluir</span>
              <div className="filters" role="group" aria-label="Secciones del reporte">
                {available.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`chip${sections.includes(s.key) ? " active" : ""}`}
                    aria-pressed={sections.includes(s.key)}
                    onClick={() => toggleSection(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="report-generate">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota opcional (contexto del periodo, campañas activas...)"
            />
            <button
              className="button primary"
              disabled={busy || !accountId || sections.length === 0}
              onClick={generate}
              title={sections.length === 0 ? "Elige al menos una sección" : undefined}
            >
              {busy ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}{" "}
              {busy ? "Generando…" : "Generar reporte"}
            </button>
          </div>
          {sections.length === 0 && (
            <p className="field-hint" style={{ margin: 0 }}>
              Elige al menos una sección para poder generar el reporte.
            </p>
          )}
        </div>

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
                    {r.data.reportMeta?.periodLabel ? ` · ${r.data.reportMeta.periodLabel}` : ""}
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
                    <button className="warn" onClick={() => remove(r.id)} title="Eliminar reporte" aria-label="Eliminar reporte">
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
                    {open.data.reportMeta?.periodLabel ? ` · Periodo: ${open.data.reportMeta.periodLabel}` : ""}
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

              {inReport(open, "kpis") && (
                <div className="metric-grid report-kpis">
                  {open.data.kpis.map((kpi) => (
                    <article className="metric-card" key={kpi.label} style={{ ["--accent" as string]: accentVar(kpi.color) }}>
                      <span>{kpi.label}</span>
                      <strong>{kpi.value}</strong>
                      <p>{kpi.detail}</p>
                      <KpiIcon label={kpi.label} />
                    </article>
                  ))}
                </div>
              )}

              {(inReport(open, "growth") || inReport(open, "mix")) && (
                <div className="report-charts">
                  {inReport(open, "growth") && (
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
                  )}
                  {inReport(open, "mix") && (
                    <section className="chart-card">
                      <div className="chart-top">
                        <div>
                          <p className="eyebrow">Qué genera reacciones</p>
                          <h2>Qué generó acción</h2>
                        </div>
                      </div>
                      <div className="donut-wrap">
                        <Donut metrics={open.data} />
                        <div className="legend">
                          {open.data.engagementMix.map((m) => (
                            <div className="legend-row" key={m.label} style={{ ["--accent" as string]: accentVar(m.color) }}>
                              <span className="legend-dot" />
                              <span>{m.label}</span>
                              <b>{m.value}</b>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              )}

              <div className="report-charts">
                {inReport(open, "topPosts") && open.data.topPosts?.length ? (
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
                                ["--meter" as string]: `linear-gradient(90deg, ${accentVar(p.color)}, color-mix(in srgb, ${accentVar(p.color)} 22%, transparent))`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {inReport(open, "retention") && open.data.reelsRetention?.length ? (
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
                                ["--meter" as string]: `linear-gradient(90deg, ${accentVar(r.color)}, color-mix(in srgb, ${accentVar(r.color)} 22%, transparent))`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {inReport(open, "funnel") && (
                <section className="chart-card">
                  <div className="chart-top">
                    <div>
                      <p className="eyebrow">Ruta a la acción</p>
                      <h2>De tu alcance a tus seguidores</h2>
                    </div>
                    <div className="chart-value">
                      <strong>{open.data.ctrBio}</strong>clic al link
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
                              ["--meter" as string]: `linear-gradient(90deg, ${accentVar(f.color)}, color-mix(in srgb, ${accentVar(f.color)} 22%, transparent))`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
