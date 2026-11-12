/** Decode the header and payload of a JSON Web Token. This does NOT check the signature. */

export interface Jwt {
  header: unknown;
  payload: unknown;
  signature: string;
}

function b64urlToText(part: string): string {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function decodeJwt(token: string): Jwt | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts.slice(0, 2).some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
  try {
    return { header: JSON.parse(b64urlToText(parts[0]!)), payload: JSON.parse(b64urlToText(parts[1]!)), signature: parts[2]! };
  } catch {
    return null;
  }
}
