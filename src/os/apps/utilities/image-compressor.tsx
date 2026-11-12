"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileArchive, ImageIcon, Loader2, Trash2, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { ToolField } from "@/components/tool/tool-field";
import {
  IMAGE_TYPE_LABEL,
  MAX_FILES,
  MAX_FILE_BYTES,
  buildOutputName,
  compressImage,
  savingsPercent,
  validateImageFile,
  type CompressOptions,
  type ImageType,
  type OutputFormat,
} from "@/lib/tools/image-compress";
import { createZip } from "@/lib/zip";
import { cn, downloadBlob, formatBytes, sanitizeFilename } from "@/lib/utils";

interface Output {
  blob: Blob;
  filename: string;
  url: string;
  width: number;
  height: number;
  /** The re-encoded image was not smaller, so the original file is offered instead. */
  keptOriginal: boolean;
}

type Item =
  | { id: string; file: File; type: ImageType; status: "queued" | "processing" }
  | { id: string; file: File; type: ImageType; status: "done"; output: Output }
  | { id: string; file: File; status: "error"; error: string };

const DEFAULT_OPTIONS: CompressOptions = { quality: 0.8, format: "original", maxDimension: 0 };

const SIZE_PRESETS = [
  { value: 0, label: "Original size" },
  { value: 3840, label: "4K (3840 px)" },
  { value: 2560, label: "2560 px" },
  { value: 1920, label: "Full HD (1920 px)" },
  { value: 1280, label: "1280 px" },
  { value: 1024, label: "1024 px" },
  { value: 800, label: "800 px" },
  { value: 512, label: "512 px" },
] as const;

let counter = 0;
const nextId = () => `img-${++counter}`;

export default function ImageCompressor() {
  const [options, setOptions] = useState<CompressOptions>(DEFAULT_OPTIONS);
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);

  const itemsRef = useRef<Item[]>([]);
  const optionsRef = useRef<CompressOptions>(DEFAULT_OPTIONS);
  const runRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const commit = useCallback((update: (prev: Item[]) => Item[]) => {
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  const revoke = useCallback((item: Item) => {
    if (item.status === "done") URL.revokeObjectURL(item.output.url);
  }, []);

  /** Invalidate any compression loop in flight; its results will be discarded. */
  const cancelRuns = useCallback(() => {
    runRef.current++;
  }, []);

  // Release object URLs and cancel work when leaving the page.
  useEffect(() => {
    const timer = debounceRef;
    const items = itemsRef;
    return () => {
      cancelRuns();
      clearTimeout(timer.current);
      items.current.forEach(revoke);
    };
  }, [revoke, cancelRuns]);

  const run = useCallback(async () => {
    const myRun = ++runRef.current;
    for (;;) {
      const next = itemsRef.current.find((i) => i.status === "queued");
      if (!next || next.status !== "queued") return;
      if (myRun !== runRef.current) return;

      commit((prev) => prev.map((i) => (i.id === next.id ? { ...next, status: "processing" } : i)));
      const opts = optionsRef.current;
      try {
        const r = await compressImage(next.file, next.type, opts);
        if (myRun !== runRef.current) return; // settings changed meanwhile; a newer run owns this item
        if (!itemsRef.current.some((i) => i.id === next.id)) continue; // removed while compressing

        const resized = r.width !== r.originalWidth || r.height !== r.originalHeight;
        const keptOriginal = r.type === next.type && !resized && r.blob.size >= next.file.size;
        const blob = keptOriginal ? next.file : r.blob;
        const output: Output = {
          blob,
          filename: keptOriginal ? sanitizeFilename(next.file.name, "image") : buildOutputName(next.file.name, r.type),
          url: URL.createObjectURL(blob),
          width: r.width,
          height: r.height,
          keptOriginal,
        };
        commit((prev) => prev.map((i) => (i.id === next.id ? { id: next.id, file: next.file, type: next.type, status: "done", output } : i)));
      } catch (e) {
        if (myRun !== runRef.current) return;
        const error = e instanceof Error ? e.message : "Something went wrong while compressing this image.";
        commit((prev) => prev.map((i) => (i.id === next.id ? { id: next.id, file: next.file, status: "error", error } : i)));
      }
    }
  }, [commit]);

  async function addFiles(files: File[]) {
    setMessage(null);
    const room = MAX_FILES - itemsRef.current.length;
    if (room <= 0) {
      setMessage(`You can compress up to ${MAX_FILES} images at a time. Remove some to add more.`);
      return;
    }
    const accepted = files.slice(0, room);
    if (files.length > room) {
      setMessage(`Only the first ${room} of ${files.length} files were added (limit ${MAX_FILES} images at a time).`);
    }

    const added: Item[] = [];
    for (const file of accepted) {
      const check = await validateImageFile(file);
      added.push(
        check.ok
          ? { id: nextId(), file, type: check.type, status: "queued" }
          : { id: nextId(), file, status: "error", error: check.error },
      );
    }
    commit((prev) => [...prev, ...added]);
    void run();
  }

  function changeOptions(patch: Partial<CompressOptions>) {
    const next = { ...optionsRef.current, ...patch };
    optionsRef.current = next;
    setOptions(next);
    // Re-compress everything shortly after the last change (cancels any run in flight).
    cancelRuns();
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      commit((prev) =>
        prev.map((i) => {
          if (i.status === "error") return i;
          revoke(i);
          return { id: i.id, file: i.file, type: i.type, status: "queued" };
        }),
      );
      void run();
    }, 350);
  }

  function remove(id: string) {
    const item = itemsRef.current.find((i) => i.id === id);
    if (item) revoke(item);
    commit((prev) => prev.filter((i) => i.id !== id));
  }

  function clearAll() {
    cancelRuns();
    itemsRef.current.forEach(revoke);
    commit(() => []);
    setMessage(null);
  }

  async function downloadAll() {
    const done = items.filter((i): i is Extract<Item, { status: "done" }> => i.status === "done");
    if (done.length === 0) return;
    setZipping(true);
    try {
      const entries = await Promise.all(
        done.map(async (i) => ({ name: i.output.filename, data: new Uint8Array(await i.output.blob.arrayBuffer()) })),
      );
      downloadBlob(new Blob([createZip(entries) as BlobPart], { type: "application/zip" }), "tinytools-compressed-images.zip");
    } finally {
      setZipping(false);
    }
  }

  const done = items.filter((i): i is Extract<Item, { status: "done" }> => i.status === "done");
  const busy = items.some((i) => i.status === "queued" || i.status === "processing");
  const totalBefore = done.reduce((n, i) => n + i.file.size, 0);
  const totalAfter = done.reduce((n, i) => n + i.output.blob.size, 0);
  const hasPng = items.some((i) => i.status !== "error" && i.type === "image/png");
  const qualityIgnored = options.format === "original" && hasPng && items.every((i) => i.status === "error" || i.type === "image/png");

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/jpeg,image/png,image/webp"
        multiple
        hint={`JPEG, PNG or WebP · up to ${MAX_FILE_BYTES / 1024 / 1024} MB each · up to ${MAX_FILES} images`}
        title="Drop images here or click to choose"
        onFiles={(f) => void addFiles(f)}
      />

      {message && <Alert tone="warning">{message}</Alert>}

      <fieldset className="grid gap-5 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-3 sm:p-5">
        <legend className="px-1 text-sm font-semibold">Settings</legend>

        <ToolField label={`Quality: ${Math.round(options.quality * 100)}%`} htmlFor="ic-quality">
          <input
            id="ic-quality"
            type="range"
            className="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(options.quality * 100)}
            onChange={(e) => changeOptions({ quality: Number(e.target.value) / 100 })}
            aria-valuetext={`${Math.round(options.quality * 100)} percent`}
          />
          {qualityIgnored && (
            <p className="text-xs text-warning">PNG is lossless, so quality has no effect. Convert to WebP for much smaller files.</p>
          )}
        </ToolField>

        <ToolField label="Output format" htmlFor="ic-format">
          <Select
            id="ic-format"
            value={options.format}
            onChange={(e) => changeOptions({ format: e.target.value as OutputFormat })}
          >
            <option value="original">Keep original format</option>
            <option value="image/webp">WebP (smallest)</option>
            <option value="image/jpeg">JPEG</option>
          </Select>
        </ToolField>

        <ToolField label="Maximum width / height" htmlFor="ic-size">
          <Select
            id="ic-size"
            value={options.maxDimension}
            onChange={(e) => changeOptions({ maxDimension: Number(e.target.value) })}
          >
            {SIZE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </ToolField>
      </fieldset>

      {items.length > 0 && (
        <section aria-label="Images" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite" data-testid="summary">
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Compressing…
                </span>
              ) : done.length > 0 ? (
                <>
                  <strong className="font-semibold text-foreground">
                    {formatBytes(totalBefore)} → {formatBytes(totalAfter)}
                  </strong>{" "}
                  across {done.length} {done.length === 1 ? "image" : "images"}
                  {totalBefore > totalAfter ? ` (${savingsPercent(totalBefore, totalAfter)}% smaller)` : ""}
                </>
              ) : (
                "No images could be processed."
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {done.length > 1 && (
                <Button size="sm" onClick={() => void downloadAll()} disabled={busy || zipping}>
                  <FileArchive aria-hidden /> {zipping ? "Preparing…" : "Download all (ZIP)"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={clearAll}>
                <Trash2 aria-hidden /> Clear all
              </Button>
            </div>
          </div>

          <ul className="grid gap-3">
            {items.map((item) => (
              <ImageRow key={item.id} item={item} onRemove={() => remove(item.id)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ImageRow({ item, onRemove }: { item: Item; onRemove: () => void }) {
  return (
    <li
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border bg-card p-3 shadow-soft",
        item.status === "error" && "border-destructive/40",
      )}
      data-status={item.status}
    >
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
        {item.status === "done" ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URL generated locally; next/image does not apply
          <img src={item.output.url} alt="" className="size-full object-cover" />
        ) : item.status === "error" ? (
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
        ) : (
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium" title={item.file.name}>
          {item.file.name}
        </p>
        {item.status === "done" ? (
          <>
            <p className="text-sm text-muted-foreground">
              {formatBytes(item.file.size)} → <span className="font-semibold text-foreground">{formatBytes(item.output.blob.size)}</span>{" "}
              <SavingsBadge before={item.file.size} after={item.output.blob.size} />
            </p>
            <p className="text-xs text-muted-foreground">
              {item.output.width} × {item.output.height} px · {IMAGE_TYPE_LABEL[item.output.blob.type as ImageType] ?? item.output.blob.type}
            </p>
            {item.output.keptOriginal && (
              <p className="text-xs text-warning">
                Re-compressing did not make this file smaller, so your original is offered instead. Try WebP or a smaller size.
              </p>
            )}
          </>
        ) : item.status === "error" ? (
          <p className="text-sm text-destructive">{item.error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {formatBytes(item.file.size)} · {item.status === "processing" ? "Compressing…" : "Waiting…"}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.status === "done" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadBlob(item.output.blob, item.output.filename)}
            aria-label={`Download ${item.output.filename}`}
          >
            <Download aria-hidden /> <span className="hidden sm:inline">Download</span>
          </Button>
        )}
        <Button size="icon-sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${item.file.name}`}>
          <X aria-hidden />
        </Button>
      </div>
    </li>
  );
}

function SavingsBadge({ before, after }: { before: number; after: number }) {
  const pct = savingsPercent(before, after);
  if (pct > 0) return <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">−{pct}%</span>;
  if (pct < 0) return <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">+{Math.abs(pct)}%</span>;
  return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">same size</span>;
}
