"use client";

import { useEffect, useState } from "react";
import {
  DAYS,
  FORMATS,
  OBJECTIVES,
  Piece,
  PieceFormat,
  PieceObjective,
  PieceStatus,
  STATUSES,
} from "@/lib/types";
import ModalPortal from "@/components/ModalPortal";

export type PieceDraft = Omit<Piece, "id" | "accountId">;

interface Props {
  initial?: Piece | null;
  onClose: () => void;
  onSave: (draft: PieceDraft) => void;
}

const EMPTY: PieceDraft = {
  format: "Reel",
  status: "Idea",
  owner: "",
  day: "Lun",
  time: "10:00",
  objective: "DM",
  hook: "",
  summary: "",
  cta: "",
  score: 70,
};

export default function PieceModal({ initial, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<PieceDraft>(EMPTY);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    if (initial) {
      const { id: _id, accountId: _accountId, ...rest } = initial;
      void _id;
      void _accountId;
      setDraft(rest);
    } else {
      setDraft(EMPTY);
    }
    setMissing([]);
  }, [initial]);

  const set = <K extends keyof PieceDraft>(key: K, value: PieceDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const invalid = (field: string) => missing.includes(field);

  const save = () => {
    // Hook, tensión (resumen) y acción (CTA): sin las tres no hay pieza.
    const faltantes: string[] = [];
    if (!draft.hook.trim()) faltantes.push("Hook");
    if (!draft.summary.trim()) faltantes.push("Resumen");
    if (!draft.cta.trim()) faltantes.push("CTA");
    if (!draft.time.trim()) faltantes.push("Hora");
    setMissing(faltantes);
    if (faltantes.length) return;
    onSave(draft);
  };

  return (
    <ModalPortal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">{initial ? "Editar pieza" : "Nueva pieza"}</p>
        <h2>Ficha de contenido</h2>
        <p className="modal-sub">
          Hook, tensión y acción esperada. Una pieza no debería aprobarse sin las tres.
        </p>
        <div className="form-grid">
          <label>
            Hook *
            <textarea
              value={draft.hook}
              onChange={(e) => set("hook", e.target.value)}
              placeholder="La frase que frena el scroll..."
              style={{ minHeight: 70 }}
              className={invalid("Hook") ? "invalid" : undefined}
            />
          </label>
          <label>
            Resumen / ángulo *
            <textarea
              value={draft.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="Qué desarrolla la pieza y por qué mueve al negocio..."
              style={{ minHeight: 70 }}
              className={invalid("Resumen") ? "invalid" : undefined}
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
              Día
              <select value={draft.day} onChange={(e) => set("day", e.target.value as (typeof DAYS)[number])}>
                {DAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
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
              CTA *
              <input
                value={draft.cta}
                onChange={(e) => set("cta", e.target.value)}
                placeholder="Comenta SISTEMA"
                className={invalid("CTA") ? "invalid" : undefined}
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
          <button className="button primary" onClick={save}>
            {initial ? "Guardar cambios" : "Crear pieza"}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
