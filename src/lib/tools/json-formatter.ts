/**
 * Strict RFC 8259 JSON parser used by the JSON Formatter.
 *
 * We deliberately do not use JSON.parse + JSON.stringify: that silently changes
 * data (e.g. 12345678901234567890 becomes 12345678901234567000) and error
 * messages differ per browser. This parser keeps number and string literals
 * exactly as written and reports a precise line/column for every error.
 */

export type JsonNode =
  | { type: "object"; entries: { key: string; rawKey: string; value: JsonNode }[] }
  | { type: "array"; items: JsonNode[] }
  | { type: "literal"; raw: string };

export interface JsonError {
  message: string;
  position: number;
  line: number;
  column: number;
}

export type JsonParseResult = { ok: true; value: JsonNode } | { ok: false; error: JsonError };

const MAX_DEPTH = 1000;
const WS = new Set([" ", "\t", "\n", "\r"]);

class JsonSyntaxError extends Error {
  constructor(
    message: string,
    public position: number,
  ) {
    super(message);
  }
}

export function locate(text: string, position: number): { line: number; column: number } {
  let line = 1;
  let lastBreak = -1;
  const end = Math.min(position, text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] === "\n") {
      line++;
      lastBreak = i;
    }
  }
  return { line, column: position - lastBreak };
}

function describe(char: string | undefined): string {
  if (char === undefined) return "end of input";
  return `"${char}"`;
}

export function parseJson(text: string): JsonParseResult {
  let i = 0;

  const skipWs = () => {
    while (i < text.length && WS.has(text[i]!)) i++;
  };

  const fail = (message: string, at = i): never => {
    throw new JsonSyntaxError(message, at);
  };

  const parseString = (): string => {
    const start = i;
    i++; // opening quote
    while (i < text.length) {
      const ch = text[i]!;
      if (ch === '"') {
        i++;
        return text.slice(start, i);
      }
      if (ch === "\\") {
        const next = text[i + 1];
        if (next === undefined) fail("Unterminated string", start);
        if (next === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
            fail("Invalid unicode escape (expected 4 hex digits)", i);
          }
          i += 6;
        } else if ('"\\/bfnrt'.includes(next!)) {
          i += 2;
        } else {
          fail(`Invalid escape sequence "\\${next}"`, i);
        }
        continue;
      }
      if (ch < " ") fail("Control characters must be escaped inside strings", i);
      i++;
    }
    return fail("Unterminated string", start);
  };

  const parseNumber = (): string => {
    const start = i;
    if (text[i] === "-") i++;
    if (text[i] === "0") {
      i++;
    } else if (text[i] !== undefined && text[i]! >= "1" && text[i]! <= "9") {
      while (text[i] !== undefined && text[i]! >= "0" && text[i]! <= "9") i++;
    } else {
      fail(`Invalid number: unexpected ${describe(text[i])}`, i);
    }
    if (text[i] === ".") {
      i++;
      if (!(text[i] !== undefined && text[i]! >= "0" && text[i]! <= "9")) {
        fail("Invalid number: expected a digit after the decimal point", i);
      }
      while (text[i] !== undefined && text[i]! >= "0" && text[i]! <= "9") i++;
    }
    if (text[i] === "e" || text[i] === "E") {
      i++;
      if (text[i] === "+" || text[i] === "-") i++;
      if (!(text[i] !== undefined && text[i]! >= "0" && text[i]! <= "9")) {
        fail("Invalid number: expected a digit in the exponent", i);
      }
      while (text[i] !== undefined && text[i]! >= "0" && text[i]! <= "9") i++;
    }
    return text.slice(start, i);
  };

  const parseValue = (depth: number): JsonNode => {
    if (depth > MAX_DEPTH) fail(`Nesting is deeper than ${MAX_DEPTH} levels`);
    skipWs();
    const ch = text[i];

    if (ch === "{") {
      i++;
      const entries: { key: string; rawKey: string; value: JsonNode }[] = [];
      skipWs();
      if (text[i] === "}") {
        i++;
        return { type: "object", entries };
      }
      for (;;) {
        skipWs();
        if (text[i] !== '"') {
          fail(
            text[i] === "}"
              ? "Trailing comma is not allowed in JSON"
              : `Expected a property name in double quotes but found ${describe(text[i])}`,
          );
        }
        const rawKey = parseString();
        skipWs();
        if (text[i] !== ":") fail(`Expected ":" after property name but found ${describe(text[i])}`);
        i++;
        const value = parseValue(depth + 1);
        entries.push({ key: JSON.parse(rawKey) as string, rawKey, value });
        skipWs();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          return { type: "object", entries };
        }
        fail(`Expected "," or "}" but found ${describe(text[i])}`);
      }
    }

    if (ch === "[") {
      i++;
      const items: JsonNode[] = [];
      skipWs();
      if (text[i] === "]") {
        i++;
        return { type: "array", items };
      }
      for (;;) {
        skipWs();
        if (text[i] === "]") fail("Trailing comma is not allowed in JSON");
        items.push(parseValue(depth + 1));
        skipWs();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return { type: "array", items };
        }
        fail(`Expected "," or "]" but found ${describe(text[i])}`);
      }
    }

    if (ch === '"') return { type: "literal", raw: parseString() };
    if (ch === "-" || (ch !== undefined && ch >= "0" && ch <= "9")) return { type: "literal", raw: parseNumber() };

    for (const word of ["true", "false", "null"]) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return { type: "literal", raw: word };
      }
    }

    if (ch === undefined) return fail("Unexpected end of input");
    if (ch === "'") return fail("Strings must use double quotes, not single quotes");
    return fail(`Unexpected character ${describe(ch)}`);
  };

  try {
    skipWs();
    if (i >= text.length) fail("Input is empty");
    const value = parseValue(0);
    skipWs();
    if (i < text.length) fail(`Unexpected ${describe(text[i])} after the end of the JSON value`);
    return { ok: true, value };
  } catch (e) {
    if (e instanceof JsonSyntaxError) {
      return { ok: false, error: { message: e.message, position: e.position, ...locate(text, e.position) } };
    }
    throw e;
  }
}

export type IndentOption = 2 | 4 | "tab";

export interface StringifyOptions {
  indent: IndentOption;
  sortKeys: boolean;
}

function sortedEntries(node: Extract<JsonNode, { type: "object" }>, sort: boolean) {
  if (!sort) return node.entries;
  // Plain code-unit order, the same ordering as Array.prototype.sort() defaults.
  return [...node.entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function stringifyNode(node: JsonNode, options: StringifyOptions | "minify"): string {
  const minify = options === "minify";
  const unit = minify ? "" : options.indent === "tab" ? "\t" : " ".repeat(options.indent);
  const sort = !minify && options.sortKeys;

  const walk = (n: JsonNode, level: number): string => {
    if (n.type === "literal") return n.raw;
    if (n.type === "array") {
      if (n.items.length === 0) return "[]";
      if (minify) return `[${n.items.map((item) => walk(item, 0)).join(",")}]`;
      const pad = unit.repeat(level + 1);
      return `[\n${n.items.map((item) => pad + walk(item, level + 1)).join(",\n")}\n${unit.repeat(level)}]`;
    }
    if (n.entries.length === 0) return "{}";
    const entries = sortedEntries(n, sort);
    if (minify) return `{${entries.map((e) => `${e.rawKey}:${walk(e.value, 0)}`).join(",")}}`;
    const pad = unit.repeat(level + 1);
    return `{\n${entries.map((e) => `${pad}${e.rawKey}: ${walk(e.value, level + 1)}`).join(",\n")}\n${unit.repeat(level)}}`;
  };

  return walk(node, 0);
}

export type JsonTransformResult = { ok: true; output: string } | { ok: false; error: JsonError };

export function formatJson(text: string, options: StringifyOptions): JsonTransformResult {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  return { ok: true, output: stringifyNode(parsed.value, options) };
}

export function minifyJson(text: string): JsonTransformResult {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  return { ok: true, output: stringifyNode(parsed.value, "minify") };
}

export interface JsonStats {
  depth: number;
  keys: number;
  values: number;
}

export function jsonStats(root: JsonNode): JsonStats {
  let maxDepth = 0;
  let keys = 0;
  let values = 0;
  const walk = (n: JsonNode, depth: number) => {
    maxDepth = Math.max(maxDepth, depth);
    values++;
    if (n.type === "object") {
      keys += n.entries.length;
      n.entries.forEach((e) => walk(e.value, depth + 1));
    } else if (n.type === "array") {
      n.items.forEach((item) => walk(item, depth + 1));
    }
  };
  walk(root, 1);
  return { depth: maxDepth, keys, values };
}
