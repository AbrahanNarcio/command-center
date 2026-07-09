"use client";

import { useState } from "react";
import { useStore } from "@/lib/store-context";

export default function SourcesView() {
  const { accountSources, createSource, deleteSource } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");

  return (
    <>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Materia prima</p>
          <h2>Banco de fuentes</h2>
        </div>
        <button className="button primary" onClick={() => setOpen(true)}>
          + Nueva fuente
        </button>
      </div>

      <div className="source-grid">
        {accountSources.map((source) => (
          <article className="source-card" key={source.id}>
            <p className="eyebrow">{source.type}</p>
            <h3>{source.name}</h3>
            <p>{source.summary}</p>
            <div className="tags">
              {source.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="card-actions" style={{ position: "absolute", top: 14, right: 14 }}>
              <button className="warn" onClick={() => deleteSource(source.id)}>
                ✕
              </button>
            </div>
          </article>
        ))}
        {!accountSources.length && <div className="no-results">Sin fuentes cargadas para esta cuenta.</div>}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">Nueva fuente</p>
            <h2>Cargar materia prima</h2>
            <p className="modal-sub">
              Transcripciones, DMs, llamadas, comentarios, objeciones. Cuanto más real, mejor genera.
            </p>
            <div className="form-grid">
              <label>
                Nombre
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Llamadas de venta Q3" />
              </label>
              <label>
                Tipo
                <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Transcripciones" />
              </label>
              <label>
                Resumen
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} style={{ minHeight: 80 }} />
              </label>
              <label>
                Tags (separados por coma)
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="precio, objeciones, cierre" />
              </label>
            </div>
            <div className="modal-actions">
              <button className="button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button
                className="button primary"
                onClick={() => {
                  if (!name.trim()) return;
                  createSource({
                    name,
                    type: type || "Notas",
                    summary,
                    tags: tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  });
                  setName("");
                  setType("");
                  setSummary("");
                  setTags("");
                  setOpen(false);
                }}
              >
                Agregar fuente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
