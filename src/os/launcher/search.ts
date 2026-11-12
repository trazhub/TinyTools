import type { AppDefinition } from "../apps/types";

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function scoreToken(app: AppDefinition, token: string): number {
  const name = normalize(app.name);
  let score = 0;
  if (name.startsWith(token)) score = 10;
  else if (name.split(/[\s-]+/).some((w) => w.startsWith(token))) score = 8;
  else if (name.includes(token)) score = 6;

  if (normalize(app.id) === token) score = Math.max(score, 9);
  for (const keyword of app.keywords) {
    const k = normalize(keyword);
    if (k === token) score = Math.max(score, 7);
    else if (k.startsWith(token)) score = Math.max(score, 5);
    else if (k.includes(token)) score = Math.max(score, 3);
  }
  if (normalize(app.description).includes(token)) score = Math.max(score, 1);
  return score;
}

/**
 * Find apps matching a query. Every word must match somewhere (name, id, keywords
 * or description); better matches come first, ties keep the registry order.
 */
export function searchApps(apps: readonly AppDefinition[], query: string): AppDefinition[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...apps];
  return apps
    .map((app, index) => {
      const scores = tokens.map((t) => scoreToken(app, t));
      return { app, index, total: scores.every((s) => s > 0) ? scores.reduce((a, b) => a + b, 0) : 0 };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || a.index - b.index)
    .map((r) => r.app);
}
