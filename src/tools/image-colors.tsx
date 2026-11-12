"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { CopyButton } from "@/components/tool/copy-button";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { paletteFromPixels, toHex, type Rgb } from "@/lib/tools/color";
import { errorMessage, openBitmap } from "./shared";

const MAX_SIDE = 900;

function Swatch({ rgb, label }: { rgb: Rgb; label: string }) {
  const hex = toHex(rgb);
  return (
    <div className="flex items-center gap-3 border border-foreground p-2">
      <span className="size-10 shrink-0 border border-foreground" style={{ background: hex }} role="img" aria-label={`${label} ${hex}`} />
      <span className="flex-1 font-mono text-sm">{hex}</span>
      <CopyButton text={hex} label="Copy" size="sm" />
    </div>
  );
}

/** Click anywhere on a picture to read its colour, and see the colours it uses most. */
export default function ImageColors() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState<string | null>(null);
  const [palette, setPalette] = useState<Rgb[]>([]);
  const [picked, setPicked] = useState<Rgb | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick([file]: File[]) {
    if (!file) return;
    setError(null);
    setPicked(null);
    try {
      const bitmap = await openBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const c = canvas.current!;
      c.width = Math.max(1, Math.round(bitmap.width * scale));
      c.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0, c.width, c.height);
      setPalette(paletteFromPixels(ctx.getImageData(0, 0, c.width, c.height).data, 6));
      setName(file.name);
    } catch (e) {
      setName(null);
      setPalette([]);
      setError(errorMessage(e));
    }
  }

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    const x = Math.min(c.width - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * c.width)));
    const y = Math.min(c.height - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * c.height)));
    const [R, G, B] = c.getContext("2d", { willReadFrequently: true })!.getImageData(x, y, 1, 1).data;
    setPicked({ r: R!, g: G!, b: B! });
  }

  return (
    <div className="space-y-6">
      <FileDropzone accept="image/*" hint="PNG, JPG or WebP. Nothing is uploaded." onFiles={pick} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className={name ? "space-y-4" : "hidden"}>
        <p className="text-sm text-muted-foreground">{name}. Click on the picture to read a colour.</p>
        <canvas ref={canvas} onClick={onClick} aria-label="The picture. Click to pick a colour." className="max-h-[28rem] max-w-full cursor-crosshair border border-foreground" />
      </div>
      {picked && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Picked colour</h2>
          <Swatch rgb={picked} label="Picked colour" />
        </section>
      )}
      {palette.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Main colours</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {palette.map((p, i) => (
              <Swatch key={i} rgb={p} label={`Colour ${i + 1}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
