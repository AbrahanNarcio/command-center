"use client";

import { useRef, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Source } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import ModalPortal from "@/components/ModalPortal";

// Formatos de texto plano aceptados (livianos, no ocupan casi almacenamiento).
const TEXT_EXT = [".txt", ".md", ".csv", ".srt", ".vtt", ".text"];
const MAX_TEXT = 500_000; // ~500 KB de texto por fuente

export default function SourcesView() {
  const { accountSources, createSource, updateSource, deleteSource, notify } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Source | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!TEXT_EXT.some((ext) => lower.endsWith(ext)) && !file.type.startsWith("text/")) {
      setFileError("Solo archivos de texto (.txt, .md, .csv, .srt, .vtt). Word/Excel: expórtalos a texto o pega el contenido.");
      return;
    }
    if (file.size > MAX_TEXT) {
      setFileError("El archivo es muy grande. Máximo ~500 KB de texto por fuente.");
      return;
    }
    const text = await file.text();
    // Nunca se guarda el archivo, solo su texto: cero costo de almacenamiento.
    setSummary((prev) => (prev.trim() ? `${prev}\n\n${text}` : text));
    if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ""));
    if (!type.trim()) setType("Documento");
    notify(`Texto importado de ${file.name}`);
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setType("");
    setSummary("");
    setTags("");
    setInvalid(false);
    setFileError(null);
    setFileName("");
    setOpen(true);
  };

  const openEdit = (source: Source) => {
    setEditing(source);
    setName(source.name);
    setType(source.type);
    setSummary(source.summary);
    setTags(source.tags.join(", "));
    setFileError(null);
    setFileName("");
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const payload = {
      name,
      type: type || "Notas",
      summary,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    setSaving(true);
    try {
      if (editing) await updateSource(editing.id, payload);
      else await createSource(payload);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Materia prima</p>
          <h2>Banco de fuentes</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
            Guarda aquí el material del que salen tus piezas: transcripciones, DMs, llamadas, comentarios
            y objeciones reales. Usa Nueva fuente para agregar más.
          </p>
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
        <ModalPortal>
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">{editing ? "Editar fuente" : "Nueva fuente"}</p>
            <h2>{editing ? editing.name : "Cargar materia prima"}</h2>
            <p className="modal-sub">
              Sube un archivo de texto o pega el contenido real de tu fuente (una transcripción, un DM,
              comentarios…). Entre más real sea, mejores piezas genera.
            </p>
            <div className="form-grid">
              <label>
                Nombre *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Llamadas de venta Q3"
                  className={invalid ? "invalid" : undefined}
                />
              </label>
              <label>
                Tipo
                <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Transcripciones" />
              </label>
              <div className="field">
                <span>Importar archivo de texto</span>
                <div className="file-picker">
                  <button type="button" className="button small" onClick={() => fileRef.current?.click()}>
                    <Upload size={14} /> Elegir archivo
                  </button>
                  <span className="file-name">{fileName || "Ningún archivo seleccionado"}</span>
                  <input
                    ref={fileRef}
                    type="file"
                    className="sr-only"
                    accept=".txt,.md,.csv,.srt,.vtt,.text,text/plain"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      importFile(f);
                      if (f) setFileName(f.name);
                      e.target.value = "";
                    }}
                  />
                </div>
                <span className="field-hint">
                  .txt, .md, .csv, .srt, .vtt. Se guarda solo el texto, no el archivo.
                </span>
              </div>
              {fileError && (
                <div className="alert" style={{ ["--accent" as string]: "var(--coral)" }}>
                  <p>{fileError}</p>
                </div>
              )}
              <label>
                Contenido
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  style={{ minHeight: 120 }}
                  placeholder="Pega aquí la transcripción, los DMs o los comentarios…"
                />
              </label>
              <label>
                Tags (separados por coma)
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="precio, objeciones, cierre" />
              </label>
            </div>
            {invalid && (
              <div className="alert" style={{ ["--accent" as string]: "var(--coral)", marginTop: 12 }}>
                <p>El nombre de la fuente es obligatorio.</p>
              </div>
            )}
            <div className="modal-actions">
              <button className="button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="button primary" disabled={saving} onClick={save}>
                {saving && <Loader2 size={15} className="spin" />}{" "}
                {saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar fuente"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
