"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Segmented, Textarea } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { ToolField } from "@/components/tool/tool-field";
import { formatBytes } from "@/lib/utils";

const ALGOS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
const MAX_BYTES = 500 * 1024 * 1024;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** SHA hashes of text or a file, computed in the browser. */
export default function HashGenerator() {
  const [mode, setMode] = useState<string>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [hashes, setHashes] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        let data: ArrayBuffer | null = null;
        if (mode === "text") data = new TextEncoder().encode(text).buffer as ArrayBuffer;
        else if (file) {
          if (file.size > MAX_BYTES) throw new Error("That file is over 500 MB.");
          data = await file.arrayBuffer();
        }
        if (!data) return void (!dead && setHashes(null));
        const out: Record<string, string> = {};
        for (const a of ALGOS) out[a] = hex(await crypto.subtle.digest(a, data));
        if (!dead) {
          setHashes(out);
          setError(null);
        }
      } catch (e) {
        if (!dead) {
          setHashes(null);
          setError(e instanceof Error ? e.message : "Could not compute the hash.");
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, [mode, text, file]);

  return (
    <div className="space-y-6">
      <Segmented
        label="Input"
        value={mode}
        onChange={setMode}
        options={[
          { value: "text", label: "Text" },
          { value: "file", label: "File" },
        ]}
      />
      {mode === "text" ? (
        <ToolField label="Text" htmlFor="ht">
          <Textarea id="ht" value={text} onChange={(e) => setText(e.target.value)} className="min-h-32" />
        </ToolField>
      ) : (
        <div className="space-y-2">
          <FileDropzone accept="*/*" hint="Any file up to 500 MB. Nothing is uploaded." onFiles={([f]) => f && setFile(f)} />
          {file && (
            <p className="text-sm text-muted-foreground">
              {file.name}, {formatBytes(file.size)}
            </p>
          )}
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {hashes && (
        <dl className="space-y-3">
          {ALGOS.map((a) => (
            <div key={a} className="space-y-1">
              <dt className="text-sm font-medium">{a}</dt>
              <dd className="flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all border border-foreground p-2 text-xs">{hashes[a]}</code>
                <CopyButton text={hashes[a] ?? ""} label="Copy" size="sm" />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-xs text-muted-foreground">MD5 is not offered: browsers do not include it, and it is not safe for security checks.</p>
    </div>
  );
}
