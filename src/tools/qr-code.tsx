"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Segmented, Textarea } from "@/components/ui/form";
import { ToolField } from "@/components/tool/tool-field";
import { downloadBlob } from "@/lib/utils";

const LEVELS = [
  { value: "L", label: "Low" },
  { value: "M", label: "Medium" },
  { value: "Q", label: "High" },
  { value: "H", label: "Highest" },
] as const;
const SIZES = [
  { value: "256", label: "256 px" },
  { value: "512", label: "512 px" },
  { value: "1024", label: "1024 px" },
] as const;

type Level = (typeof LEVELS)[number]["value"];

export default function QrCode() {
  const [text, setText] = useState("https://trazhub.github.io/TinyTools/");
  const [level, setLevel] = useState<string>("M");
  const [size, setSize] = useState<string>("512");
  const [png, setPng] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    if (!text.trim()) return;
    (async () => {
      try {
        const QR = await import("qrcode");
        const url = await QR.toDataURL(text, { width: Number(size), margin: 2, errorCorrectionLevel: level as Level, color: { dark: "#000000", light: "#ffffff" } });
        if (!dead) {
          setPng(url);
          setError(null);
        }
      } catch {
        if (!dead) {
          setPng(null);
          setError("That is too much text for a QR code. Shorten it or lower the error correction.");
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, [text, level, size]);

  // Nothing to show for empty text, whatever was made before.
  const empty = !text.trim();

  async function downloadPng() {
    if (png) downloadBlob(await (await fetch(png)).blob(), "qr-code.png");
  }
  async function downloadSvg() {
    const QR = await import("qrcode");
    const svg = await QR.toString(text, { type: "svg", margin: 2, errorCorrectionLevel: level as Level, color: { dark: "#000000", light: "#ffffff" } });
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "qr-code.svg");
  }

  return (
    <div className="space-y-6">
      <ToolField label="Text or link" htmlFor="qr-text" hint="Everything stays in your browser.">
        <Textarea id="qr-text" value={text} onChange={(e) => setText(e.target.value)} className="min-h-24" />
      </ToolField>
      <div className="flex flex-wrap gap-8">
        <div className="space-y-2">
          <p className="text-sm font-medium">Error correction</p>
          <Segmented label="Error correction" value={level} onChange={setLevel} options={LEVELS} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Size</p>
          <Segmented label="Size" value={size} onChange={setSize} options={SIZES} />
        </div>
      </div>
      {error && !empty && <Alert tone="error">{error}</Alert>}
      {png && !empty && !error && (
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={png} alt="QR code" className="h-64 w-64 border border-foreground" style={{ imageRendering: "pixelated" }} />
          <div className="flex flex-wrap gap-3">
            <Button onClick={downloadPng}>
              <Download aria-hidden /> Download PNG
            </Button>
            <Button variant="outline" onClick={downloadSvg}>
              <Download aria-hidden /> Download SVG
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
