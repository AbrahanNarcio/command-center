"use client";

import { useMemo } from "react";
import { ArrowRight, BarChart3, Eye, HeartHandshake, Radar, Users } from "lucide-react";
import { Kpi } from "@/lib/types";
import { ViewId } from "@/lib/views";
import { useStore } from "@/lib/store-context";
import { isoDate, piecesForDate, weekDays } from "@/lib/plan";
import { FORMAT_META } from "@/components/FormatIcon";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/* Qué significa cada métrica, dicho para alguien de fuera. */
const PLAIN: Record<string, { icon: React.ReactNode; text: string }> = {
  Vistas: { icon: <Eye size={16} />, text: "Veces que se reprodujo tu contenido" },
  Alcance: { icon: <Radar size={16} />, text: "Cuentas distintas que vieron algo tuyo" },
  Interacción: { icon: <HeartHandshake size={16} />, text: "De cada 100 cuentas alcanzadas, cuántas reaccionaron" },
};

function DeltaChip({ delta }: { delta: string }) {
  if (!delta) return null;
  const down = delta.startsWith("-");
  const up = delta.startsWith("+");
  return (
    <span
      className={`delta${down ? " down" : up ? " up" : ""}`}
      title="Comparado con los 30 días anteriores"
    >
      {down ? "▼" : up ? "▲" : ""} {delta}
    </span>
  );
}

export default function SummaryView({ go }: { go: (view: ViewId) => void }) {
  const { activeAccount, activeMetrics, accountPieces } = useStore();

  // KPIs del rango de 30 días (el estándar del resumen).
  const kpis: Kpi[] = activeMetrics?.kpiRanges?.["30"] ?? activeMetrics?.kpis ?? [];
  const byLabel = (label: string) => kpis.find((k) => k.label === label);
  const followers = byLabel("Seguidores");
  const simple = ["Vistas", "Alcance", "Interacción"].map(byLabel).filter(Boolean) as Kpi[];

  // Ganados - perdidos de los últimos 30 días, para decirlo en una frase.
  const net30 = useMemo(() => {
    const daily = activeMetrics?.followersDaily;
    if (!daily?.length) return null;
    // Si la serie aún no acumula 30 días, la frase dice los días REALES
    // (invariante: no afirmar periodos que los datos no cubren).
    const days = Math.min(30, daily.length);
    return { days, net: daily.slice(-days).reduce((sum, d) => sum + d.gained - d.lost, 0) };
  }, [activeMetrics]);

  // Lo que queda de esta semana (de hoy al domingo).
  const today = new Date();
  const todayKey = isoDate(today);
  const upcoming = useMemo(() => {
    return weekDays(today)
      .filter((d) => isoDate(d) >= todayKey)
      .map((date) => ({
        date,
        items: piecesForDate(accountPieces, date, true),
      }))
      .filter((d) => d.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountPieces, todayKey]);

  return (
    <div className="summary">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Resumen · {activeAccount?.handle}</p>
            <h2>Cómo va tu cuenta</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
              Lo esencial de los últimos 30 días, sin tecnicismos. Para el detalle completo está el
              botón de abajo.
            </p>
          </div>
        </div>

        <div className="summary-hero">
          <div className="summary-followers">
            <span className="summary-ico">
              <Users size={18} />
            </span>
            <div>
              <strong>{followers?.value ?? "—"}</strong>
              <span>seguidores</span>
            </div>
          </div>
          {net30 != null && (
            <p className={`summary-net${net30.net < 0 ? " down" : " up"}`}>
              {net30.net >= 0 ? "▲ Ganaste" : "▼ Perdiste"} {Math.abs(net30.net).toLocaleString("es-MX")}{" "}
              seguidores en los últimos {net30.days} días.
            </p>
          )}
        </div>

        <div className="summary-cards">
          {simple.map((kpi) => (
            <article className="summary-card" key={kpi.label}>
              <span className="summary-ico" style={{ color: kpi.color }}>
                {PLAIN[kpi.label]?.icon}
              </span>
              <div className="summary-card-body">
                <span className="summary-card-label">{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <p>{PLAIN[kpi.label]?.text ?? kpi.detail}</p>
              </div>
              <DeltaChip delta={kpi.delta} />
            </article>
          ))}
          {!simple.length && (
            <div className="no-results">
              Las métricas aparecen aquí en cuanto la cuenta se sincroniza con Instagram.
            </div>
          )}
        </div>
        {simple.length > 0 && (
          <p style={{ color: "var(--muted)", fontSize: 12, margin: "10px 0 0" }}>
            Las flechas ▲▼ comparan contra los 30 días anteriores.
          </p>
        )}

        <div className="hero-actions" style={{ marginTop: 16 }}>
          <button className="button" onClick={() => go("overview")}>
            <BarChart3 size={15} /> Ver métricas completas
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Esta semana</p>
            <h2>Qué se publica</h2>
          </div>
          <button className="button small" onClick={() => go("plan")}>
            Ver planeación completa <ArrowRight size={13} />
          </button>
        </div>
        {upcoming.length ? (
          <div className="summary-week">
            {upcoming.map(({ date, items }) => (
              <div className="summary-week-day" key={isoDate(date)}>
                <strong>
                  {DAY_NAMES[(date.getDay() + 6) % 7]}
                  {isoDate(date) === todayKey ? " · hoy" : ""}
                </strong>
                {items.map((p) => {
                  const meta = FORMAT_META[p.format];
                  const isAd = p.format === "Ad";
                  return (
                    <div className="plan-item" key={p.id} style={{ ["--fmt" as string]: meta.color }}>
                      <span className="plan-ico" aria-hidden>
                        {meta.icon}
                      </span>
                      <span className="plan-what">
                        <b>{meta.label}</b>
                        {!isAd && <i> · {p.time}</i>}
                      </span>
                      <span className="plan-hook">{isAd ? meta.hint : p.hook || p.summary || meta.hint}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-results">No hay publicaciones planeadas de hoy al domingo.</div>
        )}
      </section>
    </div>
  );
}
