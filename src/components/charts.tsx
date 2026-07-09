"use client";

import { AccountMetrics } from "@/lib/types";

export function LineChart({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="line-chart" />;
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
  return (
    <div className="line-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Tendencia de crecimiento">
        <defs>
          <linearGradient id="growthStroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#58e6ff" />
            <stop offset="55%" stopColor="#d8ff63" />
            <stop offset="100%" stopColor="#ff77bc" />
          </linearGradient>
          <linearGradient id="growthFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#58e6ff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#58e6ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${points} 100,100`} fill="url(#growthFill)" />
        <polyline
          points={points}
          fill="none"
          stroke="url(#growthStroke)"
          strokeWidth={2.8}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export function Donut({ metrics }: { metrics: AccountMetrics }) {
  const mix = metrics.engagementMix;
  let acc = 0;
  const stops: string[] = [];
  const total = mix.reduce((sum, m) => sum + parseFloat(m.value) || 0, 0) || 100;
  for (const m of mix) {
    const pct = (parseFloat(m.value) || 0) / total;
    const start = acc * 100;
    acc += pct;
    const end = acc * 100;
    stops.push(`${m.color} ${start.toFixed(1)}% ${end.toFixed(1)}%`);
  }
  return (
    <div className="donut" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
      <div className="donut-center">{metrics.engagementRate}</div>
    </div>
  );
}
