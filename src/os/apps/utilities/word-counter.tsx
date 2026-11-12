"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Stat, ToolField } from "@/components/tool/tool-field";
import { analyzeText, formatDuration } from "@/lib/tools/text-counter";

const fmt = new Intl.NumberFormat("en-US");

export default function WordCounter() {
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text);
  const stats = useMemo(() => analyzeText(deferred), [deferred]);

  return (
    <div className="space-y-5">
      <ToolField
        label="Your text"
        htmlFor="wc-input"
        action={
          <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={!text}>
            <Trash2 aria-hidden /> Clear
          </Button>
        }
      >
        <Textarea
          id="wc-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste your text here…"
          className="min-h-64 text-base"
        />
      </ToolField>

      <section aria-label="Text statistics" aria-live="polite">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Words" value={fmt.format(stats.words)} />
          <Stat label="Characters" value={fmt.format(stats.characters)} />
          <Stat label="No spaces" value={fmt.format(stats.charactersNoSpaces)} />
          <Stat label="Sentences" value={fmt.format(stats.sentences)} />
          <Stat label="Paragraphs" value={fmt.format(stats.paragraphs)} />
          <Stat label="Lines" value={fmt.format(stats.lines)} />
          <Stat label="Reading time" value={formatDuration(stats.readingMinutes)} hint="at about 238 words/min" />
          <Stat label="Speaking time" value={formatDuration(stats.speakingMinutes)} hint="at about 150 words/min" />
        </dl>
      </section>

      {stats.topWords.length > 0 && (
        <section aria-labelledby="top-words" className="space-y-2">
          <h3 id="top-words" className="text-sm font-medium">
            Most used words
          </h3>
          <ul className="flex flex-wrap gap-2">
            {stats.topWords.map((w) => (
              <li key={w.word} className="rounded-full border border-border bg-muted px-3 py-1 text-sm">
                {w.word} <span className="font-semibold tabular-nums text-muted-foreground">×{w.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
