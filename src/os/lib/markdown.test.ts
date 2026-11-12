import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref, type Block, type Inline } from "./markdown";

const plain = (inl: Inline[]): string =>
  inl.map((n) => (n.type === "text" || n.type === "code" ? n.text : plain(n.children))).join("");

describe("safeHref", () => {
  it("allows http, https and mailto", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHref("http://example.com")).toBe("http://example.com/");
    expect(safeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
  });

  it("blocks scripts, data URLs, relative and malformed links", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "data:text/html,<script>", "vbscript:x", "file:///etc/passwd", "//evil.com", "/relative", "java\nscript:alert(1)", "https://exa mple.com", ""]) {
      expect(safeHref(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("inline", () => {
  it("parses emphasis, code and strikethrough", () => {
    expect(parseInline("a **b** *c* `d` ~~e~~")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "code", text: "d" },
      { type: "text", text: " " },
      { type: "del", children: [{ type: "text", text: "e" }] },
    ]);
  });

  it("leaves unmatched markers as text", () => {
    expect(plain(parseInline("2 * 3 = 6 and **unclosed"))).toBe("2 * 3 = 6 and **unclosed");
    expect(plain(parseInline("snake_case_name"))).toBe("snake_case_name");
  });

  it("does not parse markdown inside code spans", () => {
    expect(parseInline("`**x**`")).toEqual([{ type: "code", text: "**x**" }]);
  });

  it("creates links only for safe URLs", () => {
    expect(parseInline("[hi](https://a.com)")).toEqual([{ type: "link", href: "https://a.com/", children: [{ type: "text", text: "hi" }] }]);
    expect(parseInline("[x](javascript:alert(1))").some((n) => n.type === "link")).toBe(false);
    expect(plain(parseInline("[x](javascript:alert(1))"))).toBe("[x](javascript:alert(1))");
  });

  it("honours backslash escapes", () => {
    expect(plain(parseInline("\\*not em\\*"))).toBe("*not em*");
  });

  it("keeps raw HTML as literal text", () => {
    const nodes = parseInline('<img src=x onerror="alert(1)"><script>alert(1)</script>');
    expect(nodes).toEqual([{ type: "text", text: '<img src=x onerror="alert(1)"><script>alert(1)</script>' }]);
  });

  it("survives pathological nesting", () => {
    const nasty = "**".repeat(200) + "x" + "**".repeat(200);
    expect(() => parseInline(nasty)).not.toThrow();
    expect(() => parseInline("[".repeat(5000))).not.toThrow();
  });
});

describe("blocks", () => {
  const kinds = (blocks: Block[]) => blocks.map((b) => b.type);

  it("parses headings with levels", () => {
    const [h1, h3] = parseMarkdown("# Title\n\n### Sub ###");
    expect(h1).toMatchObject({ type: "heading", level: 1 });
    expect(h3).toMatchObject({ type: "heading", level: 3 });
    expect(plain((h3 as Extract<Block, { type: "heading" }>).children)).toBe("Sub");
  });

  it("joins wrapped lines into one paragraph and splits on blank lines", () => {
    const blocks = parseMarkdown("one\ntwo\n\nthree");
    expect(kinds(blocks)).toEqual(["paragraph", "paragraph"]);
    expect(plain((blocks[0] as Extract<Block, { type: "paragraph" }>).children)).toBe("one two");
  });

  it("parses bullet, numbered and task lists", () => {
    const [ul, ol, tasks] = parseMarkdown("- a\n- b\n\n1. x\n2. y\n\n- [x] done\n- [ ] todo") as Extract<Block, { type: "list" }>[];
    expect(ul).toMatchObject({ ordered: false });
    expect(ul!.items).toHaveLength(2);
    expect(ol).toMatchObject({ ordered: true });
    expect(tasks!.items.map((i) => i.checked)).toEqual([true, false]);
  });

  it("parses fenced code blocks without interpreting their content", () => {
    const [code] = parseMarkdown("```js\nconst a = '**b**';\n# not a heading\n```");
    expect(code).toEqual({ type: "code", lang: "js", text: "const a = '**b**';\n# not a heading" });
  });

  it("handles an unclosed fence", () => {
    expect(parseMarkdown("```\nabc")[0]).toMatchObject({ type: "code", text: "abc" });
  });

  it("parses quotes and rules", () => {
    const blocks = parseMarkdown("> quoted *text*\n\n---");
    expect(kinds(blocks)).toEqual(["quote", "rule"]);
  });

  it("copes with Windows line endings and empty input", () => {
    expect(kinds(parseMarkdown("# a\r\n\r\ntext"))).toEqual(["heading", "paragraph"]);
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("\n\n  \n")).toEqual([]);
  });

  it("handles deeply nested quotes and huge input", () => {
    expect(() => parseMarkdown(">".repeat(100) + " x")).not.toThrow();
    const big = Array.from({ length: 20000 }, (_, i) => `- item ${i} **bold**`).join("\n");
    const start = performance.now();
    parseMarkdown(big);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
