export interface EncodeOptions {
  /** Use the URL-safe alphabet (- and _ instead of + and /). */
  urlSafe: boolean;
  /** Keep "=" padding. */
  padding: boolean;
}

export type Base64Result = { ok: true; output: string } | { ok: false; error: string };

const CHUNK = 0x8000;

/** Encode raw bytes as standard Base64 (chunked so large inputs don't overflow the call stack). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Decode standard Base64 into bytes. Input must already be normalised and padded. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeBase64(text: string, options: EncodeOptions = { urlSafe: false, padding: true }): string {
  let out = bytesToBase64(new TextEncoder().encode(text));
  if (options.urlSafe) out = out.replace(/\+/g, "-").replace(/\//g, "_");
  if (!options.padding) out = out.replace(/=+$/, "");
  return out;
}

/**
 * Decode Base64 (standard or URL-safe, with or without padding, whitespace
 * ignored) to UTF-8 text. Fails with a readable message instead of throwing.
 */
export function decodeBase64(input: string): Base64Result {
  const compact = input.replace(/\s+/g, "");
  if (compact === "") return { ok: true, output: "" };

  const invalid = compact.match(/[^A-Za-z0-9+/_=-]/);
  if (invalid) {
    return { ok: false, error: `Invalid character "${invalid[0]}" at position ${invalid.index! + 1}. Base64 only uses A-Z, a-z, 0-9, + / (or - _) and =.` };
  }
  if (/[+/]/.test(compact) && /[-_]/.test(compact)) {
    return { ok: false, error: "Mixes standard (+ /) and URL-safe (- _) characters. Use one alphabet." };
  }

  const stripped = compact.replace(/=+$/, "");
  if (stripped.includes("=")) {
    return { ok: false, error: 'Padding "=" may only appear at the end.' };
  }
  if (stripped.length % 4 === 1) {
    return { ok: false, error: "The length is not valid for Base64 (an input cannot be 1 more than a multiple of 4 characters). It may be truncated." };
  }

  const standard = stripped.replace(/-/g, "+").replace(/_/g, "/");
  const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(padded);
  } catch {
    return { ok: false, error: "This is not valid Base64." };
  }

  try {
    return { ok: true, output: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return {
      ok: false,
      error: "The decoded data is not valid UTF-8 text. It is probably binary data (an image or file), which this text tool cannot display.",
    };
  }
}
