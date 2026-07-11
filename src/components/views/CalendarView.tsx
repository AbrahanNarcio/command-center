"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, Plus } from "lucide-react";
import { ANGLE_COLORS, DAYS, Piece } from "@/lib/types";
import { piecesForDate, sameWeek, weekDays } from "@/lib/plan";
import { useStore } from "@/lib/store-context";
import PieceModal, { PieceDraft } from "@/components/PieceModal";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** YYYY-MM-DD local (sin corrimiento de zona). */
function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function CalendarView({ pieces }: { pieces: Piece[] }) {
  const { updatePiece, createPiece, canEdit } = useStore();
  const [mode, setMode] = useState<"semana" | "mes">("mes");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [editing, setEditing] = useState<Piece | null>(null);
  const [creatingDate, setCreatingDate] = useState<string | null>(null);
  const [weekRef, setWeekRef] = useState(() => new Date());

  const todayIso = iso(new Date());

  // Semana visible (Lun-Dom). Las piezas sin fecha solo aparecen en la semana en curso.
  const week = weekDays(weekRef);
  const currentWeek = sameWeek(weekRef, new Date());
  const shiftWeek = (delta: number) =>
    setWeekRef((c) => new Date(c.getFullYear(), c.getMonth(), c.getDate() + delta * 7));
  const weekLabel = `Semana del ${week[0].getDate()} de ${MONTHS[week[0].getMonth()]} al ${week[6].getDate()} de ${MONTHS[week[6].getMonth()]}`;

  // Semanas del mes en curso (matriz de fechas, semana de Lun a Dom).
  const weeks = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // getDay 0=Dom..6=Sab → offset con Lunes primero.
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor]);

  // Piezas del mes agrupadas por fecha, y las que no tienen fecha.
  const byDate = useMemo(() => {
    const map = new Map<string, Piece[]>();
    for (const p of pieces) {
      if (!p.date) continue;
      (map.get(p.date) ?? map.set(p.date, []).get(p.date)!).push(p);
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [pieces]);

  const undated = useMemo(() => pieces.filter((p) => !p.date), [pieces]);

  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const closeModal = () => {
    setEditing(null);
    setCreatingDate(null);
  };

  const modalOpen = editing || creatingDate;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Semana editorial</p>
          <h2>Calendario</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
            Tus publicaciones ordenadas por fecha y hora. Cambia entre la vista de mes, para ver qué días
            ya tienen contenido, y la de semana. Toca una pieza para editarla o un día para agregar una.
          </p>
        </div>
        <div className="cal-mode" role="group" aria-label="Vista del calendario">
          <button
            className={`chip${mode === "mes" ? " active" : ""}`}
            onClick={() => setMode("mes")}
          >
            <CalendarDays size={14} /> Mes
          </button>
          <button
            className={`chip${mode === "semana" ? " active" : ""}`}
            onClick={() => setMode("semana")}
          >
            <LayoutGrid size={14} /> Semana
          </button>
        </div>
      </div>

      {mode === "mes" ? (
        <>
          <div className="cal-monthbar">
            <button className="icon-button" title="Mes anterior" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={16} />
            </button>
            <strong className="cal-monthlabel">{monthLabel}</strong>
            <button className="icon-button" title="Mes siguiente" onClick={() => shiftMonth(1)}>
              <ChevronRight size={16} />
            </button>
            <button className="button small" onClick={goToday} style={{ marginLeft: 6 }}>
              Hoy
            </button>
          </div>

          <div className="month-grid">
            {DAYS.map((d) => (
              <div className="month-dow" key={d}>
                {d}
              </div>
            ))}
            {weeks.flat().map((date, i) => {
              if (!date) return <div className="month-cell empty" key={`e${i}`} />;
              const key = iso(date);
              const items = byDate.get(key) ?? [];
              const isToday = key === todayIso;
              return (
                <div
                  className={`month-cell${isToday ? " today" : ""}${items.length ? " has" : ""}`}
                  key={key}
                >
                  <div className="month-cell-head">
                    <span className="month-daynum">{date.getDate()}</span>
                    {canEdit && (
                      <button
                        className="month-add"
                        title="Agregar pieza este día"
                        onClick={() => setCreatingDate(key)}
                      >
                        <Plus size={13} />
                      </button>
                    )}
                  </div>
                  <div className="month-items">
                    {items.map((p) => (
                      <button
                        className="month-chip"
                        key={p.id}
                        style={{ ["--angle" as string]: ANGLE_COLORS[p.angle] }}
                        onClick={canEdit ? () => setEditing(p) : undefined}
                        title={`${p.time} · ${p.hook}`}
                      >
                        <span className="month-chip-time">{p.time}</span>
                        <span className="month-chip-hook">{p.hook || p.summary || "Sin título"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {undated.length > 0 && (
            <div className="cal-undated">
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                Sin fecha ({undated.length}) · asígnales una para verlas en el mes
              </p>
              <div className="cal-undated-list">
                {undated.map((p) => (
                  <button
                    className="month-chip"
                    key={p.id}
                    style={{ ["--angle" as string]: ANGLE_COLORS[p.angle] }}
                    onClick={canEdit ? () => setEditing(p) : undefined}
                    title={p.hook}
                  >
                    <span className="month-chip-time">{p.day}</span>
                    <span className="month-chip-hook">{p.hook || p.summary || "Sin título"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="cal-monthbar">
            <button className="icon-button" title="Semana anterior" onClick={() => shiftWeek(-1)}>
              <ChevronLeft size={16} />
            </button>
            <strong className="cal-monthlabel" style={{ textTransform: "none" }}>
              {weekLabel}
            </strong>
            <button className="icon-button" title="Semana siguiente" onClick={() => shiftWeek(1)}>
              <ChevronRight size={16} />
            </button>
            <button className="button small" onClick={() => setWeekRef(new Date())} style={{ marginLeft: 6 }}>
              Esta semana
            </button>
          </div>

          <div className="calendar">
            {week.map((date) => {
              const key = iso(date);
              // Misma regla que Planeación: con fecha solo en su semana real;
              // sin fecha, por día de la semana solo en la semana en curso.
              const dayItems = piecesForDate(pieces, date, currentWeek);
              return (
                <section className={`day${key === todayIso ? " today" : ""}`} key={key}>
                  <strong>
                    {DAYS[(date.getDay() + 6) % 7]} {date.getDate()}
                  </strong>
                  {dayItems.map((item) => (
                    <div
                      className="calendar-item"
                      key={item.id}
                      onClick={canEdit ? () => setEditing(item) : undefined}
                      style={canEdit ? undefined : { cursor: "default" }}
                    >
                      <span>
                        {item.time} · {item.format}
                        {!item.date && " · sin fecha"}
                      </span>
                      <p>{item.hook}</p>
                    </div>
                  ))}
                  {canEdit && (
                    <button className="add-account" style={{ width: "100%" }} onClick={() => setCreatingDate(key)}>
                      <Plus size={14} /> Agregar
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {modalOpen && (
        <PieceModal
          initial={editing}
          presetDate={creatingDate ?? undefined}
          onClose={closeModal}
          onSave={async (draft: PieceDraft) => {
            if (editing) await updatePiece(editing.id, draft);
            else await createPiece(draft);
            closeModal();
          }}
        />
      )}
    </div>
  );
}
