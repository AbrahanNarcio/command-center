"use client";

import { useStore } from "@/lib/store-context";
import { AudienceBreakdown } from "@/lib/types";
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

/** Tarjeta de demografía: barra 100% por género + distribución por edad. */
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
          <div className="aud-split" role="img" aria-label={`Distribución por género: ${data.gender.map((g) => `${g.label} ${g.pct}%`).join(", ")}`}>
            {data.gender.map((g) => (
              <span
                key={g.label}
                style={{ flex: g.value, background: GENDER_COLORS[g.label] ?? "var(--violet)" }}
                title={`${g.label}: ${g.pct}% (${nf.format(g.value)})`}
              />
            ))}
          </div>
          <div className="ret-legend" aria-label="Género">
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

/** Audiencia: quién te sigue, quién ve tu contenido y qué publicaciones dieron
 *  seguidores. Visible para todos los roles (admin, editor y cliente). */
export default function AudienceView() {
  const { activeAccount, activeMetrics } = useStore();

  if (!activeMetrics) return <div className="no-results">Sin métricas para esta cuenta.</div>;

  const follows = activeMetrics.followsPosts ?? [];
  const maxFollows = Math.max(...follows.map((p) => p.follows), 1);
  const reels = activeMetrics.reelsTopReach ?? [];
  const maxReach = Math.max(...reels.map((p) => p.reach), 1);

  return (
    <>
      <div className="panel-head">
        <div>
          <p className="eyebrow">{activeAccount?.handle}</p>
          <h2>Audiencia · actualizado {relativeTime(activeMetrics.updatedAt)}</h2>
          <p style={{ color: "var(--muted)", fontSize: 12, margin: "6px 0 0" }}>
            Fuente: API oficial de Instagram. Quién te sigue, quién ve tu contenido y qué
            publicaciones te dieron seguidores.
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

      <section className="chart-card">
        <div className="chart-top">
          <div>
            <p className="eyebrow">Crecimiento por publicación</p>
            <h2>Publicaciones que te dieron seguidores</h2>
            <p>
              Cuántas cuentas empezaron a seguirte después de ver cada publicación, de mayor a
              menor. Instagram comparte este dato solo para posts y carruseles del feed — para
              reels no lo expone. Clic para abrir en Instagram.
            </p>
          </div>
          {follows.length > 0 && (
            <div className="chart-value">
              <strong>{follows.length}</strong>publicaciones
            </div>
          )}
        </div>
        {follows.length ? (
          <div className="aud-rank-list">
            {follows.map((p, i) => (
              <a
                className="aud-row"
                key={p.id}
                href={p.permalink || undefined}
                target="_blank"
                rel="noreferrer"
                title={`${p.caption || p.format} · ${p.date}`}
                style={{ ["--i" as string]: i }}
              >
                <span className="aud-rank">{i + 1}</span>
                {p.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="reel-ret-thumb" src={p.thumb} alt="" loading="lazy" onError={hideOnImgError} />
                ) : (
                  <span className="reel-ret-thumb reel-ret-ph" />
                )}
                <span className="aud-caption">
                  <span className="aud-caption-text">{p.caption || p.format}</span>
                  <span className="aud-date">
                    {p.format} · {p.date}
                  </span>
                </span>
                <div className="meter">
                  <span
                    style={{
                      ["--score" as string]: `${Math.max(4, Math.round((p.follows / maxFollows) * 100))}%`,
                      ["--meter" as string]:
                        "linear-gradient(90deg, var(--green), color-mix(in srgb, var(--green) 22%, transparent))",
                    }}
                  />
                </div>
                <b className="aud-follows">+{nf.format(p.follows)}</b>
              </a>
            ))}
          </div>
        ) : (
          <div className="no-results">
            Sin datos todavía. Se llenan con la sincronización, y solo si la cuenta tiene
            publicaciones en el feed (posts o carruseles): Instagram no comparte los seguidores
            ganados por reel.
          </div>
        )}
      </section>

      <section className="chart-card">
        <div className="chart-top">
          <div>
            <p className="eyebrow">Reels · alcance</p>
            <h2>Reels que más cuentas alcanzaron</h2>
            <p>
              Instagram no comparte cuántos seguidores dio cada reel (ese dato solo existe para
              posts y carruseles, arriba). Lo más cercano que su API ofrece por reel es el
              alcance: cuántas cuentas únicas lo vieron. De tus últimos reels sincronizados, de
              mayor a menor. Clic para abrir en Instagram.
            </p>
          </div>
          {reels.length > 0 && (
            <div className="chart-value">
              <strong>{reels.length}</strong>reels
            </div>
          )}
        </div>
        {reels.length ? (
          <div className="aud-rank-list">
            {reels.map((p, i) => (
              <a
                className="aud-row"
                key={p.id}
                href={p.permalink || undefined}
                target="_blank"
                rel="noreferrer"
                title={`${p.caption || "Reel"} · ${p.date}`}
                style={{ ["--i" as string]: i, ["--accent" as string]: "var(--lime)" }}
              >
                <span className="aud-rank">{i + 1}</span>
                {p.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="reel-ret-thumb" src={p.thumb} alt="" loading="lazy" onError={hideOnImgError} />
                ) : (
                  <span className="reel-ret-thumb reel-ret-ph" />
                )}
                <span className="aud-caption">
                  <span className="aud-caption-text">{p.caption || "Reel"}</span>
                  <span className="aud-date">Reels · {p.date}</span>
                </span>
                <div className="meter">
                  <span
                    style={{
                      ["--score" as string]: `${Math.max(4, Math.round((p.reach / maxReach) * 100))}%`,
                      ["--meter" as string]:
                        "linear-gradient(90deg, var(--lime), color-mix(in srgb, var(--lime) 22%, transparent))",
                    }}
                  />
                </div>
                <b className="aud-follows">{compact(p.reach)}</b>
              </a>
            ))}
          </div>
        ) : (
          <div className="no-results">Sin reels sincronizados todavía para esta cuenta.</div>
        )}
      </section>
    </>
  );
}
