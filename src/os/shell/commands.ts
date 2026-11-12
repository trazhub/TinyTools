import { HOME_ID, type FsNode } from "../filesystem/types";
import { OS_NAME, OS_TAGLINE, OS_VERSION } from "../version";
import { parseLine } from "./parse";
import type { Command, CommandResult, Line, ShellContext } from "./types";

// ---- small helpers ---------------------------------------------------------

const line = (text: string, tone?: Line[number]["tone"]): Line => [tone ? { text, tone } : { text }];
const textLines = (text: string, tone?: Line[number]["tone"]): Line[] => text.split("\n").map((t) => line(t, tone));

/** Show a path the way a prompt does: /home/user -> ~ */
export function displayPath(ctx: Pick<ShellContext, "fs" | "cwd">, id: string = ctx.cwd): string {
  const path = ctx.fs.pathOf(id);
  const home = ctx.fs.pathOf(HOME_ID);
  if (path === home) return "~";
  return path.startsWith(home + "/") ? "~" + path.slice(home.length) : path;
}

interface Flags {
  flags: Set<string>;
  rest: string[];
}

/** Separate `-abc` / `--long` options from operands. `--` ends option parsing. */
function splitFlags(args: string[]): Flags {
  const flags = new Set<string>();
  const rest: string[] = [];
  let literal = false;
  for (const arg of args) {
    if (literal || arg === "-" || !arg.startsWith("-")) rest.push(arg);
    else if (arg === "--") literal = true;
    else if (arg.startsWith("--")) flags.add(arg.slice(2));
    else for (const ch of arg.slice(1)) flags.add(ch);
  }
  return { flags, rest };
}

function checkFlags(name: string, flags: Set<string>, allowed: string): string | null {
  for (const f of flags) if (!allowed.split(" ").includes(f)) return `${name}: invalid option '${f.length > 1 ? "--" : "-"}${f}'. Try 'help ${name}'.`;
  return null;
}

/** Split "a/b/c.txt" into the folder part and the final name. */
function splitPath(path: string): [string, string] {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const i = trimmed.lastIndexOf("/");
  if (i === -1) return [".", trimmed];
  return [i === 0 ? "/" : trimmed.slice(0, i), trimmed.slice(i + 1)];
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}`;
  const units = ["K", "M", "G"];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}${units[u]}`;
}

const noEntry = (cmd: string, path: string) => `${cmd}: cannot access '${path}': No such file or directory`;

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length]![b.length]!;
}

// ---- commands ---------------------------------------------------------------

const commands: Command[] = [
  {
    name: "help",
    summary: "List commands, or show help for one",
    usage: "help [command]",
    run(args) {
      const target = args[0];
      if (target) {
        const cmd = commandMap.get(target);
        if (!cmd) return { errors: [`help: no such command '${target}'`] };
        return { lines: [line(cmd.usage, "accent"), line(cmd.summary)] };
      }
      const width = Math.max(...commands.map((c) => c.name.length)) + 2;
      return {
        lines: [
          line("TinyTools shell commands:", "accent"),
          ...commands.map((c) => [{ text: c.name.padEnd(width), tone: "success" as const }, { text: c.summary }]),
          line(""),
          line("Tab completes, ↑/↓ browse history, Ctrl+L clears. This is a simulated shell: it only works inside TinyTools OS.", "muted"),
        ],
      };
    },
  },
  {
    name: "clear",
    summary: "Clear the screen",
    usage: "clear",
    run: () => ({ clear: true }),
  },
  {
    name: "date",
    summary: "Show the current date",
    usage: "date",
    run: (_a, ctx) => ({ lines: [line(ctx.now().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }))] }),
  },
  {
    name: "time",
    summary: "Show the current time",
    usage: "time",
    run: (_a, ctx) => ({ lines: [line(ctx.now().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: !ctx.prefs.clock24h }))] }),
  },
  {
    name: "echo",
    summary: "Print text (use > or >> to write it to a file)",
    usage: "echo [text...]",
    run: (args) => ({ lines: [line(args.join(" "))] }),
  },
  {
    name: "whoami",
    summary: "Show the current user",
    usage: "whoami",
    run: () => ({ lines: [line("user")] }),
  },
  {
    name: "pwd",
    summary: "Print the current folder",
    usage: "pwd",
    run: (_a, ctx) => ({ lines: [line(ctx.fs.pathOf(ctx.cwd))] }),
  },
  {
    name: "cd",
    summary: "Change folder",
    usage: "cd [folder]",
    run(args, ctx) {
      if (args.length > 1) return { errors: ["cd: too many arguments"] };
      const target = args[0] ?? "~";
      const node = ctx.fs.resolve(target, ctx.cwd);
      if (!node) return { errors: [`cd: no such folder: ${target}`] };
      if (node.kind !== "dir") return { errors: [`cd: not a folder: ${target}`] };
      return { cwd: node.id };
    },
  },
  {
    name: "ls",
    summary: "List folder contents (-a hidden, -l details)",
    usage: "ls [-a] [-l] [path...]",
    run(args, ctx) {
      const { flags, rest } = splitFlags(args);
      const bad = checkFlags("ls", flags, "a l");
      if (bad) return { errors: [bad] };
      const targets = rest.length ? rest : ["."];
      const lines: Line[] = [];
      const errors: string[] = [];

      const describe = (n: FsNode): Line => {
        const name = { text: n.kind === "dir" ? `${n.name}/` : n.name, ...(n.kind === "dir" ? { tone: "dir" as const } : {}) };
        if (!flags.has("l")) return [name];
        const when = new Date(n.modifiedAt).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
        return [{ text: `${n.kind === "dir" ? "d" : "-"}  ${(n.kind === "dir" ? "-" : humanSize(n.size)).padStart(6)}  ${when}  `, tone: "muted" }, name];
      };

      targets.forEach((target, index) => {
        const node = ctx.fs.resolve(target, ctx.cwd);
        if (!node) {
          errors.push(noEntry("ls", target));
          return;
        }
        if (targets.length > 1 && node.kind === "dir") {
          if (index > 0) lines.push(line(""));
          lines.push(line(`${target}:`, "muted"));
        }
        if (node.kind === "file") {
          lines.push(describe(node));
          return;
        }
        const items = ctx.fs.list(node.id, { hidden: flags.has("a") });
        if (items.length === 0) return;
        if (flags.has("l")) {
          items.forEach((n) => lines.push(describe(n)));
        } else {
          const segs: Line = [];
          items.forEach((n, i) => {
            if (i > 0) segs.push({ text: "  " });
            segs.push(...describe(n));
          });
          lines.push(segs);
        }
      });
      return { lines, errors };
    },
  },
  {
    name: "mkdir",
    summary: "Create folders (-p creates parents too)",
    usage: "mkdir [-p] folder...",
    run(args, ctx) {
      const { flags, rest } = splitFlags(args);
      const bad = checkFlags("mkdir", flags, "p");
      if (bad) return { errors: [bad] };
      if (rest.length === 0) return { errors: ["mkdir: missing operand"] };
      const errors: string[] = [];
      for (const path of rest) {
        if (flags.has("p")) {
          const r = ctx.fs.mkdirp(path, ctx.cwd);
          if (!r.ok) errors.push(`mkdir: cannot create '${path}': ${r.error}`);
          continue;
        }
        const [dir, name] = splitPath(path);
        const parent = ctx.fs.resolve(dir, ctx.cwd);
        if (!parent) {
          errors.push(`mkdir: cannot create '${path}': No such file or directory (use -p to create parents)`);
          continue;
        }
        const r = ctx.fs.mkdir(parent.id, name);
        if (!r.ok) errors.push(`mkdir: cannot create '${path}': ${r.error}`);
      }
      return { errors };
    },
  },
  {
    name: "touch",
    summary: "Create empty files",
    usage: "touch file...",
    run(args, ctx) {
      if (args.length === 0) return { errors: ["touch: missing file operand"] };
      const errors: string[] = [];
      for (const path of args) {
        const existing = ctx.fs.resolve(path, ctx.cwd);
        if (existing) {
          if (existing.kind === "file" && typeof existing.data === "string") ctx.fs.writeText(existing.id, existing.data);
          continue;
        }
        const [dir, name] = splitPath(path);
        const parent = ctx.fs.resolve(dir, ctx.cwd);
        if (!parent) {
          errors.push(`touch: cannot touch '${path}': No such file or directory`);
          continue;
        }
        const r = ctx.fs.createFile(parent.id, name, "");
        if (!r.ok) errors.push(`touch: cannot touch '${path}': ${r.error}`);
      }
      return { errors };
    },
  },
  {
    name: "cat",
    summary: "Print the contents of text files",
    usage: "cat file...",
    run(args, ctx) {
      if (args.length === 0) return { errors: ["cat: missing file operand"] };
      const lines: Line[] = [];
      const errors: string[] = [];
      for (const path of args) {
        const node = ctx.fs.resolve(path, ctx.cwd);
        if (!node) {
          errors.push(noEntry("cat", path));
          continue;
        }
        if (node.kind === "dir") {
          errors.push(`cat: ${path}: Is a folder`);
          continue;
        }
        const text = ctx.fs.readText(node.id);
        if (!text.ok) {
          errors.push(`cat: ${path}: ${text.error.includes("binary") ? "Binary file (can't be shown as text)" : text.error}`);
          continue;
        }
        lines.push(...textLines(text.value.replace(/\n$/, "")));
      }
      return { lines, errors };
    },
  },
  {
    name: "tree",
    summary: "Show a folder as a tree (-L n limits depth)",
    usage: "tree [-L depth] [folder]",
    run(args, ctx) {
      let depth = Infinity;
      const operands: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-L") {
          const n = Number(args[++i]);
          if (!Number.isInteger(n) || n < 1) return { errors: ["tree: -L needs a whole number of at least 1"] };
          depth = n;
        } else operands.push(args[i]!);
      }
      if (operands.length > 1) return { errors: ["tree: too many arguments"] };
      const root = ctx.fs.resolve(operands[0] ?? ".", ctx.cwd);
      if (!root) return { errors: [noEntry("tree", operands[0] ?? ".")] };
      if (root.kind !== "dir") return { errors: [`tree: ${operands[0]}: not a folder`] };

      const lines: Line[] = [[{ text: operands[0] ?? ".", tone: "dir" }]];
      let dirs = 0;
      let files = 0;
      const LIMIT = 500;
      let truncated = false;
      const walk = (id: string, prefix: string, level: number) => {
        const items = ctx.fs.list(id);
        items.forEach((n, i) => {
          if (lines.length >= LIMIT) {
            truncated = true;
            return;
          }
          const last = i === items.length - 1;
          const isDir = n.kind === "dir";
          if (isDir) dirs++;
          else files++;
          lines.push([{ text: prefix + (last ? "└── " : "├── "), tone: "muted" }, { text: n.name + (isDir ? "/" : ""), ...(isDir ? { tone: "dir" as const } : {}) }]);
          if (isDir && level < depth) walk(n.id, prefix + (last ? "    " : "│   "), level + 1);
        });
      };
      walk(root.id, "", 1);
      if (truncated) lines.push(line(`… output truncated at ${LIMIT} lines`, "warn"));
      lines.push(line(""), line(`${dirs} ${dirs === 1 ? "folder" : "folders"}, ${files} ${files === 1 ? "file" : "files"}`, "muted"));
      return { lines };
    },
  },
  {
    name: "rm",
    summary: "Move files to the Trash (-r for folders)",
    usage: "rm [-r] [-f] path...",
    run(args, ctx) {
      const { flags, rest } = splitFlags(args);
      const bad = checkFlags("rm", flags, "r R f");
      if (bad) return { errors: [bad] };
      if (rest.length === 0) return { errors: ["rm: missing operand"] };
      const recursive = flags.has("r") || flags.has("R");
      const errors: string[] = [];
      let moved = 0;
      for (const path of rest) {
        const node = ctx.fs.resolve(path, ctx.cwd);
        if (!node) {
          if (!flags.has("f")) errors.push(`rm: cannot remove '${path}': No such file or directory`);
          continue;
        }
        if (node.kind === "dir" && !recursive) {
          errors.push(`rm: cannot remove '${path}': Is a folder (use -r)`);
          continue;
        }
        if (node.id === ctx.cwd || ctx.fs.isDescendant(ctx.cwd, node.id)) {
          errors.push(`rm: cannot remove '${path}': it contains the current folder`);
          continue;
        }
        const r = ctx.fs.trash(node.id);
        if (r.ok) moved++;
        else errors.push(`rm: cannot remove '${path}': ${r.error}`);
      }
      return { errors, lines: moved ? [line(`Moved ${moved} ${moved === 1 ? "item" : "items"} to the Trash. Restore from File Explorer.`, "muted")] : [] };
    },
  },
  {
    name: "mv",
    summary: "Move or rename files and folders",
    usage: "mv source... destination",
    run(args, ctx) {
      if (args.length < 2) return { errors: ["mv: needs a source and a destination"] };
      const sources = args.slice(0, -1);
      const destPath = args[args.length - 1]!;
      const dest = ctx.fs.resolve(destPath, ctx.cwd);
      const errors: string[] = [];

      if (dest?.kind === "dir") {
        for (const s of sources) {
          const node = ctx.fs.resolve(s, ctx.cwd);
          if (!node) errors.push(noEntry("mv", s));
          else {
            const r = ctx.fs.move(node.id, dest.id);
            if (!r.ok) errors.push(`mv: cannot move '${s}': ${r.error}`);
          }
        }
        return { errors };
      }
      if (sources.length > 1) return { errors: [`mv: target '${destPath}' is not a folder`] };

      const src = ctx.fs.resolve(sources[0]!, ctx.cwd);
      if (!src) return { errors: [noEntry("mv", sources[0]!)] };
      const [dir, name] = splitPath(destPath);
      const parent = ctx.fs.resolve(dir, ctx.cwd);
      if (!parent || parent.kind !== "dir") return { errors: [`mv: cannot move to '${destPath}': No such folder`] };
      if (dest) return { errors: [`mv: '${destPath}' already exists`] };

      const oldName = src.name;
      const oldParent = src.parentId!;
      if (name !== oldName) {
        const r = ctx.fs.rename(src.id, name);
        if (!r.ok) return { errors: [`mv: ${r.error}`] };
      }
      if (parent.id !== oldParent) {
        const r = ctx.fs.move(src.id, parent.id);
        if (!r.ok) {
          if (name !== oldName) ctx.fs.rename(src.id, oldName);
          return { errors: [`mv: ${r.error}`] };
        }
      }
      return {};
    },
  },
  {
    name: "cp",
    summary: "Copy files and folders (-r for folders)",
    usage: "cp [-r] source... destination",
    run(args, ctx) {
      const { flags, rest } = splitFlags(args);
      const bad = checkFlags("cp", flags, "r R");
      if (bad) return { errors: [bad] };
      if (rest.length < 2) return { errors: ["cp: needs a source and a destination"] };
      const recursive = flags.has("r") || flags.has("R");
      const sources = rest.slice(0, -1);
      const destPath = rest[rest.length - 1]!;
      const dest = ctx.fs.resolve(destPath, ctx.cwd);
      const errors: string[] = [];

      const copyInto = (srcPath: string, parentId: string, newName?: string) => {
        const node = ctx.fs.resolve(srcPath, ctx.cwd);
        if (!node) return errors.push(noEntry("cp", srcPath));
        if (node.kind === "dir" && !recursive) return errors.push(`cp: -r not specified; omitting folder '${srcPath}'`);
        const copy = ctx.fs.copy(node.id, parentId);
        if (!copy.ok) return errors.push(`cp: ${copy.error}`);
        if (newName && newName !== copy.value.name) {
          const r = ctx.fs.rename(copy.value.id, newName);
          if (!r.ok) {
            ctx.fs.deletePermanently(copy.value.id);
            errors.push(`cp: ${r.error}`);
          }
        }
      };

      if (dest?.kind === "dir") {
        sources.forEach((s) => copyInto(s, dest.id));
      } else {
        if (sources.length > 1) return { errors: [`cp: target '${destPath}' is not a folder`] };
        if (dest) return { errors: [`cp: '${destPath}' already exists`] };
        const [dir, name] = splitPath(destPath);
        const parent = ctx.fs.resolve(dir, ctx.cwd);
        if (!parent || parent.kind !== "dir") return { errors: [`cp: cannot copy to '${destPath}': No such folder`] };
        copyInto(sources[0]!, parent.id, name);
      }
      return { errors };
    },
  },
  {
    name: "open",
    summary: "Open an app, file or folder",
    usage: "open <app | file | folder>",
    run(args, ctx) {
      const target = args.join(" ");
      if (!target) return { errors: ["open: tell me what to open, e.g. 'open notes' or 'open Documents'. Try 'apps' for a list."] };
      const looksLikePath = /^([./~]|.*\/)/.test(target);
      const node = ctx.fs.resolve(target, ctx.cwd);
      if (node && (looksLikePath || !ctx.apps.some((a) => a.id === target.toLowerCase() || a.name.toLowerCase() === target.toLowerCase()))) {
        const r = ctx.openNode(node);
        return r.ok ? { lines: [line(`Opened ${node.name} in ${r.name}.`, "muted")] } : { errors: [`open: ${r.error}`] };
      }
      const r = ctx.openApp(target);
      return r.ok ? { lines: [line(`Opened ${r.name}.`, "muted")] } : { errors: [`open: ${r.error}`] };
    },
  },
  {
    name: "apps",
    summary: "List installed apps (apps running shows open windows)",
    usage: "apps [running]",
    run(args, ctx) {
      if (args[0] === "running") {
        const open = ctx.running();
        if (open.length === 0) return { lines: [line("No apps are open.", "muted")] };
        return { lines: open.map((w) => [{ text: w.appId.padEnd(18), tone: "success" }, { text: w.title }]) };
      }
      if (args.length) return { errors: ["apps: unknown argument. Try 'apps' or 'apps running'."] };
      const width = Math.max(...ctx.apps.map((a) => a.id.length)) + 2;
      return { lines: ctx.apps.map((a) => [{ text: a.id.padEnd(width), tone: "success" }, { text: a.description }]) };
    },
  },
  {
    name: "theme",
    summary: "Change the room: a theme name, lights on/off, sound on/off",
    usage: "theme [name] | theme list | theme lights on|off | theme sound on|off",
    run(args, ctx) {
      const [sub, value] = args;
      const { themes } = ctx.themeOptions;
      if (!sub) {
        return { lines: [line(`theme: ${ctx.prefs.theme}   lights: ${ctx.prefs.lightsOff ? "off" : "on"}   sound: ${ctx.prefs.sound ? "on" : "off"}`)] };
      }
      if (sub === "list") return { lines: [line(`themes: ${themes.join(", ")}`)] };
      if (sub === "lights" || sub === "sound") {
        if (value !== "on" && value !== "off") return { errors: [`theme: ${sub} needs 'on' or 'off'`] };
        ctx.setPrefs(sub === "lights" ? { lightsOff: value === "off" } : { sound: value === "on" });
        return { lines: [line(`${sub[0]!.toUpperCase()}${sub.slice(1)} ${value}.`, "muted")] };
      }
      if (themes.includes(sub)) {
        ctx.setPrefs({ theme: sub });
        return { lines: [line(`Room theme set to ${sub}.`, "muted")] };
      }
      return { errors: [`theme: unknown theme '${sub}'. Available: ${themes.join(", ")}`] };
    },
  },
  {
    name: "history",
    summary: "Show previous commands",
    usage: "history",
    run: (_a, ctx) => ({
      lines: ctx.history.length
        ? ctx.history.map((h, i) => [{ text: String(i + 1).padStart(4) + "  ", tone: "muted" }, { text: h }])
        : [line("No commands yet.", "muted")],
    }),
  },
  {
    name: "neofetch",
    summary: "Show system information",
    usage: "neofetch",
    run(_a, ctx) {
      const uptime = Math.max(0, Math.floor((ctx.now().getTime() - ctx.bootedAt) / 1000));
      const fmtUptime = uptime >= 3600 ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m` : uptime >= 60 ? `${Math.floor(uptime / 60)}m ${uptime % 60}s` : `${uptime}s`;
      const art = ["  ╭─────────╮ ", "  │  ▀█▀    │ ", "  │   █     │ ", "  │   █ OS  │ ", "  ╰─────────╯ ", "              "];
      const info: [string, string][] = [
        ["", "user@tinytools"],
        ["", "--------------"],
        ["OS", `${OS_NAME} ${OS_VERSION}`],
        ["Browser", ctx.system.browser],
        ["Platform", ctx.system.platform],
        ["Screen", ctx.system.screen],
        ["Window", ctx.system.viewport],
        ["Room", `${ctx.prefs.theme}${ctx.prefs.lightsOff ? " (lights off)" : ""}`],
        ["Shell", "tsh (simulated)"],
        ["Uptime", fmtUptime],
        ["Files", `${(ctx.fs.usage() / 1024).toFixed(1)} KB in virtual storage`],
        ["Network", ctx.system.online ? "online" : "offline"],
      ];
      return {
        lines: [
          ...info.map(([k, v], i): Line => [
            { text: art[i] ?? " ".repeat(14), tone: "accent" },
            ...(k ? [{ text: `${k}: `, tone: "accent" as const }] : []),
            { text: v, ...(k ? {} : { tone: "success" as const }) },
          ]),
        ],
      };
    },
  },
  {
    name: "about",
    summary: "About TinyTools OS",
    usage: "about",
    run: () => ({
      lines: [
        line(`${OS_NAME} ${OS_VERSION}`, "accent"),
        line(OS_TAGLINE),
        line(""),
        ...textLines(
          [
            "A free desktop that runs entirely in your browser.",
            "• Your files live in this browser's own storage (IndexedDB), not on a server.",
            "• This terminal is a simulation. It cannot run programs or touch your computer's real files.",
            "• No accounts, ads or analytics.",
          ].join("\n"),
        ),
      ],
    }),
  },
  {
    name: "exit",
    summary: "Close this terminal",
    usage: "exit",
    run: () => ({ exit: true }),
  },
];

const commandMap = new Map(commands.map((c) => [c.name, c]));

export const COMMAND_NAMES: readonly string[] = commands.map((c) => c.name);

export function suggestCommand(input: string): string | null {
  let best: { name: string; d: number } | null = null;
  for (const name of COMMAND_NAMES) {
    const d = levenshtein(input.toLowerCase(), name);
    if (d <= 2 && (!best || d < best.d)) best = { name, d };
  }
  return best?.name ?? null;
}

/** Write command output to a file for `>` / `>>`. */
function redirectOutput(ctx: ShellContext, mode: ">" | ">>", target: string, lines: Line[]): string | null {
  const text = lines.map((l) => l.map((s) => s.text).join("")).join("\n") + (lines.length ? "\n" : "");
  const existing = ctx.fs.resolve(target, ctx.cwd);
  if (existing) {
    if (existing.kind === "dir") return `${target}: Is a folder`;
    const current = ctx.fs.readText(existing.id);
    if (!current.ok) return `${target}: ${current.error}`;
    const r = ctx.fs.writeText(existing.id, (mode === ">>" ? current.value : "") + text);
    return r.ok ? null : `${target}: ${r.error}`;
  }
  const [dir, name] = splitPath(target);
  const parent = ctx.fs.resolve(dir, ctx.cwd);
  if (!parent || parent.kind !== "dir") return `${target}: No such file or folder`;
  const r = ctx.fs.createFile(parent.id, name, text);
  return r.ok ? null : `${target}: ${r.error}`;
}

/** Run one command line. Never throws: problems come back as red error lines. */
export function executeLine(input: string, ctx: ShellContext): CommandResult {
  const parsed = parseLine(input);
  if (!parsed.ok) return { errors: [`tsh: ${parsed.error}`] };
  const { argv, redirect } = parsed.value;
  if (argv.length === 0) return {};

  const [name, ...args] = argv as [string, ...string[]];
  const command = commandMap.get(name);
  if (!command) {
    const hint = suggestCommand(name);
    return { errors: [`tsh: command not found: ${name}.${hint ? ` Did you mean '${hint}'?` : ""} Type 'help' to see what's available.`] };
  }

  let result: CommandResult;
  try {
    result = command.run(args, ctx);
  } catch {
    return { errors: [`${name}: something went wrong while running that command.`] };
  }

  if (redirect && !result.clear) {
    const failure = redirectOutput(ctx, redirect.mode, redirect.target, result.lines ?? []);
    return { ...result, lines: [], errors: [...(result.errors ?? []), ...(failure ? [`tsh: ${failure}`] : [])] };
  }
  return result;
}
