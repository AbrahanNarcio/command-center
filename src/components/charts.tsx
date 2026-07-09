"use client";

import { useId, useState } from "react";
import { AccountMetrics } from "@/lib/types";

const fmtNum = (n: number) => n.toLocaleString("es-MX");
const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: undefined });

export function LineChart({
  values,
  color,
  labels,
}: {
  values: number[];
  color?: string;
  /** Fecha (YYYY-MM-DD) de cada punto, para el tooltip. */
  labels?: string[];
}) {
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (values.length < 2) {
    return (
      <div className="line-chart" style={{ display: "grid", placeItems: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "0 20px" }}>
          La línea se dibuja con un punto por día.
          <br />
          Mañana, después del sync automático, aparece el primer tramo.
        </p>
      </div>
    );
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 92 - ((value - min) / range) * 78;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const strokeId = `stroke-${uid}`;
  const fillId = `fill-${uid}`;
  const xOf = (i: number) => (i / (values.length - 1)) * 100;
  const yOf = (i: number) => 92 - ((values[i] - min) / range) * 78;
  return (
    <div
      className="line-chart has-tip"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        setHover(Math.max(0, Math.min(values.length - 1, Math.round(frac * (values.length - 1)))));
      }}
      onMouseLeave={() => setHover(null)}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Tendencia de crecimiento">
        <defs>
          <linearGradient id={strokeId} x1="0" x2="1" y1="0" y2="0">
            {color ? (
              <>
                <stop offset="0%" stopColor={color} stopOpacity="0.75" />
                <stop offset="100%" stopColor={color} />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#7a8cff" />
                <stop offset="55%" stopColor="#feda75" />
                <stop offset="100%" stopColor="#ff5c9c" />
              </>
            )}
          </linearGradient>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color ?? "#7a8cff"} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color ?? "#7a8cff"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon className="line-fill" points={`0,100 ${points} 100,100`} fill={`url(#${fillId})`} />
        <polyline
          className="line-draw"
          pathLength={100}
          points={points}
          fill="none"
          stroke={`url(#${strokeId})`}
          strokeWidth={2.8}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {hover != null && (
        <>
          <span
            className="line-dot"
            style={{ left: `${xOf(hover)}%`, top: `${yOf(hover)}%`, background: color ?? "#7a8cff" }}
          />
          <div
            className="line-tip"
            style={{
              left: `${xOf(hover)}%`,
              top: `${yOf(hover)}%`,
              transform: `translate(${xOf(hover) > 78 ? "-108%" : xOf(hover) < 12 ? "8%" : "-50%"}, -130%)`,
            }}
          >
            <b>{fmtNum(values[hover])}</b>
            {labels?.[hover] && <span>{fmtDate(labels[hover])}</span>}
          </div>
        </>
      )}
    </div>
  );
}

const DONUT_R = 45.5;
const DONUT_C = 2 * Math.PI * DONUT_R;

export function Donut({
  metrics,
  hovered = null,
  onHover,
}: {
  metrics: AccountMetrics;
  /** Segmento resaltado (se sincroniza con la leyenda). */
  hovered?: number | null;
  onHover?: (index: number | null) => void;
}) {
  const mix = metrics.engagementMix;
  const total = mix.reduce((sum, m) => sum + (parseFloat(m.value) || 0), 0) || 100;
  let acc = 0;
  const segments = mix.map((m, i) => {
    const frac = (parseFloat(m.value) || 0) / total;
    const seg = { ...m, index: i, len: frac * DONUT_C, offset: acc * DONUT_C };
    acc += frac;
    return seg;
  });
  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" role="img" aria-label="Mix de engagement">
        {segments.map((s) => (
          <circle
            key={s.label}
            className={`donut-seg${hovered == null ? "" : hovered === s.index ? " on" : " off"}`}
            cx="60"
            cy="60"
            r={DONUT_R}
            fill="none"
            stroke={s.color}
            strokeDasharray={`${Math.max(s.len - 1.5, 0.01)} ${DONUT_C - Math.max(s.len - 1.5, 0.01)}`}
            strokeDashoffset={-s.offset}
            onMouseEnter={() => onHover?.(s.index)}
            onMouseLeave={() => onHover?.(null)}
          >
            <title>{`${s.label}: ${s.value}`}</title>
          </circle>
        ))}
      </svg>
      <div className="donut-center">{metrics.engagementRate}</div>
    </div>
  );
}
