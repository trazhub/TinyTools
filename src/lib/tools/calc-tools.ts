/** Small everyday calculators: percentages, date differences, age, timestamps. */

export const pctOf = (percent: number, value: number) => (percent / 100) * value;
export const whatPercent = (part: number, whole: number) => (whole === 0 ? NaN : (part / whole) * 100);
export const pctChange = (from: number, to: number) => (from === 0 ? NaN : ((to - from) / Math.abs(from)) * 100);

export interface DateDiff {
  years: number;
  months: number;
  days: number;
  totalDays: number;
}

/** Difference between two calendar dates (UTC midnight), as years, months and days plus the total days. */
export function dateDiff(a: Date, b: Date): DateDiff {
  const ordered = a <= b ? [a, b] : [b, a];
  const from = new Date(Date.UTC(ordered[0]!.getUTCFullYear(), ordered[0]!.getUTCMonth(), ordered[0]!.getUTCDate()));
  const to = new Date(Date.UTC(ordered[1]!.getUTCFullYear(), ordered[1]!.getUTCMonth(), ordered[1]!.getUTCDate()));
  const totalDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  // Whole months first, then the days left over. Adding months clamps to the end of a short month
  // (31 Jan + 1 month = 29 Feb), which is how people usually count.
  const addMonths = (d: Date, n: number) => {
    const y = d.getUTCFullYear() + Math.floor((d.getUTCMonth() + n) / 12);
    const m = (((d.getUTCMonth() + n) % 12) + 12) % 12;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
  };
  let whole = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (addMonths(from, whole) > to) whole--;
  const days = Math.round((to.getTime() - addMonths(from, whole).getTime()) / 86_400_000);
  return { years: Math.floor(whole / 12), months: whole % 12, days, totalDays };
}

/** Parse "YYYY-MM-DD" as a UTC date. Returns null if invalid. */
export function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null;
}

export interface Stamp {
  iso: string;
  seconds: number;
  millis: number;
}

/**
 * Understand a timestamp: seconds, milliseconds (13 digits), or a date string.
 * Returns null if it cannot be read.
 */
export function parseStamp(input: string): Stamp | null {
  const s = input.trim();
  if (!s) return null;
  let ms: number;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    ms = Math.abs(n) >= 1e11 ? n : n * 1000; // 1e11 ms is 1973; 1e11 s is year 5138
  } else {
    ms = Date.parse(s);
  }
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return { iso: d.toISOString(), seconds: Math.floor(ms / 1000), millis: Math.round(ms) };
}

/** Parse a time such as "90", "1:30" or "1:02:03.5" into seconds. Returns null if it is not a valid time. */
export function parseClock(input: string): number | null {
  const s = input.trim();
  if (!/^\d+(\.\d+)?(:\d{1,2}(\.\d+)?){0,2}$/.test(s)) return null;
  const parts = s.split(":").map(Number);
  if (parts.slice(1).some((n) => n >= 60)) return null;
  return parts.reduce((total, n) => total * 60 + n, 0);
}
