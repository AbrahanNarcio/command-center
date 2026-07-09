"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Source } from "@/lib/types";
import { useStore } from "@/lib/store-context";

export default function SourcesView() {
  const { accountSources, createSource, updateSource, deleteSource } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Source | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");

  const openCreate = () => {
    setEditing(null);
    setName("");
    setType("");
    setSummary("");
    setTags("");
    setOpen(true);
  };

  const openEdit = (source: Source) => {
    setEditing(source);
    setName(source.name);
    setType(source.type);
    setSummary(source.summary);
    setTags(source.tags.join(", "));
    setOpen(true);
  };

  const save = () => {
    if (!name.trim()) return;
    const payload = {
      name,
      type: type || "Notas",
      summary,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    if (editing) updateSource(editing.id, payload);
    else createSource(payload);
    setOpen(false);
  };

  return (
    <>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Materia prima</p>
          <h2>Banco de fuentes</h2>
        </div>
        <button className="button primary" onClick={openCreate}>
          <Plus size={15} /> Nueva fuente
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
              <button title="Editar" onClick={() => openEdit(source)}>
                <Pencil size={12} />
              </button>
              <button className="warn" title="Eliminar" onClick={() => deleteSource(source.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          </article>
        ))}
        {!accountSources.length && <div className="no-results">Sin fuentes cargadas para esta cuenta.</div>}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">{editing ? "Editar fuente" : "Nueva fuente"}</p>
            <h2>{editing ? editing.name : "Cargar materia prima"}</h2>
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
              <button className="button primary" onClick={save}>
                {editing ? "Guardar cambios" : "Agregar fuente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
