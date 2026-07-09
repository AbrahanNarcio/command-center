import { PieceFormat } from "./types";

export const PALETTE: [string, string][] = [
  ["#58e6ff", "#9b7cff"],
  ["#d8ff63", "#58e6ff"],
  ["#ff77bc", "#ffc857"],
  ["#ff6f61", "#9b7cff"],
  ["#80ffb5", "#ffc857"],
  ["#9b7cff", "#58e6ff"],
];

export function scoreColor(score: number): string {
  if (score >= 86) return "linear-gradient(90deg, var(--green), var(--lime))";
  if (score >= 74) return "linear-gradient(90deg, var(--amber), var(--green))";
  return "linear-gradient(90deg, var(--coral), var(--amber))";
}

export function formatSlug(format: PieceFormat): string {
  return format.toLowerCase();
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const raw = Date.now() - then;
  const future = raw < 0;
  const diff = Math.abs(raw);
  const mins = Math.round(diff / 60000);
  const fmt = (txt: string) => (future ? `en ${txt}` : `hace ${txt}`);
  if (mins < 1) return future ? "en instantes" : "hace instantes";
  if (mins < 60) return fmt(`${mins} min`);
  const hours = Math.round(mins / 60);
  if (hours < 24) return fmt(`${hours} h`);
  const days = Math.round(hours / 24);
  return fmt(`${days} días`);
}
