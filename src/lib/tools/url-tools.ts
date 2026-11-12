/** URL encoding helpers. */

export type UrlMode = "component" | "full";

export function urlEncode(text: string, mode: UrlMode): string {
  return mode === "component" ? encodeURIComponent(text) : encodeURI(text);
}

/** Returns null if the text is not valid percent-encoding. */
export function urlDecode(text: string, mode: UrlMode): string | null {
  try {
    return mode === "component" ? decodeURIComponent(text) : decodeURI(text);
  } catch {
    return null;
  }
}

/** Split a URL query string into name/value pairs. Returns null if it is not a valid URL. */
export function parseQuery(url: string): { name: string; value: string }[] | null {
  try {
    return [...new URL(url).searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch {
    return null;
  }
}
