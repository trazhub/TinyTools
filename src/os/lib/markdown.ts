/**
 * A small Markdown parser that produces a data structure, never an HTML string.
 * The React renderer turns this into elements, so user text can only ever become
 * text nodes: there is no path for script injection.
 *
 * Supported: headings, paragraphs, **bold**, *italic*, `code`, ~~strike~~,
 * links (http, https, mailto only), bullet/numbered/task lists, blockquotes,
 * fenced code blocks and horizontal rules. Raw HTML is shown as plain text.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "del"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export interface ListItem {
  checked?: boolean;
  children: Inline[];
}

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "quote"; children: Block[] }
  | { type: "code"; lang: string; text: string }
  | { type: "rule" };

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Only absolute http(s) and mailto links are allowed; everything else (javascript:, data:, ...) renders as text. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href || /[\u0000-\u001f\u007f\s]/.test(href)) return null;
  try {
    const url = new URL(href);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function parseInline(src: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;

    if (ch === "\\" && i + 1 < src.length && /[\\`*_~\[\]()#>!-]/.test(src[i + 1]!)) {
      buffer += src[i + 1];
      i += 2;
      continue;
    }

    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: "code", text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (depth < 4) {
      const pair = (marker: string, type: "strong" | "em" | "del") => {
        if (!src.startsWith(marker, i)) return false;
        const end = src.indexOf(marker, i + marker.length);
        if (end <= i + marker.length) return false;
        const inner = src.slice(i + marker.length, end);
        if (/^\s|\s$/.test(inner)) return false;
        flush();
        out.push({ type, children: parseInline(inner, depth + 1) });
        i = end + marker.length;
        return true;
      };
      if (pair("**", "strong") || pair("~~", "del") || pair("*", "em")) continue;
      if (ch === "_" && (i === 0 || /\W/.test(src[i - 1]!)) && pair("_", "em")) continue;

      if (ch === "[") {
        const close = src.indexOf("](", i + 1);
        const end = close === -1 ? -1 : src.indexOf(")", close + 2);
        if (close > i && end > close) {
          const label = src.slice(i + 1, close);
          const href = safeHref(src.slice(close + 2, end));
          if (href) {
            flush();
            out.push({ type: "link", href, children: parseInline(label, depth + 1) });
            i = end + 1;
            continue;
          }
        }
      }
    }

    buffer += ch;
    i++;
  }
  flush();
  return out;
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)\s*$/;

export function parseMarkdown(src: string, depth = 0): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const startsBlock = (l: string) => HEADING.test(l) || RULE.test(l) || BULLET.test(l) || ORDERED.test(l) || FENCE.test(l) || l.startsWith(">");

  while (i < lines.length) {
    const current = lines[i]!;
    if (current.trim() === "") {
      i++;
      continue;
    }

    const fence = FENCE.exec(current);
    if (fence) {
      const marker = fence[1]!;
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith(marker)) body.push(lines[i++]!);
      i++; // closing fence (or end of input)
      blocks.push({ type: "code", lang: fence[2] ?? "", text: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(current);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]!.length as 1, children: parseInline(heading[2]!) });
      i++;
      continue;
    }

    if (RULE.test(current)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    if (current.startsWith(">")) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) quoted.push(lines[i++]!.replace(/^>\s?/, ""));
      blocks.push({ type: "quote", children: depth < 3 ? parseMarkdown(quoted.join("\n"), depth + 1) : [{ type: "paragraph", children: parseInline(quoted.join(" ")) }] });
      continue;
    }

    const isBullet = BULLET.test(current);
    if (isBullet || ORDERED.test(current)) {
      const items: ListItem[] = [];
      const pattern = isBullet ? BULLET : ORDERED;
      while (i < lines.length) {
        const m = pattern.exec(lines[i]!);
        if (!m) break;
        let text = m[1]!;
        let checked: boolean | undefined;
        const task = /^\[([ xX])\]\s+(.*)$/.exec(text);
        if (isBullet && task) {
          checked = task[1] !== " ";
          text = task[2]!;
        }
        items.push({ ...(checked !== undefined ? { checked } : {}), children: parseInline(text) });
        i++;
      }
      blocks.push({ type: "list", ordered: !isBullet, items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && (para.length === 0 || !startsBlock(lines[i]!))) para.push(lines[i++]!.trim());
    blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) });
  }
  return blocks;
}
