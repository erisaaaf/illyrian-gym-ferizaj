export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export const fmtTimeOfDay = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const fmtDateTime = (iso: string) => `${fmtDate(iso)} · ${fmtTimeOfDay(iso)}`;

/** Seconds -> m:ss */
export const fmtDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** Parses "m:ss", "mm:ss" or plain seconds. Returns null when the text is not a valid duration. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(\d+):([0-5]?\d)$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const UNIT_LABEL: Record<string, string> = { KG: "kg", REPS: "reps", SECONDS: "", KM: "km", ROUNDS: "rounds" };

/** A stored PR value with its unit, e.g. "90 kg" or "2:02". */
export function fmtPr(value: number | string, unit: string): string {
  const n = Number(value);
  if (unit === "SECONDS") return fmtDuration(n);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${UNIT_LABEL[unit] ?? unit.toLowerCase()}`.trim();
}

export const label = (enumValue: string) =>
  enumValue
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
