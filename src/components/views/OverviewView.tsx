"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store-context";
import { Piece } from "@/lib/types";
import { relativeTime } from "@/lib/utils";
import PostCard from "@/components/PostCard";
import { Donut, LineChart } from "@/components/charts";

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;
import MetricsEditor from "@/components/MetricsEditor";
import KpiIcon from "@/components/KpiIcon";

const RANGE_OPTIONS: { key: string; label: string }[] = [
  { key: "1", label: "Hoy" },
  { key: "7", label: "7 días" },
  { key: "30", label: "30 días" },
];

const FOLLOWER_SERIES: { key: "total" | "gained" | "lost" | "net"; label: string; color?: string }[] = [
  { key: "total", label: "Totales" },
  { key: "gained", label: "Ganados", color: "#3adf85" },
  { key: "lost", label: "Perdidos", color: "#ff5d51" },
  { key: "net", label: "Netos", color: "#7a8cff" },
];

/** Rangos del histórico: los largos aparecen solos cuando el acumulado diario los alcanza. */
const followerRanges = (days: number) =>
  [7, 14, 30, 60, 90, 365].filter((r, i, arr) => i < 3 || days > arr[i - 1]);

// Código de colores por tiempo promedio de reel (coherente con el sync y la caída por tramo).
const RET_LEGEND: { label: string; color: string }[] = [
  { label: "0-3s", color: "#7a8cff" },
  { label: "3-8s", color: "#80ffb5" },
  { label: "8-15s", color: "#feda75" },
  { label: "15-30s", color: "#ffa14e" },
  { label: "30s+", color: "#ff5d51" },
];

export default function OverviewView({ pieces }: { pieces: Piece[] }) {
  const { activeMetrics, activeAccount, canEdit } = useStore();
  const [editing, setEditing] = useState(false);
  const [range, setRange] = useState("30");
  const [mixHover, setMixHover] = useState<number | null>(null);
  const [fSeries, setFSeries] = useState<"total" | "gained" | "lost" | "net">("total");
  const [fRange, setFRange] = useState(30);

  // Serie de seguidores: ganados/perdidos vienen del sync; netos y totales se derivan.
  const followers = useMemo(() => {
    const daily = activeMetrics?.followersDaily;
    if (!daily?.length) return null;
    const net = daily.map((d) => d.gained - d.lost);
    let running = activeMetrics?.followersTotal ?? 0;
    const total = [...net].reverse().map((n) => {
      const t = running;
      running -= n;
      return t;
    }).reverse();
    const slice = <T,>(arr: T[]) => arr.slice(-fRange);
    const series = {
      gained: slice(daily.map((d) => d.gained)),
      lost: slice(daily.map((d) => d.lost)),
      net: slice(net),
      total: slice(total),
    };
    const dates = slice(daily.map((d) => d.date));
    const ranges = followerRanges(daily.length);
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const netSum = sum(series.net);
    const headline = {
      total: activeMetrics?.followersTotal != null ? compact(activeMetrics.followersTotal) : "—",
      gained: `+${compact(sum(series.gained))}`,
      lost: `-${compact(sum(series.lost))}`,
      net: `${netSum >= 0 ? "+" : "-"}${compact(Math.abs(netSum))}`,
    };
    const caption = {
      total: "seguidores hoy",
      gained: `ganados en ${fRange} días`,
      lost: `perdidos en ${fRange} días`,
      net: `netos en ${fRange} días`,
    };
    return { series, headline, caption, dates, ranges };
  }, [activeMetrics, fRange]);

  const hasRanges = Boolean(activeMetrics?.kpiRanges && Object.keys(activeMetrics.kpiRanges).length > 1);
  const kpis = activeMetrics?.kpiRanges?.[range] ?? activeMetrics?.kpis ?? [];

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
          <p style={{ color: "var(--muted)", fontSize: 12, margin: "6px 0 0" }}>
            Fuente: API oficial de Instagram. Cada tarjeta indica qué mide y de qué periodo.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {hasRanges && (
            <div className="filters" role="group" aria-label="Rango de tiempo de los KPIs">
              {RANGE_OPTIONS.filter((o) => activeMetrics.kpiRanges?.[o.key]).map((o) => (
                <button
                  key={o.key}
                  className={`chip${range === o.key ? " active" : ""}`}
                  onClick={() => setRange(o.key)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {canEdit && (
            <button className="button small" onClick={() => setEditing(true)}>
              Editar métricas
            </button>
          )}
        </div>
      </div>

      <div className="metric-grid">
        {kpis.map((kpi, i) => (
          <article
            className="metric-card"
            key={`${kpi.label}-${range}`}
            style={{ ["--accent" as string]: kpi.color, ["--i" as string]: i }}
          >
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <p>{kpi.detail}</p>
            {kpi.delta ? (
              <div
                className={`delta${/^[+-]/.test(kpi.delta) ? (kpi.delta.startsWith("-") ? " down" : " up") : ""}`}
                title="Contra el periodo anterior del mismo tamaño"
              >
                {kpi.delta.startsWith("-") ? "▼" : kpi.delta.startsWith("+") ? "▲" : ""} {kpi.delta}
              </div>
            ) : null}
            <KpiIcon label={kpi.label} />
          </article>
        ))}
      </div>

      <div className="analytics-grid">
        <section className="chart-card tall">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Seguidores</p>
              <h2>{followers ? "Evolución diaria real" : "Crecimiento 30 días"}</h2>
              <p>
                {followers
                  ? "Totales, ganados, perdidos y netos por día. Lo mismo que ves en Instagram, aquí."
                  : "Evolución diaria para ver tendencia."}
              </p>
            </div>
            <div className="chart-value">
              {followers ? (
                <>
                  <strong>{followers.headline[fSeries]}</strong>
                  {followers.caption[fSeries]}
                </>
              ) : (
                <>
                  <strong>{activeMetrics.growthNet}</strong>seguidores netos
                </>
              )}
            </div>
          </div>
          {followers ? (
            <>
              <div className="follower-controls">
                <div className="filters" role="group" aria-label="Serie de seguidores">
                  {FOLLOWER_SERIES.map((s) => (
                    <button
                      key={s.key}
                      className={`chip${fSeries === s.key ? " active" : ""}`}
                      onClick={() => setFSeries(s.key)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="filters" role="group" aria-label="Rango de días">
                  {followers.ranges.map((d) => (
                    <button
                      key={d}
                      className={`chip${fRange === d ? " active" : ""}`}
                      onClick={() => setFRange(d)}
                    >
                      {d} días
                    </button>
                  ))}
                </div>
              </div>
              <LineChart
                key={`${fSeries}-${fRange}`}
                values={followers.series[fSeries]}
                labels={followers.dates}
                color={FOLLOWER_SERIES.find((s) => s.key === fSeries)?.color}
              />
            </>
          ) : (
            <LineChart values={activeMetrics.growth} />
          )}
        </section>

        <section className="chart-card tall">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Mix engagement</p>
              <h2>Qué está generando acción</h2>
              <p>Me gusta, comentarios, guardados y compartidos.</p>
            </div>
          </div>
          <div className="donut-wrap">
            <Donut metrics={activeMetrics} hovered={mixHover} onHover={setMixHover} />
            <div className="legend">
              {activeMetrics.engagementMix.map((m, i) => (
                <div
                  className={`legend-row${mixHover === i ? " on" : ""}`}
                  key={m.label}
                  style={{ ["--accent" as string]: m.color }}
                  onMouseEnter={() => setMixHover(i)}
                  onMouseLeave={() => setMixHover(null)}
                >
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
              <h2>Reels vs carruseles vs historias</h2>
            </div>
            <div className="chart-value">
              <strong>{activeMetrics.reachTotal}</strong>alcance
            </div>
          </div>
          <div className="bars-chart" style={{ ["--count" as string]: activeMetrics.reachByFormat.length }}>
            {activeMetrics.reachByFormat.map((r, i) => (
              <div className="bar-col" key={r.label} style={{ ["--accent" as string]: r.color, ["--i" as string]: i }}>
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
              <p className="eyebrow">Top publicaciones</p>
              <h2>Lo que más interacción generó</h2>
            </div>
            <div className="chart-value">
              <strong>{activeMetrics.topPosts?.length ?? 0}</strong>posts
            </div>
          </div>
          {activeMetrics.topPosts?.length ? (
            <div className="funnel-list">
              {activeMetrics.topPosts.map((p, i) => (
                <div className="funnel-step" key={`${p.label}-${i}`} style={{ ["--i" as string]: i }}>
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
          ) : (
            <div className="no-results">Se llena solo con la sincronización de Instagram.</div>
          )}
        </section>

        <section className="chart-card">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Retención reels</p>
              <h2>Caída por tramo</h2>
              <p>% de reels que retienen más de cada tramo.</p>
            </div>
            <div className="chart-value">
              <strong>{activeMetrics.retention?.some((r) => r.pct > 0) ? activeMetrics.retentionAvg : "—"}</strong>
              tiempo promedio
            </div>
          </div>
          {activeMetrics.retention?.some((r) => r.pct > 0) ? (
            <div className="retention-list">
              {activeMetrics.retention.map((r, i) => (
                <div className="retention-row" key={r.label} style={{ ["--i" as string]: i }}>
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
          ) : (
            <div className="no-results">Se llena solo con la sincronización de Instagram.</div>
          )}
        </section>

      </div>

      <section className="chart-card">
        <div className="chart-top">
          <div>
            <p className="eyebrow">Retención por reel</p>
            <h2>Tiempo promedio de visualización de cada reel</h2>
            <p>Segundos que la gente ve cada reel en promedio. Clic para abrir en Instagram.</p>
          </div>
          <div className="chart-value">
            <strong>{activeMetrics.reelsRetention?.length ?? 0}</strong>reels
          </div>
        </div>
        <div className="ret-legend" aria-label="Código de colores por segundos">
          {RET_LEGEND.map((l) => (
            <span className="ret-legend-item" key={l.label}>
              <span className="ret-legend-dot" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
        {activeMetrics.reelsRetention?.length ? (
          <div className="reel-ret-list">
            {activeMetrics.reelsRetention.map((r, i) => (
              <a
                className="reel-ret-row"
                key={`${r.label}-${i}`}
                href={r.permalink || undefined}
                target="_blank"
                rel="noreferrer"
                title={r.label}
                style={{ ["--accent" as string]: r.color, ["--i" as string]: i }}
              >
                {r.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="reel-ret-thumb" src={r.thumb} alt="" loading="lazy" />
                ) : (
                  <span className="reel-ret-thumb reel-ret-ph" />
                )}
                <span className="reel-ret-caption">{r.label}</span>
                <div className="meter">
                  <span
                    style={{
                      ["--score" as string]: `${r.pct}%`,
                      ["--meter" as string]: `linear-gradient(90deg, ${r.color}, rgba(255,255,255,.18))`,
                    }}
                  />
                </div>
                <b>{r.value}</b>
              </a>
            ))}
          </div>
        ) : (
          <div className="no-results">Se llena solo con la sincronización de Instagram.</div>
        )}
      </section>

      {activeMetrics.stories && (
        <section className="chart-card">
          <div className="chart-top">
            <div>
              <p className="eyebrow">Historias</p>
              <h2>Retención de las historias activas</h2>
              <p>Vistas, salidas, respuestas y % que la vio completa. Se capturan en cada sincronización (duran 24 h).</p>
            </div>
            <div className="chart-value">
              <strong>{activeMetrics.stories.length}</strong>activas
            </div>
          </div>
          {activeMetrics.stories.length ? (
            <div className="story-list">
              {activeMetrics.stories.map((s, i) => (
                <div className="story-row" key={`${s.label}-${i}`} style={{ ["--i" as string]: i }}>
                  <span className="story-when">{s.label}</span>
                  <span className="story-cell">
                    <b>{s.views?.toLocaleString("es-MX") ?? "—"}</b>
                    <small>vistas</small>
                  </span>
                  <span className="story-cell">
                    <b>{s.exits?.toLocaleString("es-MX") ?? "—"}</b>
                    <small>salidas</small>
                  </span>
                  <span className="story-cell">
                    <b>{s.replies?.toLocaleString("es-MX") ?? "—"}</b>
                    <small>respuestas</small>
                  </span>
                  <div className="meter">
                    <span
                      style={{
                        ["--score" as string]: `${s.completion ?? 0}%`,
                        ["--meter" as string]: "linear-gradient(90deg, var(--violet), rgba(255,255,255,.18))",
                      }}
                    />
                  </div>
                  <b>{s.completion != null ? `${s.completion}%` : "—"}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-results">
              No había historias activas en la última sincronización. Publica una historia y en el siguiente
              sync aparecen sus métricas.
            </div>
          )}
        </section>
      )}

      <div className="analytics-grid three">
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
            {activeMetrics.funnel.map((f, i) => (
              <div className="funnel-step" key={f.label} style={{ ["--i" as string]: i }}>
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
              <div
                className="heat-cell"
                key={`${cell.day}-${cell.hour}-${i}`}
                style={{ ["--heat" as string]: cell.heat, ["--i" as string]: i }}
              >
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

      <section className="chart-card">
        <div className="chart-top">
          <div>
            <p className="eyebrow">Vista previa</p>
            <h2>Últimas publicaciones</h2>
            <p>Miniaturas reales del feed. Clic para abrir en Instagram.</p>
          </div>
          <div className="chart-value">
            <strong>{activeMetrics.recentPosts?.length ?? 0}</strong>posts
          </div>
        </div>
        {activeMetrics.recentPosts?.length ? (
          <div className="post-grid">
            {activeMetrics.recentPosts.map((post, i) => (
              <a
                className="post-thumb"
                key={post.id}
                href={post.permalink || undefined}
                target="_blank"
                rel="noreferrer"
                title={post.caption}
                style={{ ["--i" as string]: i }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.thumb} alt={post.caption || post.format} loading="lazy" />
                <span className="post-overlay">
                  <b>{post.format}</b>
                  <span>
                    ♥ {compact(post.likes)} · 💬 {compact(post.comments)}
                  </span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="no-results">Se llena solo con la sincronización de Instagram.</div>
        )}
      </section>

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
            {(activeMetrics.anomalies ?? []).map((a) => {
              const fecha = new Date(`${a.date}T12:00:00`).toLocaleDateString("es-MX", {
                weekday: "long",
                day: "numeric",
                month: "short",
              });
              return (
                <div
                  className="alert"
                  key={`anom-${a.date}`}
                  style={{ ["--accent" as string]: a.net < 0 ? "var(--coral)" : "var(--green)" }}
                >
                  <strong>{a.net < 0 ? "Caída fuerte de seguidores" : "Pico de seguidores"}</strong>
                  <p>
                    {a.net < 0 ? "Perdiste" : "Ganaste"} {Math.abs(a.net).toLocaleString("es-MX")} seguidores
                    netos el {fecha}. Detectado automáticamente contra tu ritmo normal.
                  </p>
                </div>
              );
            })}
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
