/** Run a regular expression over text and list the matches. */

export interface MatchInfo {
  index: number;
  text: string;
  groups: (string | undefined)[];
}

export type RegexResult = { ok: true; matches: MatchInfo[]; truncated: boolean } | { ok: false; error: string };

export const MAX_MATCHES = 1000;

export function runRegex(pattern: string, flags: string, text: string): RegexResult {
  if (pattern === "") return { ok: true, matches: [], truncated: false };
  if (!/^[dgimsuvy]*$/.test(flags)) return { ok: false, error: "Flags can only be d, g, i, m, s, u, v or y." };
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid pattern." };
  }
  const matches: MatchInfo[] = [];
  let truncated = false;
  for (const m of text.matchAll(re)) {
    if (matches.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }
    matches.push({ index: m.index ?? 0, text: m[0], groups: m.slice(1) });
  }
  return { ok: true, matches, truncated };
}
