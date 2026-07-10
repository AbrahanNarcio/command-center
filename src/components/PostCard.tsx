"use client";

import { Pencil, Trash2 } from "lucide-react";
import { ANGLE_COLORS, Piece } from "@/lib/types";
import { PALETTE, formatSlug, scoreColor } from "@/lib/utils";

interface Props {
  piece: Piece;
  index?: number;
  compact?: boolean;
  onEdit?: (piece: Piece) => void;
  onDelete?: (piece: Piece) => void;
  draggable?: boolean;
  onDragStart?: (piece: Piece) => void;
}

export default function PostCard({
  piece,
  index = 0,
  compact = false,
  onEdit,
  onDelete,
  draggable = false,
  onDragStart,
}: Props) {
  const [a, b] = PALETTE[index % PALETTE.length];
  return (
    <article
      className="post-card"
      draggable={draggable}
      onDragStart={draggable ? () => onDragStart?.(piece) : undefined}
    >
      {!compact && <div className="thumb" style={{ ["--a" as string]: a, ["--b" as string]: b }} />}
      <div className="card-body">
        <div className="card-top">
          <span className={`badge ${formatSlug(piece.format)}`}>{piece.format}</span>
          {piece.angle && (
            <span className="badge angle" style={{ ["--angle" as string]: ANGLE_COLORS[piece.angle] }}>
              {piece.angle}
            </span>
          )}
          <span className="badge status">{piece.status}</span>
        </div>
        <h3>{piece.hook}</h3>
        <p>{piece.summary}</p>
        <div className="meta">
          <span>{piece.owner}</span>
          <span>
            {piece.day} {piece.time}
          </span>
          <span>{piece.objective}</span>
          <span>{piece.cta}</span>
        </div>
        <div className="score-line">
          <div className="meter">
            <span
              style={{ ["--score" as string]: `${piece.score}%`, ["--meter" as string]: scoreColor(piece.score) }}
            />
          </div>
          <div className="score">{piece.score}</div>
        </div>
        {(onEdit || onDelete) && (
          <div className="card-actions">
            {onEdit && (
              <button onClick={() => onEdit(piece)}>
                <Pencil size={11} /> Editar
              </button>
            )}
            {onDelete && (
              <button className="warn" onClick={() => onDelete(piece)}>
                <Trash2 size={11} /> Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
