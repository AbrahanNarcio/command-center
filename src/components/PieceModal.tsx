"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ANGLES,
  ANGLE_COLORS,
  DAYS,
  dayFromDate,
  FORMATS,
  OBJECTIVES,
  Piece,
  PieceAngle,
  PieceFormat,
  PieceObjective,
  PieceStatus,
  STATUSES,
} from "@/lib/types";
import ModalPortal from "@/components/ModalPortal";

export type PieceDraft = Omit<Piece, "id" | "accountId">;

interface Props {
  initial?: Piece | null;
  /** Fecha YYYY-MM-DD para precargar al CREAR desde el calendario mensual. */
  presetDate?: string;
  onClose: () => void;
  onSave: (draft: PieceDraft) => void | Promise<void>;
}

const EMPTY: PieceDraft = {
  format: "Reel",
  status: "Idea",
  owner: "",
  day: "Lun",
  time: "10:00",
  objective: "DM",
  date: "",
  angle: "Problema",
  hook: "",
  problema: "",
  solucion: "",
  pruebaSocial: "",
  cta: "",
  summary: "",
  score: 70,
};

export default function PieceModal({ initial, presetDate, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<PieceDraft>(EMPTY);
  const [missing, setMissing] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      const { id: _id, accountId: _accountId, ...rest } = initial;
      void _id;
      void _accountId;
      setDraft(rest);
    } else if (presetDate) {
      setDraft({ ...EMPTY, date: presetDate, day: dayFromDate(presetDate) });
    } else {
      setDraft(EMPTY);
    }
    setMissing([]);
  }, [initial, presetDate]);

  const set = <K extends keyof PieceDraft>(key: K, value: PieceDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const invalid = (field: string) => missing.includes(field);

  const save = async () => {
    // El esqueleto mínimo de un guion: hook, problema, solución y CTA.
    const faltantes: string[] = [];
    if (!draft.hook.trim()) faltantes.push("Hook");
    if (!draft.problema.trim()) faltantes.push("Problema");
    if (!draft.solucion.trim()) faltantes.push("Solución");
    if (!draft.cta.trim()) faltantes.push("CTA");
    if (!draft.time.trim()) faltantes.push("Hora");
    setMissing(faltantes);
    if (faltantes.length) return;
    // Resumen para la tarjeta: el problema es la mejor síntesis de un vistazo.
    const summary = draft.problema.trim() || draft.solucion.trim() || draft.hook.trim();
    setSaving(true);
    try {
      await onSave({ ...draft, summary });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">{initial ? "Editar pieza" : "Nueva pieza"}</p>
        <h2>Ficha de contenido</h2>
        <p className="modal-sub">
          El guion, en orden: hook, problema, solución, prueba social y CTA. El ángulo define desde dónde
          lo cuentas.
        </p>
        <div className="form-grid">
          <label>
            Ángulo
            <div className="angle-picker" role="group" aria-label="Ángulo de la pieza">
              {ANGLES.map((a) => (
                <button
                  type="button"
                  key={a}
                  className={`angle-chip${draft.angle === a ? " active" : ""}`}
                  style={{ ["--angle" as string]: ANGLE_COLORS[a] }}
                  onClick={() => set("angle", a as PieceAngle)}
                >
                  <span className="angle-dot" />
                  {a}
                </button>
              ))}
            </div>
          </label>
          <label>
            1 · Hook *
            <textarea
              value={draft.hook}
              onChange={(e) => set("hook", e.target.value)}
              placeholder="La frase que frena el scroll..."
              style={{ minHeight: 60 }}
              className={invalid("Hook") ? "invalid" : undefined}
            />
          </label>
          <label>
            2 · Problema *
            <textarea
              value={draft.problema}
              onChange={(e) => set("problema", e.target.value)}
              placeholder="El dolor o la tensión que vive tu audiencia..."
              style={{ minHeight: 60 }}
              className={invalid("Problema") ? "invalid" : undefined}
            />
          </label>
          <label>
            3 · Solución *
            <textarea
              value={draft.solucion}
              onChange={(e) => set("solucion", e.target.value)}
              placeholder="El giro o la respuesta que propones..."
              style={{ minHeight: 60 }}
              className={invalid("Solución") ? "invalid" : undefined}
            />
          </label>
          <label>
            4 · Prueba social
            <textarea
              value={draft.pruebaSocial}
              onChange={(e) => set("pruebaSocial", e.target.value)}
              placeholder="Un caso, testimonio o dato que lo respalde (opcional)..."
              style={{ minHeight: 60 }}
            />
          </label>
          <label>
            5 · CTA *
            <input
              value={draft.cta}
              onChange={(e) => set("cta", e.target.value)}
              placeholder="Comenta SISTEMA"
              className={invalid("CTA") ? "invalid" : undefined}
            />
          </label>
          <div className="form-grid two">
            <label>
              Formato
              <select value={draft.format} onChange={(e) => set("format", e.target.value as PieceFormat)}>
                {FORMATS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select value={draft.status} onChange={(e) => set("status", e.target.value as PieceStatus)}>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Objetivo
              <select
                value={draft.objective}
                onChange={(e) => set("objective", e.target.value as PieceObjective)}
              >
                {OBJECTIVES.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Responsable
              <input value={draft.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Nombre" />
            </label>
            <label>
              Fecha
              <input
                type="date"
                value={draft.date ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  // Con fecha, el día de la semana se deriva solo (coherencia con el calendario).
                  setDraft((d) => ({ ...d, date: v, day: v ? dayFromDate(v) : d.day }));
                }}
              />
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600 }}>
                {draft.date ? `Cae en ${draft.day}. La ubica en el calendario mensual.` : "Opcional. Sin fecha, solo vive en la semana."}
              </span>
            </label>
            <label>
              Día
              <select
                value={draft.day}
                disabled={!!draft.date}
                onChange={(e) => set("day", e.target.value as (typeof DAYS)[number])}
              >
                {DAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              {draft.date && (
                <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600 }}>
                  Se toma de la fecha.
                </span>
              )}
            </label>
            <label>
              Hora *
              <input
                type="time"
                value={draft.time}
                onChange={(e) => set("time", e.target.value)}
                className={invalid("Hora") ? "invalid" : undefined}
              />
            </label>
            <label>
              Quality score: {draft.score}
              <input
                type="range"
                min={0}
                max={100}
                value={draft.score}
                onChange={(e) => set("score", Number(e.target.value))}
              />
            </label>
          </div>
        </div>
        {missing.length > 0 && (
          <div className="alert" style={{ ["--accent" as string]: "var(--coral)", marginTop: 12 }}>
            <strong>Faltan campos obligatorios</strong>
            <p>Completa: {missing.join(", ")}.</p>
          </div>
        )}
        <div className="modal-actions">
          <button className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={saving} onClick={save}>
            {saving && <Loader2 size={15} className="spin" />}{" "}
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear pieza"}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
