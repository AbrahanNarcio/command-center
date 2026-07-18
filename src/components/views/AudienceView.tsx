"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store-context";
import { AudienceBreakdown, AudienceSlice } from "@/lib/types";
import { hideOnImgError, relativeTime } from "@/lib/utils";

/** Código de color estable del género (mismo concepto = mismo color en toda la app):
 *  Mujeres rosa, Hombres azul, Sin especificar gris. */
const GENDER_COLORS: Record<string, string> = {
  Mujeres: "var(--pink)",
  Hombres: "var(--cyan)",
  "Sin especificar": "var(--muted)",
};

const nf = new Intl.NumberFormat("es-MX");

/** Número compacto para valores grandes (1.2M / 86.2K), como en los KPIs. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return nf.format(n);
}

/** Pastel de género (SVG de rebanadas reales, no dona). */
function GenderPie({ slices }: { slices: AudienceSlice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 54;
  const C = 60;
  let angle = -Math.PI / 2;
  const wedges = slices.map((s) => {
    const frac = s.value / total;
    const a0 = angle;
    const a1 = angle + frac * 2 * Math.PI;
    angle = a1;
    return { ...s, a0, a1, frac };
  });
  const pt = (a: number) => `${(C + R * Math.cos(a)).toFixed(2)},${(C + R * Math.sin(a)).toFixed(2)}`;
  return (
    <svg
      viewBox="0 0 120 120"
      className="aud-pie-svg"
      role="img"
      aria-label={`Distribución por género: ${slices.map((s) => `${s.label} ${s.pct}%`).join(", ")}`}
    >
      {wedges.map((w) =>
        w.frac >= 0.999 ? (
          <circle key={w.label} cx={C} cy={C} r={R} style={{ fill: GENDER_COLORS[w.label] ?? "var(--violet)" }}>
            <title>{`${w.label}: ${w.pct}%`}</title>
          </circle>
        ) : w.frac <= 0.0005 ? null : (
          <path
            key={w.label}
            className="aud-pie-wedge"
            d={`M ${C},${C} L ${pt(w.a0)} A ${R} ${R} 0 ${w.a1 - w.a0 > Math.PI ? 1 : 0} 1 ${pt(w.a1)} Z`}
            style={{ fill: GENDER_COLORS[w.label] ?? "var(--violet)" }}
          >
            <title>{`${w.label}: ${w.pct}% (${nf.format(w.value)})`}</title>
          </path>
        ),
      )}
    </svg>
  );
}

/** Tarjeta de demografía: pastel por género + distribución por edad en barras. */
function DemographicsCard({
  eyebrow,
  title,
  hint,
  data,
}: {
  eyebrow: string;
  title: string;
  hint: string;
  data?: AudienceBreakdown;
}) {
  const maxAge = data ? Math.max(...data.age.map((a) => a.pct), 1) : 1;
  return (
    <section className="chart-card">
      <div className="chart-top">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        {data && (
          <div className="chart-value">
            <strong>{nf.format(data.total)}</strong>cuentas
          </div>
        )}
      </div>
      {data ? (
        <>
          <div className="aud-pie">
            <GenderPie slices={data.gender} />
            <div className="aud-pie-legend">
              {data.gender.map((g) => (
                <span
                  className="ret-legend-item"
                  key={g.label}
                  title={g.label === "Sin especificar" ? "Cuentas que no comparten su género en Instagram" : `${nf.format(g.value)} cuentas`}
                >
                  <span className="ret-legend-dot" style={{ background: GENDER_COLORS[g.label] ?? "var(--violet)" }} />
                  {g.label} · {g.pct}%
                </span>
              ))}
            </div>
          </div>
          <div className="aud-ages" aria-label="Distribución por edad">
            {data.age.map((a) => (
              <div className="aud-age-row" key={a.label} title={`${a.label} años: ${a.pct}% (${nf.format(a.value)})`}>
                <span>{a.label}</span>
                <div className="meter">
                  <span
                    style={{
                      ["--score" as string]: `${Math.round((a.pct / maxAge) * 100)}%`,
                      ["--meter" as string]:
                        "linear-gradient(90deg, var(--violet), color-mix(in srgb, var(--violet) 22%, transparent))",
                    }}
                  />
                </div>
                <b>{a.pct}%</b>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="no-results">
          Instagram aún no comparte estos datos para esta cuenta. Se llenan con la sincronización
          (las cuentas con muy pocos seguidores no tienen demografía disponible).
        </div>
      )}
    </section>
  );
}

/* ── Rankings con selector de métrica ───────────────────────── */

type MetricKey = "follows" | "followsday" | "reach" | "likes" | "comments";

const METRIC_DEFS: Record<MetricKey, { chip: string; color: string; fmt: (n: number) => string }> = {
  follows: { chip: "Seguidores", color: "var(--green)", fmt: (n) => `+${nf.format(n)}` },
  /* Reels: Meta no da seguidores POR reel (follows/profile_visits/profile_activity
     bloqueados para reels, verificado en vivo); se usa la serie diaria REAL de la
     cuenta: seguidores ganados el día en que se publicó el reel. */
  followsday: { chip: "Seguidores del día", color: "var(--green)", fmt: (n) => `+${nf.format(n)}` },
  reach: { chip: "Alcance", color: "var(--lime)", fmt: compact },
  likes: { chip: "Me gusta", color: "var(--cyan)", fmt: compact },
  comments: { chip: "Comentarios", color: "var(--violet)", fmt: compact },
};

type RankItem = {
  id: string;
  thumb: string;
  permalink: string;
  caption: string;
  sub: string;
  values: Partial<Record<MetricKey, number | null>>;
};

/** Ranking de publicaciones con chips para elegir la métrica (se reordena al
 *  instante con los datos ya sincronizados; sin llamadas nuevas). */
function RankCard({
  eyebrow,
  titles,
  hint,
  hints,
  metricKeys,
  items,
  emptyText,
}: {
  eyebrow: string;
  titles: Partial<Record<MetricKey, string>>;
  hint: string;
  /** Explicación específica por métrica; si falta, se usa `hint`. */
  hints?: Partial<Record<MetricKey, string>>;
  metricKeys: MetricKey[];
  items: RankItem[];
  emptyText: string;
}) {
  const [metric, setMetric] = useState<MetricKey>(metricKeys[0]);
  const def = METRIC_DEFS[metric];
  const rows = useMemo(() => {
    return items
      .map((it) => ({ ...it, v: it.values[metric] ?? null }))
      .sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  }, [items, metric]);
  const max = Math.max(...rows.map((r) => r.v ?? 0), 1);

  return (
    <section className="chart-card">
      <div className="chart-top">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{titles[metric] ?? ""}</h2>
          <p>{hints?.[metric] ?? hint}</p>
        </div>
        <div className="filters" role="group" aria-label="Métrica del ranking">
          {metricKeys.map((k) => (
            <button
              key={k}
              className={`chip${metric === k ? " active" : ""}`}
              onClick={() => setMetric(k)}
            >
              {METRIC_DEFS[k].chip}
            </button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div className="aud-rank-list">
          {rows.map((p, i) => (
            <a
              className="aud-row"
              key={p.id}
              href={p.permalink || undefined}
              target="_blank"
              rel="noreferrer"
              title={`${p.caption} · ${p.sub}`}
              style={{ ["--i" as string]: i, ["--accent" as string]: def.color }}
            >
              <span className="aud-rank">{i + 1}</span>
              {p.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="reel-ret-thumb" src={p.thumb} alt="" loading="lazy" onError={hideOnImgError} />
              ) : (
                <span className="reel-ret-thumb reel-ret-ph" />
              )}
              <span className="aud-caption">
                <span className="aud-caption-text">{p.caption}</span>
                <span className="aud-date">{p.sub}</span>
              </span>
              <div className="meter">
                <span
                  style={{
                    ["--score" as string]: p.v == null ? "0%" : `${Math.max(4, Math.round((p.v / max) * 100))}%`,
                    ["--meter" as string]: `linear-gradient(90deg, ${def.color}, color-mix(in srgb, ${def.color} 22%, transparent))`,
                  }}
                />
              </div>
              <b className="aud-follows">{p.v == null ? "—" : def.fmt(p.v)}</b>
            </a>
          ))}
        </div>
      ) : (
        <div className="no-results">{emptyText}</div>
      )}
    </section>
  );
}

/** Audiencia: quién te sigue, quién ve tu contenido y qué publicaciones/reels
 *  funcionan mejor por métrica. Visible para todos los roles. */
export default function AudienceView() {
  const { activeAccount, activeMetrics } = useStore();

  const feedItems = useMemo<RankItem[]>(
    () =>
      (activeMetrics?.followsPosts ?? []).map((p) => ({
        id: p.id,
        thumb: p.thumb,
        permalink: p.permalink,
        caption: p.caption || p.format,
        sub: `${p.format} · ${p.date}`,
        values: {
          follows: p.follows,
          reach: p.reach ?? null,
          likes: p.likes ?? null,
          comments: p.comments ?? null,
        },
      })),
    [activeMetrics?.followsPosts],
  );

  // Seguidores ganados por día (serie diaria real de la cuenta), para el chip
  // "Seguidores del día" de los reels.
  const dayGain = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of activeMetrics?.followersDaily ?? []) m.set(d.date, d.gained);
    return m;
  }, [activeMetrics?.followersDaily]);

  const reelItems = useMemo<RankItem[]>(
    () =>
      (activeMetrics?.reelsTopReach ?? []).map((p) => ({
        id: p.id,
        thumb: p.thumb,
        permalink: p.permalink,
        caption: p.caption || "Reel",
        sub: `Reels · ${p.date}`,
        values: {
          reach: p.reach,
          followsday: dayGain.get(p.date) ?? null,
          likes: p.likes ?? null,
          comments: p.comments ?? null,
        },
      })),
    [activeMetrics?.reelsTopReach, dayGain],
  );

  if (!activeMetrics) return <div className="no-results">Sin métricas para esta cuenta.</div>;

  return (
    <>
      <div className="panel-head">
        <div>
          <p className="eyebrow">{activeAccount?.handle}</p>
          <h2>Audiencia · actualizado {relativeTime(activeMetrics.updatedAt)}</h2>
          <p style={{ color: "var(--muted)", fontSize: 12, margin: "6px 0 0" }}>
            Fuente: API oficial de Instagram. Quién te sigue, quién ve tu contenido y qué
            publicaciones te funcionan mejor.
          </p>
        </div>
      </div>

      <div className="aud-grid">
        <DemographicsCard
          eyebrow="Tus seguidores"
          title="Quién te sigue"
          hint="Género y edad de tus seguidores actuales."
          data={activeMetrics.audienceFollowers}
        />
        <DemographicsCard
          eyebrow={`Tu alcance · ${activeMetrics.audienceReached?.windowLabel ?? "últimos 30 días"}`}
          title="Quién ve tu contenido"
          hint="Género y edad de las cuentas que alcanzaste en este periodo."
          data={activeMetrics.audienceReached}
        />
      </div>

      <RankCard
        eyebrow="Posts y carruseles del feed"
        titles={{
          follows: "Publicaciones que te dieron seguidores",
          reach: "Publicaciones que más cuentas alcanzaron",
          likes: "Publicaciones con más me gusta",
          comments: "Publicaciones con más comentarios",
        }}
        hint="Elige la métrica con los botones. Seguidores = cuentas que empezaron a seguirte tras ver la publicación (Instagram solo comparte ese dato para posts y carruseles del feed). Clic para abrir en Instagram."
        metricKeys={["follows", "reach", "likes", "comments"]}
        items={feedItems}
        emptyText="Sin datos todavía. Se llenan con la sincronización, y solo si la cuenta tiene publicaciones en el feed (posts o carruseles)."
      />

      <RankCard
        eyebrow="Reels"
        titles={{
          reach: "Reels que más cuentas alcanzaron",
          followsday: "Reels según los seguidores ganados el día que se publicaron",
          likes: "Reels con más me gusta",
          comments: "Reels con más comentarios",
        }}
        hint="Elige la métrica con los botones. Clic para abrir en Instagram."
        hints={{
          reach:
            "Elige la métrica con los botones. El alcance es cuántas cuentas únicas vieron cada reel. Clic para abrir en Instagram.",
          followsday:
            "Seguidores que ganó TODA tu cuenta el día que se publicó cada reel (tu serie diaria real). Instagram no comparte cuántos vinieron de cada reel: si ese día publicaste más contenido, el número es compartido. Los reels con fecha fuera de tu histórico diario muestran —.",
        }}
        metricKeys={["reach", "followsday", "likes", "comments"]}
        items={reelItems}
        emptyText="Sin reels sincronizados todavía para esta cuenta."
      />
    </>
  );
}
