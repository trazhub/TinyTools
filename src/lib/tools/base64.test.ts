import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64 } from "./base64";

const std = { urlSafe: false, padding: true };

describe("encodeBase64", () => {
  it("encodes ASCII", () => {
    expect(encodeBase64("Hello, World!")).toBe("SGVsbG8sIFdvcmxkIQ==");
    expect(encodeBase64("")).toBe("");
  });

  it("encodes UTF-8 (accents, CJK, emoji) correctly", () => {
    expect(encodeBase64("héllo")).toBe("aMOpbGxv");
    expect(encodeBase64("日本語")).toBe("5pel5pys6Kqe");
    expect(encodeBase64("😀")).toBe("8J+YgA==");
  });

  it("supports URL-safe and unpadded output", () => {
    // ">>>???" -> standard "Pj4+Pz8/" ; url-safe "Pj4-Pz8_"
    expect(encodeBase64(">>>???", std)).toBe("Pj4+Pz8/");
    expect(encodeBase64(">>>???", { urlSafe: true, padding: true })).toBe("Pj4-Pz8_");
    expect(encodeBase64("a", { urlSafe: false, padding: false })).toBe("YQ");
  });

  it("handles large inputs without stack overflow", () => {
    const big = "x".repeat(2_000_000);
    const encoded = encodeBase64(big);
    expect(encoded.length).toBe(Math.ceil(big.length / 3) * 4);
  });
});

describe("decodeBase64", () => {
  it("round-trips arbitrary unicode text", () => {
    for (const text of ["", "plain", "héllo wörld", "日本語のテキスト", "😀👨‍👩‍👧 mixed", "line1\nline2\ttab"]) {
      expect(decodeBase64(encodeBase64(text))).toEqual({ ok: true, output: text });
    }
  });

  it("accepts URL-safe input, missing padding and whitespace/newlines", () => {
    expect(decodeBase64("Pj4-Pz8_")).toEqual({ ok: true, output: ">>>???" });
    expect(decodeBase64("YQ")).toEqual({ ok: true, output: "a" });
    expect(decodeBase64("SGVs\nbG8s IFdv\r\ncmxkIQ==")).toEqual({ ok: true, output: "Hello, World!" });
  });

  it("returns an empty result for empty input", () => {
    expect(decodeBase64("  \n ")).toEqual({ ok: true, output: "" });
  });

  it("explains invalid characters with a position", () => {
    const r = decodeBase64("SGVs$bG8=");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/"\$".*position 5/);
  });

  it("rejects mixed alphabets, misplaced padding and impossible lengths", () => {
    expect(decodeBase64("a+b-").ok).toBe(false);
    expect(decodeBase64("ab=cd").ok).toBe(false);
    expect(decodeBase64("abcde").ok).toBe(false);
  });

  it("reports binary data that is not UTF-8 text", () => {
    // 0xFF 0xFE is not valid UTF-8
    const r = decodeBase64("//4=");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/UTF-8/);
  });
});
