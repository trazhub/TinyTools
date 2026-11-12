"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { ToolField } from "@/components/tool/tool-field";
import { baseName, errorMessage, openBitmap } from "./shared";
import { loadPdfLib, savePdf } from "./pdf-utils";
import { openPdf } from "./pdf-render";
import { PageNav, PagePreview } from "./pdf-preview";

type Doc = Awaited<ReturnType<typeof openPdf>>;
type Item = { kind: "image"; url: string; ratio: number } | { kind: "text"; text: string; size: number };
interface Placed {
  id: number;
  page: number;
  x: number;
  y: number;
  w: number; // fraction of page width (images)
  item: Item;
}

const SIGN_SOURCES = [
  { value: "draw", label: "Draw" },
  { value: "type", label: "Type" },
  { value: "image", label: "Image" },
] as const;
const EDIT_SOURCES = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
] as const;

let counter = 0;

/** Any image file -> a PNG data URL (max 1200 px wide) plus its aspect ratio. */
async function imageToPng(file: File): Promise<{ url: string; ratio: number }> {
  const bitmap = await openBitmap(file);
  const scale = Math.min(1, 1200 / bitmap.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
  return { url: c.toDataURL("image/png"), ratio: c.height / c.width };
}

function typedSignature(name: string): { url: string; ratio: number } {
  const c = document.createElement("canvas");
  c.width = 900;
  c.height = 240;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.font = "italic 110px 'Segoe Script','Brush Script MT','Snell Roundhand',cursive";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 20, 120, 860);
  return { url: c.toDataURL("image/png"), ratio: c.height / c.width };
}

function SignaturePad({ onChange }: { onChange: (v: { url: string; ratio: number } | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 600, y: ((e.clientY - r.top) / r.height) * 200 };
  };
  const ctx = () => {
    const c = ref.current!.getContext("2d")!;
    c.lineWidth = 4;
    c.lineCap = "round";
    c.strokeStyle = "#000";
    return c;
  };
  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width={600}
        height={200}
        aria-label="Draw your signature here"
        className="w-full max-w-xl touch-none border border-foreground bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const p = pos(e);
          const c = ctx();
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x + 0.1, p.y);
          c.stroke();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const p = pos(e);
          const c = ctx();
          c.lineTo(p.x, p.y);
          c.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          onChange({ url: ref.current!.toDataURL("image/png"), ratio: 200 / 600 });
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          ref.current!.getContext("2d")!.clearRect(0, 0, 600, 200);
          onChange(null);
        }}
      >
        Clear
      </Button>
    </div>
  );
}

/** Sign PDF and Edit PDF: put a signature, text or image on a page by clicking where it goes. */
export default function PdfPlace({ mode }: { mode: "sign" | "edit" }) {
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [page, setPage] = useState(1);
  const [pageW, setPageW] = useState(600);
  const [source, setSource] = useState<string>(mode === "sign" ? "draw" : "text");
  const [image, setImage] = useState<{ url: string; ratio: number } | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("Your text");
  const [size, setSize] = useState("18");
  const [width, setWidth] = useState("25");
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    doc.getPage(page).then((p) => setPageW(p.getViewport({ scale: 1 }).width));
  }, [doc, page]);

  async function pick([f]: File[]) {
    if (!f) return;
    setError(null);
    setPlaced([]);
    setPage(1);
    try {
      setDoc(await openPdf(f));
      setFile(f);
    } catch (e) {
      setDoc(null);
      setFile(null);
      setError(errorMessage(e));
    }
  }

  const current: Item | null =
    source === "text"
      ? text.trim()
        ? { kind: "text", text, size: Math.max(6, Math.min(200, Number(size) || 18)) }
        : null
      : source === "type"
        ? name.trim()
          ? { kind: "image", ...typedSignature(name.trim()) }
          : null
        : image
          ? { kind: "image", url: image.url, ratio: image.ratio }
          : null;

  function place(p: { x: number; y: number }) {
    if (!current) return setError(mode === "sign" ? "Make your signature first." : "Enter the text or choose an image first.");
    setError(null);
    setPlaced((l) => [...l, { id: ++counter, page, x: p.x, y: p.y, w: Math.max(0.03, Math.min(0.9, Number(width) / 100 || 0.25)), item: current }]);
  }

  async function save() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { StandardFonts, rgb } = await import("pdf-lib");
      const out = await loadPdfLib(file);
      const font = await out.embedFont(StandardFonts.Helvetica);
      for (const p of placed) {
        const pg = out.getPage(p.page - 1);
        if (pg.getRotation().angle !== 0) throw new Error(`Page ${p.page} is rotated. Fix it with Rotate PDF first.`);
        const { width: W, height: H } = pg.getSize();
        const cx = p.x * W;
        const cy = (1 - p.y) * H;
        if (p.item.kind === "image") {
          const img = await out.embedPng(await fetch(p.item.url).then((r) => r.arrayBuffer()));
          const w = p.w * W;
          const h = w * p.item.ratio;
          pg.drawImage(img, { x: cx - w / 2, y: cy - h / 2, width: w, height: h });
        } else {
          let tw: number;
          try {
            tw = font.widthOfTextAtSize(p.item.text, p.item.size);
          } catch {
            throw new Error("Use letters, numbers and common symbols only.");
          }
          pg.drawText(p.item.text, { x: cx - tw / 2, y: cy - p.item.size * 0.35, size: p.item.size, font, color: rgb(0, 0, 0) });
        }
      }
      await savePdf(out, `${baseName(file.name)}-${mode === "sign" ? "signed" : "edited"}.pdf`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const total = doc?.numPages ?? 0;
  const here = placed.filter((p) => p.page === page);

  return (
    <div className="space-y-6">
      <FileDropzone accept="application/pdf,.pdf" hint="A PDF. Nothing is uploaded." onFiles={pick} />
      {doc && file && (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium">{mode === "sign" ? "Your signature" : "What to add"}</p>
            <Segmented label="Source" value={source} onChange={setSource} options={mode === "sign" ? SIGN_SOURCES : EDIT_SOURCES} />
            {source === "draw" && <SignaturePad onChange={setImage} />}
            {source === "type" && (
              <ToolField label="Your name" htmlFor="sig-name">
                <Input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
              </ToolField>
            )}
            {source === "image" && (
              <FileDropzone
                accept="image/*"
                hint="A PNG or JPG. A signature on a plain background works best."
                onFiles={async ([f]) => {
                  if (!f) return;
                  try {
                    setImage(await imageToPng(f));
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              />
            )}
            {source === "text" && (
              <div className="flex flex-wrap gap-4">
                <ToolField label="Text" htmlFor="ed-text">
                  <Input id="ed-text" value={text} onChange={(e) => setText(e.target.value)} className="w-64" />
                </ToolField>
                <ToolField label="Size (pt)" htmlFor="ed-size">
                  <Input id="ed-size" type="number" value={size} onChange={(e) => setSize(e.target.value)} className="w-24" />
                </ToolField>
              </div>
            )}
            {source !== "text" && (
              <ToolField label="Width (% of page)" htmlFor="ed-w">
                <Input id="ed-w" type="number" min={3} max={90} value={width} onChange={(e) => setWidth(e.target.value)} className="w-24" />
              </ToolField>
            )}
          </div>

          <p className="text-sm text-muted-foreground">Click on the page where it should go. Click again to add more.</p>
          <PageNav page={page} total={total} onPage={setPage} />
          <PagePreview doc={doc} pageNumber={page} onPoint={place}>
            {here.map((p) =>
              p.item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.item.url} alt="" className="pointer-events-none absolute" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, transform: "translate(-50%,-50%)" }} />
              ) : (
                <span key={p.id} className="pointer-events-none absolute whitespace-nowrap text-black" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: "translate(-50%,-50%)", fontSize: `${(p.item.size / pageW) * 100}cqw`, lineHeight: 1 }}>
                  {p.item.text}
                </span>
              ),
            )}
          </PagePreview>

          {placed.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {placed.length} item{placed.length === 1 ? "" : "s"} added
              </span>
              <Button variant="outline" size="sm" onClick={() => setPlaced((l) => l.slice(0, -1))}>
                <Trash2 aria-hidden /> Undo last
              </Button>
            </div>
          )}
          <Button onClick={save} disabled={busy || placed.length === 0}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {busy ? "Saving…" : "Save PDF"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
