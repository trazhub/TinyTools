import { describe, expect, it } from "vitest";
import { formatJson, jsonStats, minifyJson, parseJson } from "./json-formatter";

const pretty2 = { indent: 2 as const, sortKeys: false };

describe("formatJson", () => {
  it("pretty-prints with 2 spaces", () => {
    const r = formatJson('{"a":1,"b":[true,null,"x"],"c":{}}', pretty2);
    expect(r).toEqual({
      ok: true,
      output: '{\n  "a": 1,\n  "b": [\n    true,\n    null,\n    "x"\n  ],\n  "c": {}\n}',
    });
  });

  it("supports 4 spaces and tabs", () => {
    expect(formatJson("[1]", { indent: 4, sortKeys: false })).toEqual({ ok: true, output: "[\n    1\n]" });
    expect(formatJson("[1]", { indent: "tab", sortKeys: false })).toEqual({ ok: true, output: "[\n\t1\n]" });
  });

  it("keeps empty containers compact", () => {
    expect(formatJson("[[],{}]", pretty2)).toEqual({ ok: true, output: "[\n  [],\n  {}\n]" });
  });

  it("does not corrupt big integers, decimals or exponents", () => {
    const input = '{"id":12345678901234567890,"p":1.10,"e":1E+400,"z":-0}';
    const r = minifyJson(input);
    expect(r).toEqual({ ok: true, output: input });
  });

  it("preserves string escapes exactly", () => {
    const input = '{"s":"line\\nbreak \\u00e9 \\/ \\"q\\""}';
    expect(minifyJson(input)).toEqual({ ok: true, output: input });
  });

  it("sorts keys recursively when asked", () => {
    const r = formatJson('{"b":1,"a":{"d":1,"c":2}}', { indent: 2, sortKeys: true });
    expect(r.ok && r.output).toBe('{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}');
  });

  it("is idempotent", () => {
    const first = formatJson('{"a":[1,2,{"b":null}]}', pretty2);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(formatJson(first.output, pretty2)).toEqual(first);
  });
});

describe("minifyJson", () => {
  it("removes all insignificant whitespace but keeps whitespace in strings", () => {
    const r = minifyJson('{\n  "a" : [ 1 , 2 ],\n  "b" : "x  y"\n}');
    expect(r).toEqual({ ok: true, output: '{"a":[1,2],"b":"x  y"}' });
  });
});

describe("validation errors", () => {
  const err = (text: string) => {
    const r = parseJson(text);
    if (r.ok) throw new Error("expected failure");
    return r.error;
  };

  it("rejects empty input", () => {
    expect(err("   ").message).toMatch(/empty/i);
  });

  it("reports line and column", () => {
    const e = err('{\n  "a": 1,\n  "b": }\n');
    expect(e.line).toBe(3);
    expect(e.column).toBe(8);
  });

  it("rejects trailing commas", () => {
    expect(err("[1,2,]").message).toMatch(/trailing comma/i);
    expect(err('{"a":1,}').message).toMatch(/trailing comma/i);
  });

  it("rejects single quotes, comments, unquoted keys and bare words", () => {
    expect(err("{'a':1}").message).toMatch(/double quotes/i);
    expect(err("// hi\n{}").message).toMatch(/unexpected/i);
    expect(err("{a:1}").message).toMatch(/property name/i);
    expect(err("undefined").message).toMatch(/unexpected/i);
    expect(err("NaN").message).toMatch(/unexpected/i);
  });

  it("rejects invalid numbers", () => {
    for (const bad of ["01", "1.", ".5", "+1", "1e", "-", "0x10"]) {
      expect(parseJson(bad).ok, bad).toBe(false);
    }
  });

  it("rejects bad strings", () => {
    expect(err('"abc').message).toMatch(/unterminated/i);
    expect(err('"a\nb"').message).toMatch(/control/i);
    expect(err('"\\x"').message).toMatch(/escape/i);
    expect(err('"\\u12G4"').message).toMatch(/unicode/i);
  });

  it("rejects extra content after the value", () => {
    expect(err("{} {}").message).toMatch(/after the end/i);
  });

  it("rejects excessively deep nesting without crashing", () => {
    const deep = "[".repeat(5000) + "]".repeat(5000);
    expect(err(deep).message).toMatch(/deeper/i);
  });

  it("accepts all primitive top-level values", () => {
    for (const ok of ["1", '"s"', "true", "false", "null", " [] "]) {
      expect(parseJson(ok).ok, ok).toBe(true);
    }
  });
});

describe("jsonStats", () => {
  it("counts depth, keys and values", () => {
    const r = parseJson('{"a":[1,{"b":2}],"c":3}');
    if (!r.ok) throw new Error("parse failed");
    expect(jsonStats(r.value)).toEqual({ depth: 4, keys: 3, values: 6 });
  });
});

describe("large input", () => {
  it("handles a ~2 MB document quickly", () => {
    const items = Array.from({ length: 20000 }, (_, i) => ({ id: i, name: `item-${i}`, tags: ["a", "b"] }));
    const text = JSON.stringify(items);
    const start = performance.now();
    const r = formatJson(text, pretty2);
    expect(r.ok).toBe(true);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
