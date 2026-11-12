/**
 * Site-wide constants. Set at build time (the GitHub Pages workflow does this):
 *   NEXT_PUBLIC_SITE_URL   the origin, e.g. https://trazhub.github.io
 *   NEXT_PUBLIC_BASE_PATH  the repo path, e.g. /TinyTools (empty for a user/custom-domain site)
 */
const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
const base = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/+$/, "") ?? "";

export const SITE = {
  name: "TinyTools",
  tagline: "Small tools that do one thing. No ads, no accounts, no tracking.",
  description: "Small, free tools that do one thing and run in your browser. No ads, no accounts, no tracking.",
  origin: origin.replace(/\/+$/, ""),
  base,
} as const;

/** Full public URL for a site path, including the base path. */
export function absoluteUrl(path: string): string {
  return `${SITE.origin}${SITE.base}${path.startsWith("/") ? path : `/${path}`}`;
}
