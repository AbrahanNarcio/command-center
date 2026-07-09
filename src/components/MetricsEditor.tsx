"use client";

import { useState } from "react";
import { AccountMetrics, Kpi } from "@/lib/types";
import { useStore } from "@/lib/store-context";

interface Props {
  metrics: AccountMetrics;
  onClose: () => void;
}

export default function MetricsEditor({ metrics, onClose }: Props) {
  const { saveMetrics } = useStore();
  const [kpis, setKpis] = useState<Kpi[]>(metrics.kpis.map((k) => ({ ...k })));
  const [growthNet, setGrowthNet] = useState(metrics.growthNet);
  const [ctrBio, setCtrBio] = useState(metrics.ctrBio);
  const [reachTotal, setReachTotal] = useState(metrics.reachTotal);
  const [saving, setSaving] = useState(false);

  const setKpi = (idx: number, key: keyof Kpi, value: string) =>
    setKpis((prev) => prev.map((k, i) => (i === idx ? { ...k, [key]: value } : k)));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(760px, 100%)" }}>
        <p className="eyebrow">Editar métricas de la cuenta</p>
        <h2>Carga manual de KPIs</h2>
        <p className="modal-sub">
          Mientras no conectas la API de Meta, cargas los números a mano. Cada cuenta guarda los suyos.
        </p>

        <div className="form-grid two" style={{ marginBottom: 14 }}>
          <label>
            Net followers
            <input value={growthNet} onChange={(e) => setGrowthNet(e.target.value)} />
          </label>
          <label>
            CTR bio
            <input value={ctrBio} onChange={(e) => setCtrBio(e.target.value)} />
          </label>
          <label>
            Reach total
            <input value={reachTotal} onChange={(e) => setReachTotal(e.target.value)} />
          </label>
        </div>

        <p className="eyebrow">KPIs</p>
        <div className="kpi-editor">
          {kpis.map((kpi, idx) => (
            <div className="kpi-editor-row" key={idx}>
              <input value={kpi.label} onChange={(e) => setKpi(idx, "label", e.target.value)} placeholder="Label" />
              <input value={kpi.value} onChange={(e) => setKpi(idx, "value", e.target.value)} placeholder="Valor" />
              <input value={kpi.delta} onChange={(e) => setKpi(idx, "delta", e.target.value)} placeholder="Δ" />
              <input value={kpi.detail} onChange={(e) => setKpi(idx, "detail", e.target.value)} placeholder="Detalle" />
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
  );
}
