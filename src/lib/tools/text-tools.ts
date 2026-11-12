/** Text utilities: case conversion, cleanup and line diff. No imports, so they are easy to test. */

export type CaseKind = "upper" | "lower" | "title" | "sentence" | "camel" | "pascal" | "snake" | "kebab" | "constant";

/** Split text into words, also at camelCase boundaries ("fooBar" -> foo, Bar; "HTTPServer" -> HTTP, Server). */
export function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
}

const cap = (w: string) => (w ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w);

export function convertCase(text: string, kind: CaseKind): string {
  switch (kind) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "title":
      return text.toLowerCase().replace(/(^|[\s(["'-])(\p{L})/gu, (_, pre: string, ch: string) => pre + ch.toUpperCase());
    case "sentence":
      return text.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, pre: string, ch: string) => pre + ch.toUpperCase());
    case "camel":
      return splitWords(text).map((w, i) => (i === 0 ? w.toLowerCase() : cap(w))).join("");
    case "pascal":
      return splitWords(text).map(cap).join("");
    case "snake":
      return splitWords(text).map((w) => w.toLowerCase()).join("_");
    case "kebab":
      return splitWords(text).map((w) => w.toLowerCase()).join("-");
    case "constant":
      return splitWords(text).map((w) => w.toUpperCase()).join("_");
  }
}

export type CleanOp = "spaces" | "trim" | "blank" | "dupes" | "sort";

/** Apply cleanup steps in a fixed, sensible order. */
export function cleanText(text: string, ops: readonly CleanOp[]): string {
  let lines = text.split(/\r?\n/);
  if (ops.includes("spaces")) lines = lines.map((l) => l.replace(/[ \t]+/g, " "));
  if (ops.includes("trim")) lines = lines.map((l) => l.trim());
  if (ops.includes("blank")) lines = lines.filter((l) => l.trim() !== "");
  if (ops.includes("dupes")) lines = lines.filter((l, i) => lines.indexOf(l) === i);
  if (ops.includes("sort")) lines = [...lines].sort((a, b) => a.localeCompare(b));
  return lines.join("\n");
}

export type DiffPart = { type: "same" | "add" | "del"; text: string };

export const MAX_DIFF_LINES = 4000;

/** Line-by-line diff (longest common subsequence). Returns null if the input is too large. */
export function diffLines(a: string, b: string): DiffPart[] | null {
  const x = a === "" ? [] : a.split(/\r?\n/);
  const y = b === "" ? [] : b.split(/\r?\n/);
  if (x.length > MAX_DIFF_LINES || y.length > MAX_DIFF_LINES) return null;
  const n = x.length;
  const m = y.length;
  // lcs[i][j] = length of the common subsequence of x[i..] and y[j..]
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = x[i] === y[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ type: "same", text: x[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ type: "del", text: x[i++]! });
    } else {
      out.push({ type: "add", text: y[j++]! });
    }
  }
  while (i < n) out.push({ type: "del", text: x[i++]! });
  while (j < m) out.push({ type: "add", text: y[j++]! });
  return out;
}
