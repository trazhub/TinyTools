import { describe, expect, it, vi } from "vitest";
import { evaluate, formatResult } from "./calc";

const val = (s: string) => {
  const r = evaluate(s);
  if (!r.ok) throw new Error(`${s}: ${r.error}`);
  return r.value;
};
const err = (s: string) => {
  const r = evaluate(s);
  if (r.ok) throw new Error(`${s} should fail but gave ${r.value}`);
  return r.error;
};

describe("evaluate", () => {
  it("does basic arithmetic", () => {
    expect(val("1+2")).toBe(3);
    expect(val("10-4")).toBe(6);
    expect(val("6×7")).toBe(42);
    expect(val("20÷4")).toBe(5);
    expect(val("2.5+0.5")).toBe(3);
  });

  it("accepts keyboard operator spellings", () => {
    expect(val("6*7")).toBe(42);
    expect(val("20/4")).toBe(5);
    expect(val("5−2")).toBe(3);
    expect(val("3x4")).toBe(12);
  });

  it("respects operator precedence", () => {
    expect(val("2+3×4")).toBe(14);
    expect(val("(2+3)×4")).toBe(20);
    expect(val("10-2-3")).toBe(5);
    expect(val("100÷10÷2")).toBe(5);
    expect(val("2+3×4^2")).toBe(50);
  });

  it("handles negative numbers", () => {
    expect(val("-5+2")).toBe(-3);
    expect(val("3×-2")).toBe(-6);
    expect(val("--4")).toBe(4);
    expect(val("5-(-3)")).toBe(8);
    expect(val("-2^2")).toBe(-4);
    expect(val("2^-1")).toBe(0.5);
  });

  it("handles powers right-associatively", () => {
    expect(val("2^3^2")).toBe(512);
  });

  it("supports decimals", () => {
    expect(val(".5+.5")).toBe(1);
    expect(val("1.5×2")).toBe(3);
  });

  it("implements the percent convention", () => {
    expect(val("50%")).toBe(0.5);
    expect(val("200+10%")).toBe(220);
    expect(val("200-10%")).toBe(180);
    expect(val("200×10%")).toBe(20);
    expect(val("(50+50)%")).toBe(1);
  });

  it("supports implicit multiplication", () => {
    expect(val("2(3)")).toBe(6);
    expect(val("(1+2)(3+4)")).toBe(21);
    expect(val("2(3)4")).toBe(24);
  });

  it("explains errors", () => {
    expect(err("1÷0")).toBe("Cannot divide by zero");
    expect(err("5÷(2-2)")).toBe("Cannot divide by zero");
    expect(err("")).toMatch(/Enter/);
    expect(err("2+")).toMatch(/incomplete/);
    expect(err("(2+3")).toMatch(/closing parenthesis/);
    expect(err("2+3)")).toMatch(/closing parenthesis/);
    expect(err("×5")).toMatch(/needs a number/);
    expect(err("1..2")).toMatch(/not a valid number/);
    expect(err("2 a")).toMatch(/Unexpected "a"/);
    expect(err("9^999")).toMatch(/too large/);
    expect(err("(-8)^0.5")).toMatch(/real number/);
  });

  it("never evaluates code", () => {
    const spy = vi.spyOn(globalThis, "eval");
    for (const evil of ["alert(1)", "process.exit()", "2+constructor", "1;2", "(()=>1)()"]) {
      expect(evaluate(evil).ok, evil).toBe(false);
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("handles very deep nesting without crashing", () => {
    const deep = "(".repeat(2000) + "1" + ")".repeat(2000);
    expect(() => evaluate(deep)).not.toThrow();
  });
});

describe("formatResult", () => {
  it("removes floating point noise", () => {
    expect(formatResult(0.1 + 0.2)).toBe("0.3");
    expect(formatResult(1 / 3)).toBe("0.333333333333");
    expect(formatResult(100)).toBe("100");
    expect(formatResult(-0)).toBe("0");
  });

  it("uses exponents for extreme values", () => {
    expect(formatResult(1e20)).toBe("1e20");
    expect(formatResult(1.5e-12)).toBe("1.5e-12");
  });
});
