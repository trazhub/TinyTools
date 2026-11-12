"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/form";
import { ToolField } from "@/components/tool/tool-field";
import { MarkdownView } from "@/os/lib/markdown-view";

const SAMPLE = `# Hello

Write **Markdown** on the left and see it on the right.

- Lists work
- So do [links](https://example.com)

\`inline code\` and *emphasis* too.
`;

export default function MarkdownPreview() {
  const [source, setSource] = useState(SAMPLE);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ToolField label="Markdown" htmlFor="md">
        <Textarea id="md" value={source} onChange={(e) => setSource(e.target.value)} className="min-h-96 font-mono text-sm" />
      </ToolField>
      <div className="space-y-2">
        <p className="text-sm font-medium">Preview</p>
        <div className="min-h-96 border border-foreground p-4">
          <MarkdownView source={source} />
        </div>
      </div>
    </div>
  );
}
