import { COMMAND_NAMES } from "./commands";
import { escapeWord } from "./parse";
import type { ShellContext } from "./types";

export interface Completion {
  /** The full input line after completion (unchanged when nothing matched). */
  line: string;
  /** Possible matches to show when the choice is ambiguous. */
  suggestions: string[];
}

/** Find where the word being typed starts, honouring backslash escapes. */
function currentWordStart(input: string): number {
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "\\") i++;
    else if (/\s/.test(input[i]!)) start = i + 1;
  }
  return start;
}

function unescape(word: string): string {
  return word.replace(/\\(.)/g, "$1");
}

function commonPrefix(items: string[]): string {
  let prefix = items[0] ?? "";
  for (const item of items) {
    let i = 0;
    while (i < prefix.length && i < item.length && prefix[i]!.toLowerCase() === item[i]!.toLowerCase()) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix;
}

const DIRECTORIES_ONLY = new Set(["cd", "tree"]);

/** Tab completion for command names, app names (`open`), `theme` options and file paths. */
export function complete(input: string, ctx: ShellContext): Completion {
  const unchanged: Completion = { line: input, suggestions: [] };
  const start = currentWordStart(input);
  const before = input.slice(0, start);
  const word = input.slice(start);
  if (/^['"]/.test(word)) return unchanged;

  const previousWords = before.trim().split(/\s+/).filter(Boolean);
  const finish = (candidates: string[], isDir: (c: string) => boolean = () => false, prefixText = "", typed = word): Completion => {
    if (candidates.length === 0) return unchanged;
    if (candidates.length === 1) {
      const only = candidates[0]!;
      return { line: before + prefixText + escapeWord(only) + (isDir(only) ? "/" : " "), suggestions: [] };
    }
    const common = commonPrefix(candidates);
    const shared = common.length > unescape(typed.slice(prefixText.length)).length ? prefixText + escapeWord(common) : typed;
    return { line: before + shared, suggestions: candidates.map((c) => (isDir(c) ? `${c}/` : c)) };
  };

  // 1. The command itself.
  if (previousWords.length === 0) {
    const matches = COMMAND_NAMES.filter((n) => n.startsWith(word));
    return finish(matches);
  }

  const command = previousWords[0]!;
  const argIndex = previousWords.length - 1;

  // 2. Known words for specific commands.
  if (command === "theme" && argIndex === 0) {
    return finish([...ctx.themeOptions.themes, "list", "lights", "sound"].filter((n) => n.startsWith(word)));
  }
  if (command === "theme" && argIndex === 1 && (previousWords[1] === "lights" || previousWords[1] === "sound")) {
    return finish(["on", "off"].filter((n) => n.startsWith(word)));
  }
  if (command === "apps") return finish(["running"].filter((n) => n.startsWith(word)));
  if (command === "help") return finish(COMMAND_NAMES.filter((n) => n.startsWith(word)));
  if (command === "echo" || command === "history" || command === "clear") return unchanged;

  // 3. Paths (and app names for `open`).
  const actual = unescape(word);
  const slash = actual.lastIndexOf("/");
  const dirPart = slash === -1 ? "" : actual.slice(0, slash + 1);
  const namePrefix = actual.slice(slash + 1);
  const dir = ctx.fs.resolve(dirPart === "" ? "." : dirPart, ctx.cwd);

  const names = new Map<string, boolean>(); // candidate -> isDirectory
  // `open notes` launches the app even if a folder called Notes exists, so apps win for bare names.
  const appIds = new Set<string>();
  if (command === "open" && dirPart === "") {
    for (const app of ctx.apps) {
      if (app.id.startsWith(namePrefix.toLowerCase())) {
        names.set(app.id, false);
        appIds.add(app.id);
      }
    }
  }
  if (dir?.kind === "dir") {
    for (const n of ctx.fs.list(dir.id, { hidden: namePrefix.startsWith(".") })) {
      if (DIRECTORIES_ONLY.has(command) && n.kind !== "dir") continue;
      if (appIds.has(n.name.toLowerCase())) continue;
      if (n.name.toLowerCase().startsWith(namePrefix.toLowerCase())) names.set(n.name, n.kind === "dir");
    }
  }
  return finish([...names.keys()], (c) => names.get(c) === true, escapeWord(dirPart).replace(/\\\//g, "/"), word);
}
