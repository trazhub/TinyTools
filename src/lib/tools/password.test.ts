import { describe, expect, it, vi } from "vitest";
import {
  AMBIGUOUS,
  CHARSETS,
  DEFAULT_OPTIONS,
  generatePassword,
  randomInt,
  strengthFromEntropy,
  type PasswordOptions,
  type RandomSource,
} from "./password";

const opts = (o: Partial<PasswordOptions> = {}): PasswordOptions => ({ ...DEFAULT_OPTIONS, ...o });

function password(o: Partial<PasswordOptions> = {}): string {
  const r = generatePassword(opts(o));
  if (!r.ok) throw new Error(r.error);
  return r.password;
}

describe("generatePassword", () => {
  it("honours the requested length", () => {
    for (const length of [4, 8, 20, 64, 128]) expect(password({ length })).toHaveLength(length);
  });

  it("includes every selected character type, every time", () => {
    for (let n = 0; n < 200; n++) {
      const p = password({ length: 4 });
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[0-9]/);
      expect([...p].some((c) => CHARSETS.symbols.includes(c))).toBe(true);
    }
  });

  it("only uses selected character types", () => {
    const p = password({ length: 100, uppercase: false, symbols: false, digits: false });
    expect(p).toMatch(/^[a-z]+$/);
    const d = password({ length: 100, lowercase: false, uppercase: false, symbols: false });
    expect(d).toMatch(/^[0-9]+$/);
  });

  it("excludes ambiguous characters when asked", () => {
    for (let n = 0; n < 50; n++) {
      const p = password({ length: 128, excludeAmbiguous: true });
      expect([...p].some((c) => AMBIGUOUS.includes(c))).toBe(false);
    }
  });

  it("generates different passwords each time", () => {
    const set = new Set(Array.from({ length: 100 }, () => password()));
    expect(set.size).toBe(100);
  });

  it("rejects invalid options with readable errors", () => {
    expect(generatePassword(opts({ lowercase: false, uppercase: false, digits: false, symbols: false }))).toEqual({
      ok: false,
      error: "Select at least one character type.",
    });
    expect(generatePassword(opts({ length: 3 })).ok).toBe(false);
    expect(generatePassword(opts({ length: 129 })).ok).toBe(false);
    expect(generatePassword(opts({ length: 10.5 })).ok).toBe(false);
    expect(generatePassword(opts({ length: Number.NaN })).ok).toBe(false);
  });

  it("reports entropy as length * log2(pool)", () => {
    const r = generatePassword(opts({ length: 10, uppercase: false, symbols: false, digits: false }));
    if (!r.ok) throw new Error(r.error);
    expect(r.entropyBits).toBeCloseTo(10 * Math.log2(26), 5);
  });

  it("uses only the Web Crypto source (never Math.random)", () => {
    const spy = vi.spyOn(Math, "random");
    password({ length: 64 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("randomInt", () => {
  it("returns values within range", () => {
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it("rejects values in the biased tail instead of folding them", () => {
    // max = 3 -> limit is 4294967295 (largest multiple of 3 <= 2^32). 0xFFFFFFFF must be rejected.
    const values = [0xffffffff, 4];
    let calls = 0;
    const source: RandomSource = (arr) => {
      arr[0] = values[calls++]!;
      return arr;
    };
    expect(randomInt(3, source)).toBe(1); // 4 % 3
    expect(calls).toBe(2);
  });

  it("is uniform (chi-squared sanity check)", () => {
    const buckets = new Array(10).fill(0) as number[];
    const n = 100_000;
    for (let i = 0; i < n; i++) buckets[randomInt(10)]!++;
    const expected = n / 10;
    const chi = buckets.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    // 9 degrees of freedom; 33.7 is p = 0.0001, so a false failure is ~1 in 10,000.
    expect(chi).toBeLessThan(33.7);
  });

  it("validates its argument", () => {
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(-1)).toThrow(RangeError);
    expect(() => randomInt(1.5)).toThrow(RangeError);
    expect(randomInt(1)).toBe(0);
  });
});

describe("strengthFromEntropy", () => {
  it("buckets entropy", () => {
    expect(strengthFromEntropy(20)).toBe("weak");
    expect(strengthFromEntropy(45)).toBe("fair");
    expect(strengthFromEntropy(70)).toBe("good");
    expect(strengthFromEntropy(128)).toBe("strong");
  });
});
