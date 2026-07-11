"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Piece, PieceStatus, STATUSES } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import PostCard from "@/components/PostCard";
import PieceModal, { PieceDraft } from "@/components/PieceModal";

export default function PipelineView({ pieces }: { pieces: Piece[] }) {
  const { accountPieces, updatePiece, deletePiece, createPiece, canEdit } = useStore();
  const [owner, setOwner] = useState("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropLane, setDropLane] = useState<PieceStatus | null>(null);
  const [editing, setEditing] = useState<Piece | null>(null);
  const [creating, setCreating] = useState(false);

  const owners = ["all", ...Array.from(new Set(accountPieces.map((p) => p.owner)))];
  const visible = owner === "all" ? pieces : pieces.filter((p) => p.owner === owner);

  const onDrop = (status: PieceStatus) => {
    if (dragId) {
      const piece = pieces.find((p) => p.id === dragId);
      if (piece && piece.status !== status) updatePiece(dragId, { status });
    }
    setDragId(null);
    setDropLane(null);
  };

  const saveEdit = async (draft: PieceDraft) => {
    if (editing) await updatePiece(editing.id, draft);
    setEditing(null);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Workflow editorial</p>
          <h2>Pipeline de producción</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
            El avance de cada pieza, de idea a publicada. Filtra por responsable o estado, y toca una
            pieza para editarla.
          </p>
        </div>
        <div className="toolbar">
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o === "all" ? "Todos" : o}
              </option>
            ))}
          </select>
          {canEdit && (
            <button className="button primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> Nueva pieza
            </button>
          )}
        </div>
      </div>

      <div className="board">
        {STATUSES.map((status) => {
          const laneItems = visible.filter((p) => p.status === status);
          return (
            <section
              className={`lane${dropLane === status ? " drop" : ""}`}
              key={status}
              onDragOver={canEdit ? (e) => {
                e.preventDefault();
                setDropLane(status);
              } : undefined}
              onDragLeave={canEdit ? () => setDropLane((l) => (l === status ? null : l)) : undefined}
              onDrop={canEdit ? () => onDrop(status) : undefined}
            >
              <div className="lane-head">
                <span>{status}</span>
                <b>{laneItems.length}</b>
              </div>
              {laneItems.length ? (
                laneItems.map((piece, i) => (
                  <PostCard
                    key={piece.id}
                    piece={piece}
                    index={i}
                    compact
                    draggable={canEdit}
                    onDragStart={canEdit ? () => setDragId(piece.id) : undefined}
                    onEdit={canEdit ? setEditing : undefined}
                    onDelete={canEdit ? (p) => deletePiece(p.id) : undefined}
                    onMove={
                      canEdit
                        ? (p, dir) => {
                            const next = STATUSES[STATUSES.indexOf(p.status) + dir];
                            if (next) updatePiece(p.id, { status: next });
                          }
                        : undefined
                    }
                  />
                ))
              ) : (
                <div className="no-results">Vacío</div>
              )}
            </section>
          );
        })}
      </div>

      {(editing || creating) && (
        <PieceModal
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={async (draft) => {
            if (creating) {
              await createPiece(draft);
              setCreating(false);
            } else {
              await saveEdit(draft);
            }
          }}
        />
      )}
    </div>
  );
}
