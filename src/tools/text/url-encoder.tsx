"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Segmented, Textarea } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import { parseQuery, urlDecode, urlEncode, type UrlMode } from "@/lib/tools/url-tools";

export default function UrlEncoder() {
  const [text, setText] = useState("");
  const [action, setAction] = useState<string>("encode");
  const [mode, setMode] = useState<string>("component");

  const result = useMemo(() => {
    if (!text) return { out: "", error: false };
    if (action === "encode") return { out: urlEncode(text, mode as UrlMode), error: false };
    const d = urlDecode(text, mode as UrlMode);
    return d === null ? { out: "", error: true } : { out: d, error: false };
  }, [text, action, mode]);
  const query = useMemo(() => (text.includes("?") ? parseQuery(text.trim()) : null), [text]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6">
        <Segmented
          label="Action"
          value={action}
          onChange={setAction}
          options={[
            { value: "encode", label: "Encode" },
            { value: "decode", label: "Decode" },
          ]}
        />
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "component", label: "Part of a URL" },
            { value: "full", label: "Whole URL" },
          ]}
        />
      </div>
      <ToolField label="Input" htmlFor="ue-in">
        <Textarea id="ue-in" value={text} onChange={(e) => setText(e.target.value)} className="min-h-28" />
      </ToolField>
      {result.error && <Alert tone="error">That is not valid percent-encoding, so it cannot be decoded.</Alert>}
      <ToolField label="Result" htmlFor="ue-out" action={<CopyButton text={result.out} label="Copy" size="sm" />}>
        <Textarea id="ue-out" readOnly value={result.out} className="min-h-28" />
      </ToolField>
      {query && query.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Query parameters</h2>
          <table className="w-full border border-foreground text-sm">
            <tbody>
              {query.map((q, i) => (
                <tr key={i} className="border-b border-foreground last:border-0">
                  <th scope="row" className="w-1/3 p-2 text-left font-medium">
                    {q.name}
                  </th>
                  <td className="break-all p-2">{q.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
