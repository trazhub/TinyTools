import { MAX_NAME_LENGTH, fail, ok, type Result } from "./types";

/** Validate and normalise a user-typed file or folder name. */
export function validateName(input: string): Result<string> {
  const name = input.trim();
  if (name === "") return fail("A name is required.");
  if (name.length > MAX_NAME_LENGTH) return fail(`Names can be at most ${MAX_NAME_LENGTH} characters.`);
  if (name === "." || name === "..") return fail(`"${name}" is not a valid name.`);
  if (/[\/\\\u0000-\u001f\u007f]/.test(name)) return fail('Names cannot contain "/", "\\" or control characters.');
  return ok(name);
}

/** "report.txt" -> ["report", ".txt"]; dotfiles and extension-less names keep an empty extension. */
export function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1 || name.length - dot > 12) return [name, ""];
  return [name.slice(0, dot), name.slice(dot)];
}

/** Return `name`, or "name (2).ext", "name (3).ext"... until `taken` says it is free. */
export function dedupeName(name: string, taken: (candidate: string) => boolean): string {
  if (!taken(name)) return name;
  const [base, ext] = splitExtension(name);
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!taken(candidate)) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}

const collator = typeof Intl !== "undefined" ? new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }) : null;

/** Natural, case-insensitive ordering ("file2" before "file10"). */
export function compareNames(a: string, b: string): number {
  return collator ? collator.compare(a, b) : a.localeCompare(b);
}
