"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import { decodeJwt } from "@/lib/tools/jwt";

const TIME_CLAIMS: Record<string, string> = { exp: "Expires", iat: "Issued", nbf: "Not valid before" };

export default function JwtDecoder() {
  const [token, setToken] = useState("");
  // The time the page was opened, used to say whether a token has expired.
  const [openedAt] = useState(() => Date.now());
  const jwt = useMemo(() => (token.trim() ? decodeJwt(token) : null), [token]);
  const payload = jwt?.payload && typeof jwt.payload === "object" ? (jwt.payload as Record<string, unknown>) : {};

  return (
    <div className="space-y-6">
      <Alert tone="info">This only reads the token. It does not check the signature, so it cannot tell you the token is genuine. Your token stays in your browser.</Alert>
      <ToolField label="Token" htmlFor="jwt">
        <Textarea id="jwt" value={token} onChange={(e) => setToken(e.target.value)} className="min-h-28 break-all font-mono text-xs" placeholder="eyJhbGciOi…" />
      </ToolField>
      {token.trim() && !jwt && <Alert tone="error">That is not a valid JWT. It should be three parts separated by dots.</Alert>}
      {jwt && (
        <div className="space-y-5">
          {(["header", "payload"] as const).map((k) => {
            const json = JSON.stringify(jwt[k], null, 2);
            return (
              <section key={k} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium capitalize">{k}</h2>
                  <CopyButton text={json} label="Copy" size="sm" />
                </div>
                <pre className="overflow-auto border border-foreground p-3 text-xs">{json}</pre>
              </section>
            );
          })}
          <ul className="space-y-1 text-sm">
            {Object.entries(TIME_CLAIMS).map(([claim, label]) => {
              const v = payload[claim];
              if (typeof v !== "number") return null;
              const d = new Date(v * 1000);
              return (
                <li key={claim}>
                  {label}: {d.toLocaleString()} {claim === "exp" && (d.getTime() < openedAt ? "(expired)" : "(still valid)")}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
