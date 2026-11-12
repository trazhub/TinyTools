/**
 * A small arithmetic expression evaluator (recursive descent). It reads numbers
 * and operators only: user input is never passed to eval or Function.
 *
 * Grammar (lowest to highest precedence):
 *   expression := term (('+' | '-') term)*
 *   term       := unary (('×' | '÷' | '*' | '/' | implicit) unary)*
 *   unary      := '-' unary | power
 *   power      := postfix ('^' unary)?          (right associative, so 2^3^2 = 2^9)
 *   postfix    := primary '%'*
 *   primary    := number | '(' expression ')'
 *
 * Percent follows the pocket-calculator convention: `200 + 10%` is 220, while
 * `50%` on its own is 0.5 and `200 × 10%` is 20.
 */

export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

type Token = { type: "num"; value: number } | { type: "op"; value: string };

class CalcError extends Error {}

const OPERATORS = new Set(["+", "-", "×", "÷", "^", "%", "(", ")"]);
const ALIASES: Record<string, string> = { "*": "×", "/": "÷", "−": "-", "–": "-", x: "×", X: "×" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      let dots = 0;
      while (j < input.length && /[0-9.]/.test(input[j]!)) {
        if (input[j] === ".") dots++;
        j++;
      }
      const text = input.slice(i, j);
      if (dots > 1 || text === ".") throw new CalcError(`"${text}" is not a valid number`);
      tokens.push({ type: "num", value: Number(text) });
      i = j;
      continue;
    }
    const op = ALIASES[ch] ?? ch;
    if (OPERATORS.has(op)) {
      tokens.push({ type: "op", value: op });
      i++;
      continue;
    }
    throw new CalcError(`Unexpected "${ch}"`);
  }
  return tokens;
}

interface Value {
  value: number;
  /** Set when the term is a bare percentage, e.g. `10%` -> 0.1. */
  percent?: number;
}

export function evaluate(input: string): CalcResult {
  try {
    const tokens = tokenize(input);
    if (tokens.length === 0) return { ok: false, error: "Enter an expression" };
    let pos = 0;

    const peek = () => tokens[pos];
    const isOp = (t: Token | undefined, ...ops: string[]): t is { type: "op"; value: string } => t?.type === "op" && ops.includes(t.value);

    const expression = (): Value => {
      let left = term();
      while (isOp(peek(), "+", "-")) {
        const op = (tokens[pos++] as { value: string }).value;
        const right = term();
        const rhs = right.percent !== undefined ? left.value * right.percent : right.value;
        left = { value: op === "+" ? left.value + rhs : left.value - rhs };
      }
      return left;
    };

    const term = (): Value => {
      let left = unary();
      for (;;) {
        const next = peek();
        if (isOp(next, "×", "÷")) {
          pos++;
          const right = unary();
          if (next.value === "÷" && right.value === 0) throw new CalcError("Cannot divide by zero");
          left = { value: next.value === "×" ? left.value * right.value : left.value / right.value };
        } else if (next?.type === "num" || isOp(next, "(")) {
          // Implicit multiplication: 2(3) and (1+2)(3+4)
          left = { value: left.value * unary().value };
        } else {
          return left;
        }
      }
    };

    const unary = (): Value => {
      if (isOp(peek(), "-")) {
        pos++;
        const v = unary();
        return { value: -v.value, ...(v.percent !== undefined ? { percent: -v.percent } : {}) };
      }
      if (isOp(peek(), "+")) {
        pos++;
        return unary();
      }
      return power();
    };

    const power = (): Value => {
      const base = postfix();
      if (isOp(peek(), "^")) {
        pos++;
        return { value: Math.pow(base.value, unary().value) };
      }
      return base;
    };

    const postfix = (): Value => {
      let v = primary();
      while (isOp(peek(), "%")) {
        pos++;
        v = { value: v.value / 100, percent: v.value / 100 };
      }
      return v;
    };

    const primary = (): Value => {
      const t = tokens[pos];
      if (!t) throw new CalcError("The expression is incomplete");
      if (t.type === "num") {
        pos++;
        return { value: t.value };
      }
      if (t.value === "(") {
        pos++;
        const inner = expression();
        if (!isOp(peek(), ")")) throw new CalcError("Missing closing parenthesis");
        pos++;
        return { value: inner.value };
      }
      if (t.value === ")") throw new CalcError("Unexpected closing parenthesis");
      throw new CalcError(`"${t.value}" needs a number before it`);
    };

    const result = expression();
    if (pos < tokens.length) {
      const extra = tokens[pos]!;
      throw new CalcError(extra.type === "op" && extra.value === ")" ? "Unexpected closing parenthesis" : "The expression is not valid");
    }
    if (Number.isNaN(result.value)) return { ok: false, error: "Not a real number" };
    if (!Number.isFinite(result.value)) return { ok: false, error: "The result is too large" };
    return { ok: true, value: result.value };
  } catch (e) {
    if (e instanceof CalcError) return { ok: false, error: e.message };
    return { ok: false, error: "Could not calculate that" };
  }
}

/** Round away binary floating-point noise (0.1 + 0.2 -> 0.3) and format for display. */
export function formatResult(value: number): string {
  if (Object.is(value, -0)) return "0";
  const rounded = Number(value.toPrecision(12));
  const abs = Math.abs(rounded);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return rounded.toExponential().replace("e+", "e");
  return String(rounded);
}
