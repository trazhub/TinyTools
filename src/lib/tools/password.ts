/**
 * Password generation using the Web Crypto API.
 *
 * Randomness comes only from crypto.getRandomValues. Selection uses rejection
 * sampling so there is no modulo bias, and the final order is shuffled with an
 * unbiased Fisher-Yates so guaranteed characters don't sit at fixed positions.
 */

export const CHARSETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
} as const;

/** Characters that are easy to confuse when read aloud or in some fonts. */
export const AMBIGUOUS = "Il1|O0o";

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

export type RandomSource = (array: Uint32Array) => Uint32Array;

const defaultSource: RandomSource = (array) => crypto.getRandomValues(array);

/** Uniform random integer in [0, max) with no modulo bias. */
export function randomInt(max: number, source: RandomSource = defaultSource): number {
  if (!Number.isInteger(max) || max <= 0 || max > 0x1_0000_0000) {
    throw new RangeError("max must be an integer between 1 and 2^32");
  }
  if (max === 1) return 0;
  const range = 0x1_0000_0000;
  const limit = range - (range % max); // largest multiple of max below 2^32
  const buf = new Uint32Array(1);
  for (;;) {
    const v = source(buf)[0]!;
    if (v < limit) return v % max;
  }
}

export function activeCharsets(options: PasswordOptions): string[] {
  const sets: string[] = [];
  const ambiguous = options.excludeAmbiguous ? new Set(AMBIGUOUS) : null;
  const keep = (s: string) => (ambiguous ? [...s].filter((c) => !ambiguous.has(c)).join("") : s);
  if (options.lowercase) sets.push(keep(CHARSETS.lowercase));
  if (options.uppercase) sets.push(keep(CHARSETS.uppercase));
  if (options.digits) sets.push(keep(CHARSETS.digits));
  if (options.symbols) sets.push(keep(CHARSETS.symbols));
  return sets.filter((s) => s.length > 0);
}

export type PasswordResult = { ok: true; password: string; entropyBits: number } | { ok: false; error: string };

export function generatePassword(options: PasswordOptions, source: RandomSource = defaultSource): PasswordResult {
  if (!Number.isInteger(options.length) || options.length < MIN_LENGTH || options.length > MAX_LENGTH) {
    return { ok: false, error: `Length must be a whole number between ${MIN_LENGTH} and ${MAX_LENGTH}.` };
  }
  const sets = activeCharsets(options);
  if (sets.length === 0) {
    return { ok: false, error: "Select at least one character type." };
  }
  if (options.length < sets.length) {
    return { ok: false, error: "Length is too short to include every selected character type." };
  }

  const pool = sets.join("");
  const chars: string[] = [];
  // Guarantee at least one character from every selected set...
  for (const set of sets) chars.push(set[randomInt(set.length, source)]!);
  // ...then fill the rest from the combined pool.
  while (chars.length < options.length) chars.push(pool[randomInt(pool.length, source)]!);
  // Shuffle so the guaranteed characters aren't predictable positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, source);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  return { ok: true, password: chars.join(""), entropyBits: estimateEntropy(options.length, pool.length) };
}

/** Upper-bound entropy estimate: length * log2(pool size). */
export function estimateEntropy(length: number, poolSize: number): number {
  if (length <= 0 || poolSize <= 1) return 0;
  return length * Math.log2(poolSize);
}

export type Strength = "weak" | "fair" | "good" | "strong";

export function strengthFromEntropy(bits: number): Strength {
  if (bits < 40) return "weak";
  if (bits < 60) return "fair";
  if (bits < 80) return "good";
  return "strong";
}
