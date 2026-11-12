/** Site-wide constants. Set NEXT_PUBLIC_SITE_URL at build time to your deployed origin. */
const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

export const SITE = {
  name: "TinyTools",
  tagline: "Small tools that do one thing. No ads, no accounts, no tracking.",
  description: "Small, free tools that do one thing and run in your browser. No ads, no accounts, no tracking.",
  url: rawUrl.replace(/\/+$/, ""),
} as const;

export function absoluteUrl(path: string): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
