import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryAdapter } from "../filesystem/adapters";
import { DOCUMENTS_ID, HOME_ID } from "../filesystem/types";
import { VirtualFileSystem } from "../filesystem/vfs";
import { DEFAULT_PREFS, type Prefs } from "../settings/prefs";
import { complete } from "./complete";
import { displayPath, executeLine, suggestCommand } from "./commands";
import { parseLine } from "./parse";
import type { CommandResult, Line, ShellContext } from "./types";

const flat = (lines: Line[] | undefined) => (lines ?? []).map((l) => l.map((s) => s.text).join(""));

interface Session {
  ctx: ShellContext;
  fs: VirtualFileSystem;
  run: (input: string) => CommandResult & { out: string[] };
  opened: string[];
}

async function session(): Promise<Session> {
  const fs = await VirtualFileSystem.open(createMemoryAdapter());
  let prefs: Prefs = { ...DEFAULT_PREFS };
  const opened: string[] = [];
  const ctx: ShellContext = {
    fs,
    cwd: HOME_ID,
    apps: [
      { id: "notes", name: "Notes", description: "Write notes" },
      { id: "explorer", name: "File Explorer", description: "Browse files" },
    ],
    running: () => [],
    openApp: (q) => {
      const hit = ["notes", "explorer"].includes(q.toLowerCase());
      if (hit) opened.push(`app:${q}`);
      return hit ? { ok: true, name: q } : { ok: false, error: `no app called '${q}'` };
    },
    openNode: (n) => {
      opened.push(`node:${n.name}`);
      return { ok: true, name: "File Explorer" };
    },
    get prefs() {
      return prefs;
    },
    setPrefs: (p) => {
      prefs = { ...prefs, ...p };
    },
    now: () => new Date("2026-10-17T10:20:30"),
    bootedAt: new Date("2026-10-17T10:00:00").getTime(),
    history: ["ls", "pwd"],
    system: { browser: "TestBrowser 1", platform: "TestOS", language: "en", screen: "1920×1080", viewport: "1000×700", online: true },
    themeOptions: { themes: ["midnight", "dusk"] },
  };
  const run = (input: string) => {
    const result = executeLine(input, ctx);
    if (result.cwd) ctx.cwd = result.cwd;
    return { ...result, out: flat(result.lines) };
  };
  return { ctx, fs, run, opened };
}

describe("parseLine", () => {
  const argv = (s: string) => {
    const r = parseLine(s);
    if (!r.ok) throw new Error(r.error);
    return r.value.argv;
  };

  it("splits words and honours quotes and escapes", () => {
    expect(argv("ls -la  Documents")).toEqual(["ls", "-la", "Documents"]);
    expect(argv(`echo "hello world" 'a b' c\\ d`)).toEqual(["echo", "hello world", "a b", "c d"]);
    expect(argv('echo ""')).toEqual(["echo", ""]);
    expect(argv("")).toEqual([]);
    expect(argv("   ")).toEqual([]);
  });

  it("parses > and >> redirects", () => {
    expect(parseLine("echo hi > a.txt")).toEqual({ ok: true, value: { argv: ["echo", "hi"], redirect: { mode: ">", target: "a.txt" } } });
    expect(parseLine("echo hi>>a.txt")).toEqual({ ok: true, value: { argv: ["echo", "hi"], redirect: { mode: ">>", target: "a.txt" } } });
    expect(parseLine('echo "a > b"')).toEqual({ ok: true, value: { argv: ["echo", "a > b"] } });
  });

  it("rejects shell features it does not implement, with an explanation", () => {
    for (const bad of ["ls | grep x", "a && b", "a; b", "cat < f", "echo `x`", "echo $HOME", "sleep 5 &"]) {
      const r = parseLine(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/aren't supported/);
    }
  });

  it("allows those characters when quoted", () => {
    expect(parseLine("echo '$HOME | x'")).toEqual({ ok: true, value: { argv: ["echo", "$HOME | x"] } });
  });

  it("reports malformed input", () => {
    expect(parseLine('echo "oops').ok).toBe(false);
    expect(parseLine("echo hi >").ok).toBe(false);
    expect(parseLine("> file").ok).toBe(false);
    expect(parseLine("echo a > b > c").ok).toBe(false);
    expect(parseLine("echo \\").ok).toBe(false);
  });
});

describe("executeLine: basics", () => {
  it("ignores empty input", async () => {
    const { run } = await session();
    expect(run("")).toMatchObject({ out: [] });
    expect(run("   ")).toMatchObject({ out: [] });
  });

  it("reports unknown commands, with a suggestion for typos", async () => {
    const { run } = await session();
    expect(run("foo").errors![0]).toMatch(/command not found: foo/);
    expect(run("lss").errors![0]).toMatch(/Did you mean 'ls'\?/);
    expect(suggestCommand("zzzzzzzz")).toBeNull();
  });

  it("echo, whoami, date and time", async () => {
    const { run } = await session();
    expect(run("echo hello   world").out).toEqual(["hello world"]);
    expect(run('echo "hello   world"').out).toEqual(["hello   world"]);
    expect(run("whoami").out).toEqual(["user"]);
    expect(run("date").out[0]).toMatch(/2026/);
    expect(run("time").out[0]).toMatch(/10:20:30|10:20:30/);
  });

  it("help lists every required command and explains individual ones", async () => {
    const { run } = await session();
    const text = run("help").out.join("\n");
    for (const c of ["help", "clear", "date", "time", "echo", "whoami", "ls", "pwd", "cd", "mkdir", "cat", "touch", "tree", "neofetch", "about", "apps", "open", "theme"]) {
      expect(text, c).toMatch(new RegExp(`^${c}\\s`, "m"));
    }
    expect(run("help ls").out[0]).toMatch(/ls \[-a\]/);
    expect(run("help nope").errors![0]).toMatch(/no such command/);
  });

  it("clear and exit are signalled to the terminal", async () => {
    const { run } = await session();
    expect(run("clear").clear).toBe(true);
    expect(run("exit").exit).toBe(true);
  });

  it("never throws on hostile input", async () => {
    const { run } = await session();
    for (const input of ["ls ../../../../../..", "cat /", "cd \u0000", "mkdir " + "a".repeat(500), "rm -rf /", "rm -r ~", "mv / /", "cp -r / /home", "echo hi > /", "open ''", "theme accent <script>", "__proto__", "constructor", "toString"]) {
      expect(() => run(input), input).not.toThrow();
    }
  });

  it("treats command names like __proto__ as unknown commands", async () => {
    const { run } = await session();
    expect(run("constructor").errors![0]).toMatch(/command not found/);
  });
});

describe("filesystem commands act on the real virtual filesystem", () => {
  let s: Session;
  beforeEach(async () => {
    s = await session();
  });

  it("pwd / cd / displayPath", () => {
    expect(s.run("pwd").out).toEqual(["/home/user"]);
    expect(displayPath(s.ctx)).toBe("~");
    s.run("cd Documents");
    expect(s.ctx.cwd).toBe(DOCUMENTS_ID);
    expect(displayPath(s.ctx)).toBe("~/Documents");
    s.run("cd ..");
    expect(s.ctx.cwd).toBe(HOME_ID);
    s.run("cd /");
    expect(s.run("pwd").out).toEqual(["/"]);
    s.run("cd");
    expect(s.ctx.cwd).toBe(HOME_ID);
    expect(s.run("cd nowhere").errors![0]).toMatch(/no such folder/);
    expect(s.run("cd Documents/About\\ this\\ computer.txt").errors![0]).toMatch(/not a folder/);
  });

  it("mkdir creates a folder that ls then shows", () => {
    expect(s.run("mkdir projects").errors).toEqual([]);
    expect(s.fs.resolve("/home/user/projects")?.kind).toBe("dir");
    expect(s.run("ls").out[0]).toContain("projects/");
    expect(s.run("mkdir projects").errors![0]).toMatch(/already exists/);
    expect(s.run("mkdir a/b/c").errors![0]).toMatch(/-p/);
    expect(s.run("mkdir -p a/b/c").errors).toEqual([]);
    expect(s.fs.resolve("/home/user/a/b/c")).toBeDefined();
    expect(s.run("mkdir").errors![0]).toMatch(/missing operand/);
    expect(s.run("mkdir bad/name/../x").errors!.length).toBeGreaterThan(0);
  });

  it("touch creates files; cat reads them", () => {
    s.run("touch notes.txt");
    expect(s.fs.resolve("notes.txt", HOME_ID)?.kind).toBe("file");
    s.run("echo hello > notes.txt");
    expect(s.run("cat notes.txt").out).toEqual(["hello"]);
    s.run("echo again >> notes.txt");
    expect(s.run("cat notes.txt").out).toEqual(["hello", "again"]);
    s.run("echo replaced > notes.txt");
    expect(s.run("cat notes.txt").out).toEqual(["replaced"]);
    expect(s.run("cat missing.txt").errors![0]).toMatch(/No such file/);
    expect(s.run("cat Documents").errors![0]).toMatch(/Is a folder/);
    expect(s.run("touch nodir/x.txt").errors![0]).toMatch(/No such file/);
  });

  it("cat refuses binary files", () => {
    s.fs.createFile(HOME_ID, "pic.png", new Blob([new Uint8Array([1])]), "image/png");
    expect(s.run("cat pic.png").errors![0]).toMatch(/Binary/);
  });

  it("redirects any command's output and keeps errors on screen", () => {
    s.run("ls Documents > listing.txt");
    expect(s.run("cat listing.txt").out.join("\n")).toContain("About this computer.txt");
    const bad = s.run("cat nope > out.txt");
    expect(bad.errors![0]).toMatch(/No such file/);
    expect(s.run("echo x > Documents").errors![0]).toMatch(/Is a folder/);
    expect(s.run("echo x > nodir/file").errors![0]).toMatch(/No such file or folder/);
  });

  it("ls handles flags, paths, files and missing paths", () => {
    expect(s.run("ls Documents").out).toEqual(["About this computer.txt"]);
    expect(s.run("ls -l Documents").out[0]).toMatch(/^-\s+\d+(\.\d)?[KMG]?\s+.*About this computer\.txt$/);
    expect(s.run("ls Documents/About\\ this\\ computer.txt").out).toEqual(["About this computer.txt"]);
    expect(s.run("ls /nope").errors![0]).toMatch(/No such file/);
    expect(s.run("ls -z").errors![0]).toMatch(/invalid option/);
    expect(s.run("ls Desktop Documents").out).toEqual(["Desktop:", "", "Documents:", "About this computer.txt"]);
    s.fs.createFile(HOME_ID, ".secret", "");
    expect(s.run("ls").out.join(" ")).not.toContain(".secret");
    expect(s.run("ls -a").out.join(" ")).toContain(".secret");
  });

  it("tree prints nested structure and counts", () => {
    s.run("mkdir -p proj/src");
    s.run("touch proj/src/main.ts proj/readme.md");
    const out = s.run("tree proj").out;
    expect(out).toEqual(["proj", "├── src/", "│   └── main.ts", "└── readme.md", "", "1 folder, 2 files"]);
    expect(s.run("tree -L 1 proj").out).toContain("├── src/");
    expect(s.run("tree -L 1 proj").out.join("\n")).not.toContain("main.ts");
    expect(s.run("tree -L x").errors![0]).toMatch(/whole number/);
    expect(s.run("tree nowhere").errors![0]).toMatch(/No such file/);
  });

  it("rm moves to the trash (recoverable) and demands -r for folders", () => {
    s.run("touch a.txt");
    s.run("mkdir d");
    expect(s.run("rm a.txt").out[0]).toMatch(/Moved 1 item to the Trash/);
    expect(s.fs.resolve("a.txt", HOME_ID)).toBeUndefined();
    expect(s.fs.trashCount()).toBe(1);
    expect(s.run("rm d").errors![0]).toMatch(/Is a folder/);
    expect(s.run("rm -r d").errors).toEqual([]);
    expect(s.run("rm nope").errors![0]).toMatch(/No such file/);
    expect(s.run("rm -f nope").errors).toEqual([]);
    expect(s.run("rm -r /home").errors![0]).toMatch(/current folder/);
    expect(s.run("rm -r Documents").errors![0]).toMatch(/built-in/);
  });

  it("mv renames and moves", () => {
    s.run("touch a.txt");
    s.run("mv a.txt b.txt");
    expect(s.fs.resolve("b.txt", HOME_ID)).toBeDefined();
    s.run("mv b.txt Documents");
    expect(s.fs.resolve("Documents/b.txt", HOME_ID)).toBeDefined();
    s.run("mv Documents/b.txt Desktop/c.txt");
    expect(s.fs.resolve("Desktop/c.txt", HOME_ID)).toBeDefined();
    expect(s.fs.resolve("Documents/b.txt", HOME_ID)).toBeUndefined();
    expect(s.run("mv").errors![0]).toMatch(/needs a source/);
    expect(s.run("mv nope x").errors![0]).toMatch(/No such file/);
  });

  it("mv rolls back a rename when the move fails", () => {
    s.run("touch a.txt");
    s.run("touch Documents/z.txt");
    s.run("touch Documents/dupe.txt");
    // moving a.txt -> Documents/dupe.txt clashes
    expect(s.run("mv a.txt Documents/dupe.txt").errors![0]).toMatch(/already exists/);
    expect(s.fs.resolve("a.txt", HOME_ID)).toBeDefined();
  });

  it("cp copies files and folders", () => {
    s.run("mkdir src");
    s.run("echo hi > src/f.txt");
    expect(s.run("cp src dst").errors![0]).toMatch(/-r/);
    expect(s.run("cp -r src dst").errors).toEqual([]);
    expect(s.run("cat dst/f.txt").out).toEqual(["hi"]);
    s.run("cp src/f.txt Documents");
    expect(s.run("cat Documents/f.txt").out).toEqual(["hi"]);
    expect(s.run("cp nope x").errors![0]).toMatch(/No such file/);
  });
});

describe("app and system commands", () => {
  it("open launches apps and files", async () => {
    const { run, opened } = await session();
    expect(run("open notes").out[0]).toMatch(/Opened notes/);
    expect(run("open Documents").out[0]).toMatch(/Opened Documents/);
    expect(run("open Documents/About\\ this\\ computer.txt").errors).toBeUndefined();
    expect(opened).toEqual(["app:notes", "node:Documents", "node:About this computer.txt"]);
    expect(run("open nothing-here").errors![0]).toMatch(/no app called/);
    expect(run("open").errors![0]).toMatch(/tell me what to open/);
  });

  it("apps lists registered apps", async () => {
    const { run } = await session();
    expect(run("apps").out.join("\n")).toMatch(/notes\s+Write notes/);
    expect(run("apps running").out).toEqual(["No apps are open."]);
    expect(run("apps bogus").errors![0]).toMatch(/unknown argument/);
  });

  it("theme changes real preferences", async () => {
    const { run, ctx } = await session();
    expect(run("theme").out[0]).toMatch(/theme: midnight\s+lights: on\s+sound: on/);
    run("theme dusk");
    expect(ctx.prefs.theme).toBe("dusk");
    run("theme lights off");
    expect(ctx.prefs.lightsOff).toBe(true);
    run("theme lights on");
    expect(ctx.prefs.lightsOff).toBe(false);
    run("theme sound off");
    expect(ctx.prefs.sound).toBe(false);
    expect(run("theme purple").errors![0]).toMatch(/unknown theme 'purple'. Available: midnight, dusk/);
    expect(run("theme lights maybe").errors![0]).toMatch(/needs 'on' or 'off'/);
    expect(run("theme list").out.join("\n")).toMatch(/themes: midnight, dusk/);
  });

  it("neofetch reports only what the browser exposes", async () => {
    const { run } = await session();
    const text = run("neofetch").out.join("\n");
    expect(text).toContain("TestBrowser 1");
    expect(text).toContain("1920×1080");
    expect(text).toContain("tsh (simulated)");
    expect(text).toContain("20m"); // uptime derived from bootedAt
    expect(text).not.toMatch(/CPU|RAM|GPU|Temperature/i);
  });

  it("history and about", async () => {
    const { run } = await session();
    expect(run("history").out).toEqual(["   1  ls", "   2  pwd"]);
    expect(run("about").out.join("\n")).toMatch(/simulation/);
  });
});

describe("tab completion", () => {
  let s: Session;
  beforeEach(async () => {
    s = await session();
    s.run("mkdir Projects Pictures-old");
    s.run("touch Documents/report.txt Documents/readme.md");
    s.run("touch 'My File.txt'");
  });

  it("completes command names", () => {
    expect(complete("mkd", s.ctx).line).toBe("mkdir ");
    expect(complete("t", s.ctx).suggestions.sort()).toEqual(["theme", "time", "touch", "tree"]);
    expect(complete("zzz", s.ctx).line).toBe("zzz");
  });

  it("completes paths, adding / after folders", () => {
    expect(complete("cd Doc", s.ctx).line).toBe("cd Documents/");
    expect(complete("cat Documents/rep", s.ctx).line).toBe("cat Documents/report.txt ");
    expect(complete("ls ~/Doc", s.ctx).line).toBe("ls ~/Documents/");
  });

  it("extends to the shared prefix and lists the options when ambiguous", () => {
    const r = complete("cat Documents/re", s.ctx);
    expect(r.suggestions.sort()).toEqual(["readme.md", "report.txt"]);
    expect(r.line).toBe("cat Documents/re");
    expect(complete("cd P", s.ctx).suggestions.sort()).toEqual(["Pictures-old/", "Pictures/", "Projects/"].sort());
    expect(complete("cd Pic", s.ctx).line).toBe("cd Pictures");
  });

  it("escapes spaces in completed names", () => {
    expect(complete("cat My", s.ctx).line).toBe("cat My\\ File.txt ");
  });

  it("only offers folders for cd", () => {
    expect(complete("cd My", s.ctx).suggestions).toEqual([]);
  });

  it("completes app names for open, and theme options", () => {
    expect(complete("open not", s.ctx).line).toBe("open notes ");
    expect(complete("theme lis", s.ctx).line).toBe("theme list ");
    expect(complete("theme lights o", s.ctx).suggestions.sort()).toEqual(["off", "on"]);
    expect(complete("theme du", s.ctx).line).toBe("theme dusk ");
    expect(complete("help ls", s.ctx).line).toBe("help ls ");
  });
});

describe("safety", () => {
  it("never evaluates user input", async () => {
    const evalSpy = vi.spyOn(globalThis, "eval");
    const { run } = await session();
    run("echo alert(1)");
    run("open (function(){})()");
    run("theme ${1+1}");
    expect(evalSpy).not.toHaveBeenCalled();
    evalSpy.mockRestore();
  });
});
