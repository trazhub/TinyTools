export interface ParsedLine {
  argv: string[];
  redirect?: { mode: ">" | ">>"; target: string };
}

export type ParseResult = { ok: true; value: ParsedLine } | { ok: false; error: string };

const UNSUPPORTED: Record<string, string> = {
  "|": "pipes",
  "&": "background jobs and '&&'",
  ";": "command chaining with ';'",
  "<": "input redirection",
  "`": "command substitution",
  $: "variables and substitution",
};

/**
 * Split a command line into words. This is a deliberately tiny grammar:
 * quotes ('...' and "..."), backslash escapes, and a single trailing `>` or `>>`
 * redirect. Everything else a real shell would interpret is rejected, so user
 * input is only ever treated as data and never executed.
 */
export function parseLine(line: string): ParseResult {
  const argv: string[] = [];
  let word = "";
  let inWord = false;
  let quote: "'" | '"' | null = null;
  let redirect: ParsedLine["redirect"];
  let awaitingTarget = false;

  const endWord = () => {
    if (!inWord) return;
    if (awaitingTarget) {
      redirect = { ...redirect!, target: word };
      awaitingTarget = false;
    } else {
      argv.push(word);
    }
    word = "";
    inWord = false;
  };

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;

    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && (line[i + 1] === '"' || line[i + 1] === "\\")) word += line[++i];
      else word += ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
      continue;
    }
    if (ch === "\\") {
      if (i + 1 >= line.length) return { ok: false, error: "A trailing backslash has nothing to escape." };
      word += line[++i];
      inWord = true;
      continue;
    }
    if (ch === " " || ch === "\t") {
      endWord();
      continue;
    }
    if (ch === ">") {
      endWord();
      if (redirect) return { ok: false, error: "Only one redirect (> or >>) is allowed per command." };
      const append = line[i + 1] === ">";
      if (append) i++;
      redirect = { mode: append ? ">>" : ">", target: "" };
      awaitingTarget = true;
      continue;
    }
    if (ch in UNSUPPORTED) {
      return {
        ok: false,
        error: `${UNSUPPORTED[ch]} aren't supported. This shell runs one simple command at a time. Wrap the character in quotes to use it literally.`,
      };
    }
    word += ch;
    inWord = true;
  }

  if (quote) return { ok: false, error: `Unterminated ${quote === '"' ? "double" : "single"} quote.` };
  endWord();
  if (awaitingTarget) return { ok: false, error: "Redirect needs a file name, e.g. echo hi > note.txt" };
  if (redirect && argv.length === 0) return { ok: false, error: "Nothing to redirect." };

  return { ok: true, value: { argv, ...(redirect ? { redirect } : {}) } };
}

/** Escape a name so it can be pasted back into a command line. */
export function escapeWord(name: string): string {
  return /[\s'"\\>|&;<`$]/.test(name) ? name.replace(/([\s'"\\>|&;<`$])/g, "\\$1") : name;
}
