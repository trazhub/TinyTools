"use client";

import { useRef, useState } from "react";
import { Download, FileUp, Minimize2, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Segmented, Textarea } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import {
  jsonStats,
  parseJson,
  stringifyNode,
  type IndentOption,
  type JsonError,
  type JsonStats,
} from "@/lib/tools/json-formatter";
import { downloadBlob, formatBytes } from "@/lib/utils";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const SAMPLE = '{"name":"TinyTools","free":true,"tools":[{"id":"json-formatter","tags":["dev","json"]}],"version":1.0,"id":12345678901234567890}';

const INDENT_OPTIONS = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tab" },
] as const;

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState<"2" | "4" | "tab">("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [error, setError] = useState<JsonError | null>(null);
  const [stats, setStats] = useState<JsonStats | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset(text: string) {
    setInput(text);
    setOutput("");
    setError(null);
    setStats(null);
  }

  function run(mode: "format" | "minify") {
    if (input.trim() === "") {
      setOutput("");
      setStats(null);
      setError({ message: "Paste some JSON first.", position: 0, line: 1, column: 1 });
      return;
    }
    const parsed = parseJson(input);
    if (!parsed.ok) {
      setOutput("");
      setStats(null);
      setError(parsed.error);
      return;
    }
    const indentValue: IndentOption = indent === "tab" ? "tab" : indent === "4" ? 4 : 2;
    setError(null);
    setOutput(stringifyNode(parsed.value, mode === "format" ? { indent: indentValue, sortKeys } : "minify"));
    setStats(jsonStats(parsed.value));
  }

  function jumpToError() {
    const el = inputRef.current;
    if (!el || !error) return;
    el.focus();
    el.setSelectionRange(error.position, Math.min(error.position + 1, input.length));
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError({ message: `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.`, position: 0, line: 1, column: 1 });
      return;
    }
    try {
      reset(await file.text());
    } catch {
      setError({ message: "That file could not be read.", position: 0, line: 1, column: 1 });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const isPositionError = error !== null && input.trim() !== "" && error.message !== "Input is empty";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="grid gap-2">
          <span className="text-sm font-medium">Indentation</span>
          <Segmented label="Indentation" value={indent} onChange={setIndent} options={INDENT_OPTIONS} />
        </div>
        <Checkbox label="Sort keys A–Z" checked={sortKeys} onCheckedChange={setSortKeys} className="pb-2" />
      </div>

      <ToolField
        label="JSON input"
        htmlFor="json-input"
        action={
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => reset(SAMPLE)}>
              <Sparkles aria-hidden /> Sample
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp aria-hidden /> Open file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.txt,application/json,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-label="Open a JSON file"
              onChange={(e) => void loadFile(e.target.files?.[0])}
            />
          </div>
        }
      >
        <Textarea
          id="json-input"
          ref={inputRef}
          value={input}
          onChange={(e) => reset(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder='{"paste": "your JSON here"}'
          className="min-h-64 font-mono text-[13px]"
          aria-invalid={error !== null}
          aria-describedby={error ? "json-error" : undefined}
        />
      </ToolField>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run("format")}>
          <WandSparkles aria-hidden /> Format
        </Button>
        <Button variant="secondary" onClick={() => run("minify")}>
          <Minimize2 aria-hidden /> Minify
        </Button>
        <Button variant="ghost" onClick={() => reset("")} disabled={!input && !output}>
          <Trash2 aria-hidden /> Clear
        </Button>
      </div>

      {error && (
        <div id="json-error">
          <Alert tone="error" title={isPositionError ? "Invalid JSON" : "Nothing to format"}>
            {error.message}
            {isPositionError && (
              <>
                {" "}
                <span className="whitespace-nowrap">
                  (line {error.line}, column {error.column})
                </span>
                <Button variant="link" size="sm" className="ml-2 h-auto p-0 text-destructive" onClick={jumpToError}>
                  Jump to error
                </Button>
              </>
            )}
          </Alert>
        </div>
      )}

      {output && (
        <div className="space-y-3">
          <Alert tone="success" title="Valid JSON">
            {stats && `${stats.keys} ${stats.keys === 1 ? "key" : "keys"}, ${stats.values} ${stats.values === 1 ? "value" : "values"}, ${stats.depth} ${stats.depth === 1 ? "level" : "levels"} deep. `}
            Output is {formatBytes(new TextEncoder().encode(output).length)}.
          </Alert>
          <ToolField
            label="Result"
            htmlFor="json-output"
            action={
              <div className="flex gap-2">
                <CopyButton text={output} size="sm" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadBlob(new Blob([output], { type: "application/json" }), "formatted.json")}
                >
                  <Download aria-hidden /> Download
                </Button>
              </div>
            }
          >
            <Textarea id="json-output" readOnly value={output} spellCheck={false} className="min-h-64 font-mono text-[13px]" />
          </ToolField>
        </div>
      )}
    </div>
  );
}
