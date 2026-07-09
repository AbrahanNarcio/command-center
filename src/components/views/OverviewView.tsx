"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store-context";
import { Piece } from "@/lib/types";
import { relativeTime } from "@/lib/utils";
import PostCard from "@/components/PostCard";
import { Donut, LineChart } from "@/components/charts";
import MetricsEditor from "@/components/MetricsEditor";

export default function OverviewView({ pieces }: { pieces: Piece[] }) {
  const { activeMetrics, activeAccount, canEdit } = useStore();
  const [editing, setEditing] = useState(false);

  const ops = useMemo(() => {
    const ready = pieces.filter((p) => ["Aprobado", "Programado"].includes(p.status)).length;
    const blocked = pieces.filter((p) => p.score < 70).length;
    const avg = pieces.length
      ? Math.round(pieces.reduce((s, p) => s + p.score, 0) / pieces.length)
      : 0;
    const reels = pieces.filter((p) => p.format === "Reel").length;
    return [
      { label: "Piezas activas", value: pieces.length, detail: "En la semana" },
      { label: "Listas", value: ready, detail: "Aprobadas/programadas" },
      { label: "Score medio", value: avg, detail: "Quality gate" },
      { label: "Reels", value: reels, detail: "Motor principal" },
      { label: "Bloqueos", value: blocked, detail: "Score bajo 70" },
      { label: "Publicables", value: ready, detail: "Listas para salir" },
    ];
  }, [pieces]);

  const winners = useMemo(
    () => pieces.slice().sort((a, b) => b.score - a.score).slice(0, 4),
    [pieces],
  );
  const alerts = useMemo(() => pieces.filter((p) => p.score < 75), [pieces]);

  if (!activeMetrics) return <div className="no-results">Sin métricas para esta cuenta.</div>;

  return (
    <div className="ig-dashboard">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{activeAccount?.handle}</p>
          <h2>Métricas · actualizado {relativeTime(activeMetrics.updatedAt)}</h2>
        </div>
        {canEdit && (
          <button className="button small" onClick={() => setEditing(true)}>
            Editar métricas
          </button>
        )}
      </div>

      <div className="metric-grid">
        {activeMetrics.kpis.map((kpi) => (
          <article className="metric-card" key={kpi.label} style={{ ["--accent" as string]: kpi.color }}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <p>{kpi.detail}</p>
            <div className="delta">{kpi.delta}</div>
          </article>
        ))}
      </div>

      <div className="analytics-grid">
        <section className="chart-card tall">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Crecimiento 30 días</p>
              <h2>Seguidores, alcance e interacción</h2>
              <p>Evolución diaria para ver tendencia.</p>
            </div>
            <div className="chart-value">
              <strong>{activeMetrics.growthNet}</strong>net followers
            </div>
          </div>
          <LineChart values={activeMetrics.growth} />
        </section>

        <section className="chart-card tall">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Mix engagement</p>
              <h2>Qué está generando acción</h2>
              <p>Likes, comentarios, saves, shares y DMs.</p>
            </div>
          </div>
          <div className="donut-wrap">
            <Donut metrics={activeMetrics} />
            <div className="legend">
              {activeMetrics.engagementMix.map((m) => (
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

      <div className="analytics-grid three">
        <section className="chart-card">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Alcance por formato</p>
              <h2>Reels vs carruseles vs stories</h2>
            </div>
            <div className="chart-value">
              <strong>{activeMetrics.reachTotal}</strong>reach
            </div>
          </div>
          <div className="bars-chart" style={{ ["--count" as string]: activeMetrics.reachByFormat.length }}>
            {activeMetrics.reachByFormat.map((r) => (
              <div className="bar-col" key={r.label} style={{ ["--accent" as string]: r.color }}>
                <div className="bar-stack">
                  <div className="bar-fill" style={{ height: `${r.pct}%` }} />
                </div>
                <span>{r.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="chart-card">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Retención reels</p>
              <h2>Caída por tramo</h2>
            </div>
            <div className="chart-value">
              <strong>{activeMetrics.retentionAvg}</strong>avg finish
            </div>
          </div>
          <div className="retention-list">
            {activeMetrics.retention.map((r) => (
              <div className="retention-row" key={r.label}>
                <span>{r.label}</span>
                <div className="meter">
                  <span
                    style={{
                      ["--score" as string]: `${r.pct}%`,
                      ["--meter" as string]: `linear-gradient(90deg, ${r.color}, rgba(255,255,255,.18))`,
                    }}
                  />
                </div>
                <b>{r.pct}%</b>
              </div>
            ))}
          </div>
        </section>

        <section className="chart-card">
          <div className="chart-top">
            <div>
              <p className="eyebrow">CTR / perfil</p>
              <h2>Ruta a DM y agenda</h2>
            </div>
            <div className="chart-value">
              <strong>{activeMetrics.ctrBio}</strong>CTR bio
            </div>
          </div>
          <div className="funnel-list">
            {activeMetrics.funnel.map((f) => (
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

      <div className="analytics-grid">
        <section className="chart-card">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Performance horario</p>
              <h2>Heatmap de publicación</h2>
              <p>Intensidad por día/hora para decidir slots.</p>
            </div>
          </div>
          <div className="heatmap">
            {activeMetrics.heatmap.map((cell, i) => (
              <div className="heat-cell" key={`${cell.day}-${cell.hour}-${i}`} style={{ ["--heat" as string]: cell.heat }}>
                {cell.day}
                <span>{cell.hour}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="chart-card">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Operación de contenido</p>
              <h2>Lo que hay que mirar hoy</h2>
            </div>
          </div>
          <div className="mini-metrics">
            {ops.map((o) => (
              <article className="mini-metric" key={o.label}>
                <span>{o.label}</span>
                <strong>{o.value}</strong>
                <p style={{ color: "var(--soft)", fontSize: 12, margin: "6px 0 0" }}>{o.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="analytics-grid">
        <section className="chart-card">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Piezas ganadoras</p>
              <h2>Contenido con más señal comercial</h2>
            </div>
          </div>
          <div className="content-list">
            {winners.length ? (
              winners.map((p, i) => <PostCard key={p.id} piece={p} index={i} />)
            ) : (
              <div className="no-results">Sin piezas para este filtro.</div>
            )}
          </div>
        </section>

        <section className="chart-card">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Alertas + insights</p>
              <h2>Control de calidad</h2>
            </div>
          </div>
          <div className="alerts">
            {alerts.length ? (
              alerts.map((p) => (
                <div
                  className="alert"
                  key={p.id}
                  style={{ ["--accent" as string]: p.score < 65 ? "var(--coral)" : "var(--amber)" }}
                >
                  <strong>{p.hook}</strong>
                  <p>Score {p.score}. Revisar tensión, CTA o grababilidad antes de aprobar.</p>
                </div>
              ))
            ) : (
              <div className="alert" style={{ ["--accent" as string]: "var(--green)" }}>
                <strong>Sin rojos</strong>
                <p>El filtro actual no tiene bloqueos fuertes.</p>
              </div>
            )}
          </div>
          <div className="insights" style={{ marginTop: 10 }}>
            {activeMetrics.insights.map((ins) => (
              <div className="insight" key={ins.title} style={{ ["--accent" as string]: ins.color }}>
                <strong>{ins.title}</strong>
                <p>{ins.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {editing && <MetricsEditor metrics={activeMetrics} onClose={() => setEditing(false)} />}
    </div>
  );
}
