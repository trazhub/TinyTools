/**
 * Editing rules for the calculator's expression string. Keeping them as pure
 * functions makes the keypad and the keyboard behave identically (and testable).
 */

const OPERATORS = "+-×÷^";
const isOperator = (ch: string | undefined) => ch !== undefined && OPERATORS.includes(ch);

export function appendDigit(expr: string, digit: string): string {
  // Avoid "5(" + "3" ambiguity: a digit after ")" or "%" means multiplication.
  const last = expr.slice(-1);
  return last === ")" || last === "%" ? `${expr}×${digit}` : expr + digit;
}

export function appendDecimal(expr: string): string {
  const current = /[0-9.]*$/.exec(expr)?.[0] ?? "";
  if (current.includes(".")) return expr;
  const last = expr.slice(-1);
  if (last === ")" || last === "%") return `${expr}×0.`;
  return current === "" ? `${expr}0.` : `${expr}.`;
}

export function appendOperator(expr: string, op: string): string {
  if (expr === "") return op === "-" ? "-" : "";
  const last = expr.slice(-1);
  if (last === "(") return op === "-" ? expr + "-" : expr;
  if (isOperator(last)) {
    // Allow a sign after × ÷ ^ ("5×-3"), otherwise replace the operator.
    if (op === "-" && "×÷^".includes(last)) return expr + "-";
    const prev = expr.slice(-2, -1);
    const base = isOperator(prev) || prev === "" || prev === "(" ? expr.slice(0, -2) : expr.slice(0, -1);
    return base === "" && op !== "-" ? "" : base + op;
  }
  return expr + op;
}

export function appendOpenParen(expr: string): string {
  const last = expr.slice(-1);
  return /[0-9.)%]/.test(last) ? `${expr}×(` : `${expr}(`;
}

export function appendCloseParen(expr: string): string {
  const open = (expr.match(/\(/g) ?? []).length;
  const close = (expr.match(/\)/g) ?? []).length;
  const last = expr.slice(-1);
  if (open <= close || isOperator(last) || last === "(" || last === "") return expr;
  return expr + ")";
}

export function appendPercent(expr: string): string {
  return /[0-9)%]$/.test(expr) ? expr + "%" : expr;
}

/** Flip the sign of the number at the end of the expression. */
export function toggleSign(expr: string): string {
  const wrapped = /\(-([0-9]*\.?[0-9]+)\)$/.exec(expr);
  if (wrapped) return expr.slice(0, wrapped.index) + wrapped[1];
  const num = /([0-9]*\.?[0-9]+)$/.exec(expr);
  if (num) {
    const before = expr.slice(0, num.index);
    // A leading "-" at the very start is just "−number": remove it directly.
    if (before === "-") return num[1]!;
    return `${before}(-${num[1]})`;
  }
  return expr === "" ? "-" : expr;
}

export function backspace(expr: string): string {
  return expr.slice(0, -1);
}

/** Map a keyboard key to a keypad action, or null if the key isn't a calculator key. */
export type KeyAction =
  | { type: "digit"; value: string }
  | { type: "decimal" }
  | { type: "operator"; value: string }
  | { type: "open" }
  | { type: "close" }
  | { type: "percent" }
  | { type: "equals" }
  | { type: "backspace" }
  | { type: "clear" };

export function actionForKey(key: string): KeyAction | null {
  if (/^[0-9]$/.test(key)) return { type: "digit", value: key };
  switch (key) {
    case ".":
    case ",":
      return { type: "decimal" };
    case "+":
      return { type: "operator", value: "+" };
    case "-":
      return { type: "operator", value: "-" };
    case "*":
    case "x":
    case "X":
      return { type: "operator", value: "×" };
    case "/":
      return { type: "operator", value: "÷" };
    case "^":
      return { type: "operator", value: "^" };
    case "(":
      return { type: "open" };
    case ")":
      return { type: "close" };
    case "%":
      return { type: "percent" };
    case "Enter":
    case "=":
      return { type: "equals" };
    case "Backspace":
      return { type: "backspace" };
    case "Delete":
    case "Escape":
    case "c":
    case "C":
      return { type: "clear" };
    default:
      return null;
  }
}
