"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ArrowDownUp, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Segmented, Textarea } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import { decodeBase64, encodeBase64 } from "@/lib/tools/base64";

type Mode = "encode" | "decode";

const MODES = [
  { value: "encode", label: "Encode" },
  { value: "decode", label: "Decode" },
] as const;

export default function Base64EncoderDecoder() {
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [padding, setPadding] = useState(true);
  const deferred = useDeferredValue(input);

  const result = useMemo(() => {
    if (mode === "encode") return { ok: true as const, output: encodeBase64(deferred, { urlSafe, padding }) };
    return decodeBase64(deferred);
  }, [mode, deferred, urlSafe, padding]);

  const output = result.ok ? result.output : "";

  function swap() {
    if (!result.ok) return;
    setInput(result.output);
    setMode(mode === "encode" ? "decode" : "encode");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented label="Mode" value={mode} onChange={setMode} options={MODES} />
        {mode === "encode" && (
          <>
            <Checkbox label="URL-safe alphabet" hint="Uses - and _ instead of + and /" checked={urlSafe} onCheckedChange={setUrlSafe} />
            <Checkbox label="Include = padding" checked={padding} onCheckedChange={setPadding} />
          </>
        )}
      </div>

      <ToolField
        label={mode === "encode" ? "Text to encode" : "Base64 to decode"}
        htmlFor="b64-input"
        action={
          <Button variant="ghost" size="sm" onClick={() => setInput("")} disabled={!input}>
            <Trash2 aria-hidden /> Clear
          </Button>
        }
      >
        <Textarea
          id="b64-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={mode === "encode" ? "Type or paste text. Emoji and accents are fine." : "SGVsbG8sIFdvcmxkIQ=="}
          className="min-h-40 font-mono text-[13px]"
          aria-invalid={!result.ok}
          aria-describedby={!result.ok ? "b64-error" : undefined}
        />
      </ToolField>

      {!result.ok && deferred.trim() !== "" && (
        <div id="b64-error">
          <Alert tone="error" title="Can't decode this">
            {result.error}
          </Alert>
        </div>
      )}

      <ToolField
        label={mode === "encode" ? "Base64 result" : "Decoded text"}
        htmlFor="b64-output"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={swap} disabled={!result.ok || output === ""}>
              <ArrowDownUp aria-hidden /> Swap
            </Button>
            <CopyButton text={output} size="sm" />
          </div>
        }
      >
        <Textarea
          id="b64-output"
          readOnly
          value={output}
          spellCheck={false}
          placeholder="The result appears here"
          className="min-h-40 font-mono text-[13px]"
        />
      </ToolField>
    </div>
  );
}
