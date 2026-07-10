"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DAYS, Piece } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import PieceModal, { PieceDraft } from "@/components/PieceModal";

export default function CalendarView({ pieces }: { pieces: Piece[] }) {
  const { updatePiece, createPiece, canEdit } = useStore();
  const [editing, setEditing] = useState<Piece | null>(null);
  const [creatingDay, setCreatingDay] = useState<(typeof DAYS)[number] | null>(null);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Semana editorial</p>
          <h2>Calendario</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
            Tus publicaciones ordenadas por día y hora. Toca una para editarla, o usa Agregar para
            programar una nueva en ese día.
          </p>
        </div>
      </div>
      <div className="calendar">
        {DAYS.map((day) => {
          const dayItems = pieces.filter((p) => p.day === day).sort((a, b) => a.time.localeCompare(b.time));
          return (
            <section className="day" key={day}>
              <strong>{day}</strong>
              {dayItems.map((item) => (
                <div
                  className="calendar-item"
                  key={item.id}
                  onClick={canEdit ? () => setEditing(item) : undefined}
                  style={canEdit ? undefined : { cursor: "default" }}
                >
                  <span>
                    {item.time} · {item.format}
                  </span>
                  <p>{item.hook}</p>
                </div>
              ))}
              {canEdit && (
                <button className="add-account" style={{ width: "100%" }} onClick={() => setCreatingDay(day)}>
                  <Plus size={14} /> Agregar
                </button>
              )}
            </section>
          );
        })}
      </div>

      {(editing || creatingDay) && (
        <PieceModal
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreatingDay(null);
          }}
          onSave={(draft: PieceDraft) => {
            if (editing) updatePiece(editing.id, draft);
            else createPiece({ ...draft, day: creatingDay ?? draft.day });
            setEditing(null);
            setCreatingDay(null);
          }}
        />
      )}
    </div>
  );
}
