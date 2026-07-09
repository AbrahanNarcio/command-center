"use client";

import { useState } from "react";
import { AccountMetrics, Kpi } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import ModalPortal from "@/components/ModalPortal";

interface Props {
  metrics: AccountMetrics;
  onClose: () => void;
}

type Unit = "count" | "pct" | "x";

/** Solo dígitos, separador decimal y signo. Las letras no entran. */
const sanitize = (v: string) => v.replace(/[^0-9.,+-]/g, "");

/** "255.0K" → "255000", "3.1%" → "3.1", "1.3x" → "1.3", "—" → "". */
function toRaw(value: string): string {
  const t = value.trim();
  if (!t || t === "—" || t === "-") return "";
  const m = t.match(/^([+-]?\d+(?:[.,]\d+)?)\s*(K|M|%|x)?$/i);
  if (!m) return "";
  const n = parseFloat(m[1].replace(",", "."));
  if (Number.isNaN(n)) return "";
  const suffix = (m[2] ?? "").toUpperCase();
  if (suffix === "K") return String(n * 1_000);
  if (suffix === "M") return String(n * 1_000_000);
  return String(n);
}

/** Número crudo → valor formateado según la unidad de la métrica. */
function format(raw: string, unit: Unit, signed = false): string {
  const t = raw.trim().replace(",", ".");
  if (!t || t === "+" || t === "-") return signed ? "" : "—";
  const n = parseFloat(t);
  if (Number.isNaN(n)) return signed ? "" : "—";
  const sign = signed && n > 0 ? "+" : "";
  if (unit === "pct") return `${sign}${parseFloat(n.toFixed(2))}%`;
  if (unit === "x") return `${sign}${parseFloat(n.toFixed(2))}x`;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(n / 1_000).toFixed(1)}K`;
  return `${sign}${parseFloat(n.toFixed(2))}`;
}

/** ¿El valor ya está formateado (tiene sufijo o es —)? Entonces no re-formatear al guardar. */
const isFormatted = (v: string) => /[KM%x—]/i.test(v.trim()) || v.trim() === "";

/** Unidad de cada KPI, deducida de su valor actual o de su etiqueta. */
function unitOf(kpi: Kpi): Unit {
  if (/%\s*$/.test(kpi.value)) return "pct";
  if (/x\s*$/i.test(kpi.value)) return "x";
  if (/ctr|interacci|retenci/i.test(kpi.label)) return "pct";
  if (/frecuencia/i.test(kpi.label)) return "x";
  return "count";
}

export default function MetricsEditor({ metrics, onClose }: Props) {
  const { saveMetrics, activeConnection } = useStore();
  const [kpis, setKpis] = useState<Kpi[]>(metrics.kpis.map((k) => ({ ...k })));
  const [growthNet, setGrowthNet] = useState(metrics.growthNet);
  const [ctrBio, setCtrBio] = useState(metrics.ctrBio);
  const [reachTotal, setReachTotal] = useState(metrics.reachTotal);
  const [saving, setSaving] = useState(false);

  const setKpi = (idx: number, key: keyof Kpi, value: string) =>
    setKpis((prev) => prev.map((k, i) => (i === idx ? { ...k, [key]: value } : k)));

  /** Al entrar: número crudo editable. Mientras escribes: solo números. Al salir: formato automático. */
  const numericField = (
    value: string,
    onChange: (v: string) => void,
    unit: Unit,
    opts: { signed?: boolean; placeholder?: string } = {},
  ) => (
    <input
      value={value}
      inputMode="decimal"
      placeholder={opts.placeholder}
      onFocus={(e) => onChange(toRaw(e.target.value))}
      onChange={(e) => onChange(sanitize(e.target.value))}
      onBlur={(e) => onChange(format(e.target.value, unit, opts.signed))}
    />
  );

  return (
    <ModalPortal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(760px, 100%)" }}>
        <p className="eyebrow">Editar métricas de la cuenta</p>
        <h2>Carga manual de KPIs</h2>
        <p className="modal-sub">
          {activeConnection
            ? "Esta cuenta está conectada a Instagram: la próxima sincronización automática va a sobrescribir los KPIs que cargues a mano. Úsalo solo para retoques puntuales."
            : "Esta cuenta no está conectada a Instagram, así que los números se cargan a mano. Cada cuenta guarda los suyos."}{" "}
          Escribe solo el número (letras bloqueadas): el formato K/M/%/x se aplica solo al salir del campo. La descripción de cada métrica la fija el sistema e indica qué mide y de qué periodo.
        </p>

        <div className="form-grid two" style={{ marginBottom: 14 }}>
          <label>
            Net followers
            {numericField(growthNet, setGrowthNet, "count", { signed: true, placeholder: "120" })}
          </label>
          <label>
            CTR bio
            {numericField(ctrBio, setCtrBio, "pct", { placeholder: "3.1" })}
          </label>
          <label>
            Reach total
            {numericField(reachTotal, setReachTotal, "count", { placeholder: "204100" })}
          </label>
        </div>

        <p className="eyebrow">KPIs</p>
        <div className="kpi-editor">
          {kpis.map((kpi, idx) => (
            <div className="kpi-editor-row" key={idx}>
              <input
                value={kpi.label}
                onChange={(e) => setKpi(idx, "label", e.target.value)}
                placeholder="Métrica"
              />
              {numericField(kpi.value, (v) => setKpi(idx, "value", v), unitOf(kpi), { placeholder: "12500" })}
              {numericField(kpi.delta, (v) => setKpi(idx, "delta", v), unitOf(kpi), { signed: true, placeholder: "Δ" })}
              <span className="kpi-detail-fixed" title="Qué mide y de qué periodo. Lo fija la sincronización.">
                {kpi.detail}
              </span>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={saving}
            onClick={async () => {
              // Si un campo quedó a medio editar (sin blur), formatearlo antes de guardar.
              const clean = kpis.map((k) => ({
                ...k,
                value: isFormatted(k.value) && k.value.trim() !== "" ? k.value : format(k.value, unitOf(k)),
                delta: k.delta.trim() === "" || isFormatted(k.delta) ? k.delta : format(k.delta, unitOf(k), true),
              }));
              setSaving(true);
              try {
                await saveMetrics(metrics.accountId, {
                  kpis: clean,
                  growthNet: isFormatted(growthNet) ? growthNet : format(growthNet, "count", true),
                  ctrBio: isFormatted(ctrBio) ? ctrBio : format(ctrBio, "pct"),
                  reachTotal: isFormatted(reachTotal) ? reachTotal : format(reachTotal, "count"),
                });
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Guardando..." : "Guardar métricas"}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
