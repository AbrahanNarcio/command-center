import { DAYS, Piece } from "./types";

/** YYYY-MM-DD local (sin corrimiento de zona). */
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Los 7 días (Lun a Dom) de la semana que contiene `ref`. */
export function weekDays(ref: Date): Date[] {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from(
    { length: 7 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

/** Piezas planeadas para una fecha: las que tienen esa fecha exacta y, solo en
 *  la semana en curso, las que no tienen fecha pero caen en ese día de la semana. */
export function piecesForDate(pieces: Piece[], date: Date, currentWeek: boolean): Piece[] {
  const key = isoDate(date);
  const dow = DAYS[(date.getDay() + 6) % 7];
  return pieces
    .filter((p) => (p.date ? p.date === key : currentWeek && p.day === dow))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** ¿`a` y `b` caen en la misma semana (Lun-Dom)? */
export function sameWeek(a: Date, b: Date): boolean {
  return isoDate(weekDays(a)[0]) === isoDate(weekDays(b)[0]);
}
