import { describe, expect, it } from "vitest";
import { evaluate } from "./calc";
import {
  actionForKey,
  appendCloseParen,
  appendDecimal,
  appendDigit,
  appendOpenParen,
  appendOperator,
  appendPercent,
  backspace,
  toggleSign,
} from "./keypad";

describe("appendDigit / appendDecimal", () => {
  it("appends digits", () => {
    expect(appendDigit("", "5")).toBe("5");
    expect(appendDigit("12", "3")).toBe("123");
  });
  it("treats a digit after ) or % as multiplication", () => {
    expect(appendDigit("(2)", "3")).toBe("(2)×3");
    expect(appendDigit("50%", "2")).toBe("50%×2");
  });
  it("allows one decimal point per number", () => {
    expect(appendDecimal("")).toBe("0.");
    expect(appendDecimal("1")).toBe("1.");
    expect(appendDecimal("1.5")).toBe("1.5");
    expect(appendDecimal("1.5+2")).toBe("1.5+2.");
    expect(appendDecimal("1+")).toBe("1+0.");
  });
});

describe("appendOperator", () => {
  it("adds operators after numbers", () => {
    expect(appendOperator("5", "+")).toBe("5+");
  });
  it("replaces a trailing operator", () => {
    expect(appendOperator("5+", "×")).toBe("5×");
    expect(appendOperator("5×", "+")).toBe("5+");
  });
  it("allows a negative sign after × ÷ ^ and at the start", () => {
    expect(appendOperator("5×", "-")).toBe("5×-");
    expect(appendOperator("", "-")).toBe("-");
    expect(appendOperator("(", "-")).toBe("(-");
  });
  it("ignores operators with nothing to operate on", () => {
    expect(appendOperator("", "×")).toBe("");
    expect(appendOperator("(", "×")).toBe("(");
  });
  it("collapses 'x-' followed by another operator", () => {
    expect(appendOperator("5×-", "+")).toBe("5+");
  });
});

describe("parentheses and percent", () => {
  it("multiplies implicitly when opening after a number", () => {
    expect(appendOpenParen("2")).toBe("2×(");
    expect(appendOpenParen("")).toBe("(");
    expect(appendOpenParen("2+")).toBe("2+(");
  });
  it("only closes when there is something open and a value before it", () => {
    expect(appendCloseParen("(2")).toBe("(2)");
    expect(appendCloseParen("2")).toBe("2");
    expect(appendCloseParen("(2+")).toBe("(2+");
    expect(appendCloseParen("(")).toBe("(");
    expect(appendCloseParen("(2)")).toBe("(2)");
  });
  it("adds percent only after a value", () => {
    expect(appendPercent("50")).toBe("50%");
    expect(appendPercent("50+")).toBe("50+");
    expect(appendPercent("")).toBe("");
  });
});

describe("toggleSign / backspace", () => {
  it("negates and un-negates the last number", () => {
    expect(toggleSign("5")).toBe("(-5)");
    expect(toggleSign("(-5)")).toBe("5");
    expect(toggleSign("-5")).toBe("5");
    expect(toggleSign("2+3")).toBe("2+(-3)");
    expect(toggleSign("2+(-3)")).toBe("2+3");
    expect(toggleSign("1.5")).toBe("(-1.5)");
  });

  it("leaves expressions without a trailing number alone", () => {
    expect(toggleSign("2+")).toBe("2+");
    expect(toggleSign("")).toBe("-");
  });
});

describe("expressions built from the keypad evaluate correctly", () => {
  const build = (keys: string[]) => {
    let expr = "";
    for (const key of keys) {
      const action = actionForKey(key);
      if (!action) continue;
      if (action.type === "digit") expr = appendDigit(expr, action.value);
      else if (action.type === "decimal") expr = appendDecimal(expr);
      else if (action.type === "operator") expr = appendOperator(expr, action.value);
      else if (action.type === "open") expr = appendOpenParen(expr);
      else if (action.type === "close") expr = appendCloseParen(expr);
      else if (action.type === "percent") expr = appendPercent(expr);
      else if (action.type === "backspace") expr = backspace(expr);
    }
    return expr;
  };
  const value = (keys: string[]) => {
    const r = evaluate(build(keys));
    return r.ok ? r.value : r.error;
  };

  it("matches what the user typed", () => {
    expect(value([..."12+34*2"])).toBe(80);
    expect(value([..."(1+2)*3"])).toBe(9);
    expect(value([..."2(3+4)"])).toBe(14);
    expect(value([..."200+10%"])).toBe(220);
    expect(value([..."5*-3"])).toBe(-15);
    expect(value([..."9/3-1"])).toBe(2);
    expect(value([..."1.5+1.5"])).toBe(3);
  });

  it("backspace removes the last key", () => {
    expect(build([..."123", "Backspace"])).toBe("12");
    expect(backspace("")).toBe("");
  });
});

describe("actionForKey", () => {
  it("maps keys", () => {
    expect(actionForKey("7")).toEqual({ type: "digit", value: "7" });
    expect(actionForKey("*")).toEqual({ type: "operator", value: "×" });
    expect(actionForKey("/")).toEqual({ type: "operator", value: "÷" });
    expect(actionForKey("Enter")).toEqual({ type: "equals" });
    expect(actionForKey("Escape")).toEqual({ type: "clear" });
    expect(actionForKey("a")).toBeNull();
    expect(actionForKey("Tab")).toBeNull();
  });
});
