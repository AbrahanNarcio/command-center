"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { ANGLE_COLORS, DAYS, FORMATS, OBJECTIVES, PieceAngle, PieceFormat, PieceObjective } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import { trackBusy } from "@/lib/busy";

type GenScript = { angle: PieceAngle; hook: string; cuerpo: string; cta: string; source: string | null };

/** Día de la semana de HOY en formato del sistema (Lun..Dom), en hora local. */
const todayDay = () => DAYS[(new Date().getDay() + 6) % 7];

/** El guion generado cuesta dinero: sobrevive al cambio de vista (la vista se
 *  desmonta al navegar). Caché por cuenta, viva mientras dure la pestaña. */
const scriptCache = new Map<string, GenScript>();

export default function GeneratorView() {
  const { activeAccount, accountSources, createPiece, notify, me } = useStore();
  const [sourceId, setSourceId] = useState("");
  const [format, setFormat] = useState<PieceFormat>("Reel");
  const [objective, setObjective] = useState<PieceObjective>("DM");
  const [edge, setEdge] = useState(4);
  const [script, setScript] = useState<GenScript | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Al cambiar de cuenta: la fuente elegida se descarta (antes quedaba una
  // fuente ajena "pegada") y se restaura el último guion generado DE ESA cuenta.
  useEffect(() => {
    setSourceId("");
    setScript(activeAccount ? scriptCache.get(activeAccount.id) ?? null : null);
    setError(null);
  }, [activeAccount?.id, activeAccount]);

  const generate = async () => {
    if (!activeAccount) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await trackBusy(
        fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: activeAccount.id,
            sourceId: sourceId || undefined,
            format,
            objective,
            edge,
            handle: activeAccount.handle,
          }),
        }),
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "No se pudo generar el guion.");
        return;
      }
      setScript(data as GenScript);
      scriptCache.set(activeAccount.id, data as GenScript);
    } catch {
      setError("Sin conexión con el servidor. Inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  };

  const tone = edge >= 4 ? "sin anestesia" : "directo pero más didáctico";

  return (
    <div className="generator">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Generador</p>
            <h2>Crear pieza</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
              Elige la fuente, el formato y el objetivo. La IA escribe un borrador de guion (hook,
              cuerpo y CTA) a partir de tu materia prima real, para editar y enviar al pipeline.
            </p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Fuente (materia prima real)
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Sin fuente · solo formato y objetivo</option>
              {accountSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
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
          <button className="button ai" disabled={generating || !activeAccount} onClick={generate}>
            {generating ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}{" "}
            {generating ? "Generando…" : script ? "Generar otro" : "Generar guion"}
          </button>
        </div>
        {error && (
          <div className="alert" style={{ ["--accent" as string]: "var(--coral)", marginTop: 12 }}>
            <p>{error}</p>
          </div>
        )}
      </section>

      <section className="panel output">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Salida</p>
            <h2>Guion listo para revisar</h2>
          </div>
          {script && (
            <span className="badge angle" style={{ ["--angle" as string]: ANGLE_COLORS[script.angle] }}>
              {script.angle}
            </span>
          )}
        </div>
        {!script ? (
          <div className="no-results">
            {generating
              ? "La IA está escribiendo el guion…"
              : "Todavía no hay guion. Configura los campos y toca Generar guion."}
          </div>
        ) : (
          <div className="script-card">
            <h3>{script.hook}</h3>
            <p style={{ color: "var(--muted)", marginBottom: 14 }}>
              <strong>Generado con IA</strong> · <strong>Fuente:</strong>{" "}
              {script.source ?? "Sin fuente"} · <strong>Formato:</strong> {format} ·{" "}
              <strong>Objetivo:</strong> {objective} · <strong>Tono:</strong> {tone}.
            </p>
            <div className="script-body">
              {script.cuerpo.split("\n").filter(Boolean).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              <p>
                <strong>CTA:</strong> {script.cta}
              </p>
            </div>
            <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
              <button
                className="button primary"
                disabled={sending}
                onClick={async () => {
                  setSending(true);
                  try {
                    await createPiece({
                      format,
                      objective,
                      status: "Guion",
                      owner: me?.email ?? "",
                      day: todayDay(),
                      angle: script.angle,
                      hook: script.hook,
                      cuerpo: script.cuerpo,
                      cta: script.cta,
                      summary: script.cuerpo.split("\n")[0] ?? script.hook,
                      score: 70,
                    });
                    notify("Guion enviado al pipeline");
                  } catch {
                    // El toast de error global ya avisó.
                  } finally {
                    setSending(false);
                  }
                }}
              >
                {sending && <Loader2 size={15} className="spin" />}{" "}
                {sending ? "Enviando…" : "Enviar al pipeline"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
