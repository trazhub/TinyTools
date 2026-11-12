import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { parseMarkdown, type Block, type Inline } from "./markdown";

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return <Fragment key={i}>{n.text}</Fragment>;
      case "strong":
        return <strong key={i}>{renderInline(n.children)}</strong>;
      case "em":
        return <em key={i}>{renderInline(n.children)}</em>;
      case "del":
        return <del key={i}>{renderInline(n.children)}</del>;
      case "code":
        return (
          <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
            {n.text}
          </code>
        );
      case "link":
        return (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2">
            {renderInline(n.children)}
          </a>
        );
    }
  });
}

const HEADING_CLASSES = ["text-2xl font-bold", "text-xl font-semibold", "text-lg font-semibold", "text-base font-semibold", "text-sm font-semibold", "text-sm font-semibold text-muted-foreground"];

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as "h1";
      return (
        <Tag key={key} className={cn("mt-5 first:mt-0", HEADING_CLASSES[block.level - 1])}>
          {renderInline(block.children)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="leading-relaxed">
          {renderInline(block.children)}
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag key={key} className={cn("space-y-1 pl-6", block.ordered ? "list-decimal" : "list-disc", block.items.some((i) => i.checked !== undefined) && "list-none pl-1")}>
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {item.checked !== undefined && <input type="checkbox" checked={item.checked} readOnly disabled aria-label={item.checked ? "Done" : "Not done"} className="mr-2 align-middle" />}
              {renderInline(item.children)}
            </li>
          ))}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote key={key} className="space-y-2 border-l-4 border-primary/50 pl-4 text-muted-foreground">
          {block.children.map(renderBlock)}
        </blockquote>
      );
    case "code":
      return (
        <pre key={key} className="overflow-x-auto rounded-lg border border-border bg-muted p-3 font-mono text-[13px] leading-relaxed">
          <code>{block.text}</code>
        </pre>
      );
    case "rule":
      return <hr key={key} className="border-border" />;
  }
}

/** Renders Markdown as React elements. User text only ever becomes text nodes. */
export function MarkdownView({ source, className }: { source: string; className?: string }) {
  return <div className={cn("space-y-3 text-sm", className)}>{parseMarkdown(source).map(renderBlock)}</div>;
}
