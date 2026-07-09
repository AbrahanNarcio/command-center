"use client";

import { useState } from "react";
import { AccountMetrics, Kpi } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import ModalPortal from "@/components/ModalPortal";

interface Props {
  metrics: AccountMetrics;
  onClose: () => void;
}

/** Valores tipo métrica: 12, 12.5, 12.5K, 3.1%, 1.3x, +120, -0.4, o — (sin dato). */
const VALUE_RE = /^[+-]?\d+([.,]\d+)?\s*(K|M|%|x)?$|^—$|^-$/i;

const isValidValue = (v: string, allowEmpty = false) => {
  const t = v.trim();
  if (!t) return allowEmpty;
  return VALUE_RE.test(t);
};

export default function MetricsEditor({ metrics, onClose }: Props) {
  const { saveMetrics, activeConnection } = useStore();
  const [kpis, setKpis] = useState<Kpi[]>(metrics.kpis.map((k) => ({ ...k })));
  const [growthNet, setGrowthNet] = useState(metrics.growthNet);
  const [ctrBio, setCtrBio] = useState(metrics.ctrBio);
  const [reachTotal, setReachTotal] = useState(metrics.reachTotal);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const validate = (): string[] => {
    const bad: string[] = [];
    if (!isValidValue(growthNet)) bad.push("Net followers");
    if (!isValidValue(ctrBio)) bad.push("CTR bio");
    if (!isValidValue(reachTotal)) bad.push("Reach total");
    kpis.forEach((k, i) => {
      if (!isValidValue(k.value)) bad.push(`Valor de "${k.label || `KPI ${i + 1}`}"`);
      if (!isValidValue(k.delta, true)) bad.push(`Δ de "${k.label || `KPI ${i + 1}`}"`);
    });
    return bad;
  };

  const setKpi = (idx: number, key: keyof Kpi, value: string) =>
    setKpis((prev) => prev.map((k, i) => (i === idx ? { ...k, [key]: value } : k)));

  return (
    <ModalPortal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(760px, 100%)" }}>
        <p className="eyebrow">Editar métricas de la cuenta</p>
        <h2>Carga manual de KPIs</h2>
        <p className="modal-sub">
          {activeConnection
            ? "Esta cuenta está conectada a Instagram: la próxima sincronización automática va a sobrescribir los KPIs que cargues a mano. Úsalo solo para retoques puntuales."
            : "Esta cuenta no está conectada a Instagram, así que los números se cargan a mano. Cada cuenta guarda los suyos."}
        </p>

        <div className="form-grid two" style={{ marginBottom: 14 }}>
          <label>
            Net followers
            <input
              value={growthNet}
              onChange={(e) => setGrowthNet(e.target.value)}
              placeholder="+120"
              className={isValidValue(growthNet) ? undefined : "invalid"}
            />
          </label>
          <label>
            CTR bio
            <input
              value={ctrBio}
              onChange={(e) => setCtrBio(e.target.value)}
              placeholder="3.1%"
              className={isValidValue(ctrBio) ? undefined : "invalid"}
            />
          </label>
          <label>
            Reach total
            <input
              value={reachTotal}
              onChange={(e) => setReachTotal(e.target.value)}
              placeholder="204.1K"
              className={isValidValue(reachTotal) ? undefined : "invalid"}
            />
          </label>
        </div>

        <p className="eyebrow">KPIs</p>
        <div className="kpi-editor">
          {kpis.map((kpi, idx) => (
            <div className="kpi-editor-row" key={idx}>
              <input value={kpi.label} onChange={(e) => setKpi(idx, "label", e.target.value)} placeholder="Label" />
              <input
                value={kpi.value}
                onChange={(e) => setKpi(idx, "value", e.target.value)}
                placeholder="12.5K"
                className={isValidValue(kpi.value) ? undefined : "invalid"}
              />
              <input
                value={kpi.delta}
                onChange={(e) => setKpi(idx, "delta", e.target.value)}
                placeholder="+8%"
                className={isValidValue(kpi.delta, true) ? undefined : "invalid"}
              />
              <input value={kpi.detail} onChange={(e) => setKpi(idx, "detail", e.target.value)} placeholder="Detalle" />
            </div>
          ))}
        </div>

        {errors.length > 0 && (
          <div className="alert" style={{ ["--accent" as string]: "var(--coral)", marginTop: 12 }}>
            <strong>Formato inválido</strong>
            <p>
              Usa números con sufijo opcional K, M, % o x (ej. 12.5K, 3.1%, +120, 1.3x), o — si no hay dato.
              Corrige: {errors.slice(0, 4).join(" · ")}{errors.length > 4 ? ` y ${errors.length - 4} más` : ""}.
            </p>
          </div>
        )}
        <div className="modal-actions">
          <button className="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={saving}
            onClick={async () => {
              const bad = validate();
              setErrors(bad);
              if (bad.length) return;
              setSaving(true);
              try {
                await saveMetrics(metrics.accountId, { kpis, growthNet, ctrBio, reachTotal });
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
