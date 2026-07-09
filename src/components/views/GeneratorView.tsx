"use client";

import { useMemo, useState } from "react";
import { FORMATS, OBJECTIVES, PieceFormat, PieceObjective } from "@/lib/types";
import { useStore } from "@/lib/store-context";

const HOOK_BANK: Record<PieceObjective, string[]> = {
  DM: [
    "Tu contenido no incomoda a nadie, por eso tampoco mueve a nadie.",
    "No te falta alcance, te falta un motivo para que te escriban.",
  ],
  Agenda: [
    "Si dependes de referidos no tienes negocio, tienes suerte.",
    "La diferencia entre contenido lindo y contenido que agenda.",
  ],
  Registro: [
    "7 señales de que tu automatización decora, no vende.",
    "Si tu plan para vender más es postear más, estás perdido.",
  ],
  Venta: [
    "El lead que dice 'lo pienso' ya decidió algo.",
    "No estás vendiendo caro, estás explicando barato.",
  ],
  "Tráfico a perfil": [
    "El algoritmo no te odia, la gente te ignora.",
    "Tu perfil no es una bio, es una landing page.",
  ],
};

export default function GeneratorView() {
  const { accountSources, createPiece, notify } = useStore();
  const [source, setSource] = useState("");
  const [format, setFormat] = useState<PieceFormat>("Reel");
  const [objective, setObjective] = useState<PieceObjective>("DM");
  const [edge, setEdge] = useState(4);
  const [seed, setSeed] = useState(0);

  const chosenSource = source || accountSources[0]?.name || "Banco de ángulos";
  const score = Math.min(100, 70 + edge * 5);
  const tone = edge >= 4 ? "sin anestesia" : "directo pero más didáctico";

  const script = useMemo(() => {
    const hooks = HOOK_BANK[objective];
    const hook = hooks[seed % hooks.length];
    return {
      hook,
      lines: [
        { label: "Hook", text: hook },
        { label: "Diagnóstico", text: "Estás explicando demasiado y tensionando muy poco." },
        {
          label: "Reframe",
          text: "El contenido no existe para demostrar que sabes, existe para que el lead se mire al espejo.",
        },
        { label: "Prueba", text: "Cada objeción real que atacas vuelve el DM más natural." },
        {
          label: "CTA",
          text:
            objective === "DM"
              ? "Comenta SISTEMA y te muestro dónde se pierde la conversación."
              : `Movimiento claro hacia: ${objective}.`,
        },
      ],
    };
  }, [objective, seed]);

  return (
    <div className="generator">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Mock IA</p>
            <h2>Crear pieza</h2>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Fuente (materia prima real)
            <select value={chosenSource} onChange={(e) => setSource(e.target.value)}>
              {accountSources.length ? (
                accountSources.map((s) => <option key={s.id}>{s.name}</option>)
              ) : (
                <option>Banco de ángulos</option>
              )}
            </select>
          </label>
          <label>
            Formato
            <select value={format} onChange={(e) => setFormat(e.target.value as PieceFormat)}>
              {FORMATS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Objetivo
            <select value={objective} onChange={(e) => setObjective(e.target.value as PieceObjective)}>
              {OBJECTIVES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            Nivel de filo: {edge}
            <input type="range" min={1} max={5} value={edge} onChange={(e) => setEdge(Number(e.target.value))} />
          </label>
          <button className="button primary" onClick={() => setSeed((s) => s + 1)}>
            Generar guion
          </button>
        </div>
      </section>

      <section className="panel output">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Salida</p>
            <h2>Guion listo para revisar</h2>
          </div>
          <span className="badge reel">Score {score}</span>
        </div>
        <div className="script-card">
          <h3>{script.hook}</h3>
          <p style={{ color: "var(--muted)", marginBottom: 14 }}>
            <strong>Fuente:</strong> {chosenSource} · <strong>Formato:</strong> {format} ·{" "}
            <strong>Objetivo:</strong> {objective} · <strong>Tono:</strong> {tone}.
          </p>
          <ol>
            {script.lines.map((line) => (
              <li key={line.label}>
                <strong>{line.label}:</strong> {line.text}
              </li>
            ))}
          </ol>
          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <button
              className="button primary"
              onClick={() => {
                createPiece({
                  format,
                  objective,
                  status: "Guion",
                  owner: "Generador",
                  hook: script.hook,
                  summary: script.lines[2].text,
                  cta: script.lines[4].text,
                  score,
                });
                notify("Guion enviado al pipeline");
              }}
            >
              Enviar al pipeline
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
