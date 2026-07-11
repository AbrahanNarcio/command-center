"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList } from "lucide-react";
import { DAYS, Piece } from "@/lib/types";
import { useStore } from "@/lib/store-context";
import { isoDate, piecesForDate, sameWeek, weekDays } from "@/lib/plan";
import { FORMAT_META } from "@/components/FormatIcon";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function longDate(d: Date): string {
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** Línea de una pieza en lenguaje llano: qué es, a qué hora y de qué trata. */
function PlanItem({ piece }: { piece: Piece }) {
  const meta = FORMAT_META[piece.format];
  const isAd = piece.format === "Ad";
  return (
    <div className="plan-item" style={{ ["--fmt" as string]: meta.color }}>
      <span className="plan-ico" aria-hidden>
        {meta.icon}
      </span>
      <span className="plan-what">
        <b>{meta.label}</b>
        {!isAd && <i> · {piece.time}</i>}
      </span>
      <span className="plan-hook">{isAd ? meta.hint : piece.hook || piece.summary || meta.hint}</span>
    </div>
  );
}

export default function PlanView() {
  const { accountPieces } = useStore();
  const [mode, setMode] = useState<"semana" | "mes">("semana");
  const today = new Date();
  const [weekRef, setWeekRef] = useState(() => new Date());
  const [monthRef, setMonthRef] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const days = useMemo(() => weekDays(weekRef), [weekRef]);
  const isCurrentWeek = sameWeek(weekRef, today);
  const todayKey = isoDate(today);

  const weekLabel = `Semana del ${longDate(days[0])} al ${longDate(days[6])}`;

  const shiftWeek = (delta: number) =>
    setWeekRef((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta * 7));

  // Cuadrícula del mes (Lun-Dom), como en Calendario pero de solo lectura.
  const monthCells = useMemo(() => {
    const year = monthRef.getFullYear();
    const month = monthRef.getMonth();
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthRef]);

  const undated = useMemo(() => accountPieces.filter((p) => !p.date), [accountPieces]);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Tu contenido, día por día</p>
          <h2>Planeación</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
            Qué se publica y qué día: reels, carruseles, historias y anuncios. Cada tipo tiene su
            icono y su color para ubicarlo de un vistazo.
          </p>
        </div>
        <div className="cal-mode" role="group" aria-label="Vista de la planeación">
          <button className={`chip${mode === "semana" ? " active" : ""}`} onClick={() => setMode("semana")}>
            <LayoutList size={14} /> Semana
          </button>
          <button className={`chip${mode === "mes" ? " active" : ""}`} onClick={() => setMode("mes")}>
            <CalendarDays size={14} /> Mes
          </button>
        </div>
      </div>

      <div className="plan-legend" aria-label="Tipos de contenido">
        {Object.values(FORMAT_META).map((meta) => (
          <span className="plan-legend-item" key={meta.label} style={{ ["--fmt" as string]: meta.color }}>
            {meta.icon} {meta.label}
          </span>
        ))}
      </div>

      {mode === "semana" ? (
        <>
          <div className="cal-monthbar">
            <button className="icon-button" title="Semana anterior" onClick={() => shiftWeek(-1)}>
              <ChevronLeft size={16} />
            </button>
            <strong className="cal-monthlabel cal-weeklabel" style={{ textTransform: "none" }}>
              {weekLabel}
            </strong>
            <button className="icon-button" title="Semana siguiente" onClick={() => shiftWeek(1)}>
              <ChevronRight size={16} />
            </button>
            <button className="button small" onClick={() => setWeekRef(new Date())} style={{ marginLeft: 6 }}>
              Esta semana
            </button>
          </div>

          <div className="plan-week">
            {days.map((date, i) => {
              const items = piecesForDate(accountPieces, date, isCurrentWeek);
              const isToday = isoDate(date) === todayKey;
              return (
                <section className={`plan-day${isToday ? " today" : ""}`} key={isoDate(date)}>
                  <header className="plan-day-head">
                    <strong>{DAY_NAMES[i]}</strong>
                    <span>
                      {longDate(date)}
                      {isToday ? " · hoy" : ""}
                    </span>
                  </header>
                  {items.length ? (
                    <div className="plan-day-items">
                      {items.map((p) => (
                        <PlanItem piece={p} key={p.id} />
                      ))}
                    </div>
                  ) : (
                    <p className="plan-empty">Sin publicaciones este día.</p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="cal-monthbar">
            <button
              className="icon-button"
              title="Mes anterior"
              onClick={() => setMonthRef((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <strong className="cal-monthlabel">
              {MONTHS[monthRef.getMonth()]} {monthRef.getFullYear()}
            </strong>
            <button
              className="icon-button"
              title="Mes siguiente"
              onClick={() => setMonthRef((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            >
              <ChevronRight size={16} />
            </button>
            <button
              className="button small"
              onClick={() => setMonthRef(new Date(today.getFullYear(), today.getMonth(), 1))}
              style={{ marginLeft: 6 }}
            >
              Hoy
            </button>
          </div>

          <div className="month-grid">
            {DAYS.map((d) => (
              <div className="month-dow" key={d}>
                {d}
              </div>
            ))}
            {monthCells.map((date, i) => {
              if (!date) return <div className="month-cell empty" key={`e${i}`} />;
              const key = isoDate(date);
              const items = accountPieces
                .filter((p) => p.date === key)
                .sort((a, b) => a.time.localeCompare(b.time));
              const isToday = key === todayKey;
              return (
                <div className={`month-cell${isToday ? " today" : ""}${items.length ? " has" : ""}`} key={key}>
                  <div className="month-cell-head">
                    <span className="month-daynum">{date.getDate()}</span>
                  </div>
                  <div className="month-items">
                    {items.map((p) => {
                      const meta = FORMAT_META[p.format];
                      return (
                        <span
                          className="month-chip plan-chip"
                          key={p.id}
                          style={{ ["--angle" as string]: meta.color }}
                          title={`${meta.label} · ${p.time} · ${p.hook || p.summary || meta.hint}`}
                        >
                          <span className="plan-chip-ico">{meta.icon}</span>
                          <span className="month-chip-time">{p.time}</span>
                          <span className="month-chip-hook">{meta.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {undated.length > 0 && (
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12, marginBottom: 0 }}>
              Hay {undated.length} {undated.length === 1 ? "pieza" : "piezas"} sin fecha asignada que
              todavía no aparecen en el mes.
            </p>
          )}
        </>
      )}
    </div>
  );
}
