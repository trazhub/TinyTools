export type Ranges = { ok: true; groups: number[][] } | { ok: false; error: string };

/**
 * Parse page ranges such as "1-3, 5, 8-" (1-based). Each comma part is one group.
 * "8-" means page 8 to the last page, "-3" means page 1 to 3.
 */
export function parseRanges(spec: string, total: number): Ranges {
  const parts = spec.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "Enter pages, for example 1-3, 5, 8-" };
  const groups: number[][] = [];
  for (const part of parts) {
    const m = /^(\d*)\s*(-)?\s*(\d*)$/.exec(part);
    if (!m || (!m[1] && !m[3])) return { ok: false, error: `"${part}" is not a page or range.` };
    let from: number;
    let to: number;
    if (!m[2]) {
      from = to = Number(m[1]);
    } else {
      from = m[1] ? Number(m[1]) : 1;
      to = m[3] ? Number(m[3]) : total;
    }
    if (from < 1 || to < 1 || from > total || to > total) return { ok: false, error: `"${part}" is outside this PDF (it has ${total} page${total === 1 ? "" : "s"}).` };
    if (from > to) return { ok: false, error: `"${part}" goes backwards.` };
    groups.push(Array.from({ length: to - from + 1 }, (_, i) => from + i));
  }
  return { ok: true, groups };
}
