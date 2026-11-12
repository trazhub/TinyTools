"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Download, FileArchive, Images } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { createZip } from "@/lib/zip";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { OUTPUT_QUALITY, baseName, canvasToBlob, errorMessage } from "./shared";

const FORMATS = [
  { value: "image/jpeg", label: "JPG" },
  { value: "image/png", label: "PNG" },
] as const;
const AUTO_COUNT = 8;

interface Frame {
  id: number;
  time: number;
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

let counter = 0;
const stamp = (t: number) => {
  const m = Math.floor(t / 60);
  return `${m}:${(t % 60).toFixed(1).padStart(4, "0")}`;
};

/**
 * Save any frame of a video as a picture. Uses the browser's own video player, so it works for
 * the formats the browser can play (MP4, WebM and usually MOV). The video never leaves your device.
 */
export default function VideoFrames() {
  const video = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [type, setType] = useState<string>("image/jpeg");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  useEffect(() => () => frames.forEach((f) => URL.revokeObjectURL(f.url)), [frames]);

  function pick([f]: File[]) {
    if (!f) return;
    setError(null);
    setFrames([]);
    setFile(f);
    setSrc(URL.createObjectURL(f));
  }

  const ext = type === "image/png" ? "png" : "jpg";

  async function grab(): Promise<Frame> {
    const v = video.current!;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, 0, 0);
    const blob = await canvasToBlob(c, type, OUTPUT_QUALITY);
    return { id: ++counter, time: v.currentTime, blob, url: URL.createObjectURL(blob), width: c.width, height: c.height };
  }

  function ready(): boolean {
    const v = video.current;
    if (!v || !v.videoWidth) {
      setError("This browser cannot play that video, so it cannot read its frames. Try an MP4 or WebM file.");
      return false;
    }
    return true;
  }

  async function capture() {
    if (!ready()) return;
    setError(null);
    try {
      const f = await grab();
      setFrames((l) => [...l, f]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const seek = (v: HTMLVideoElement, t: number) =>
    new Promise<void>((resolve) => {
      v.addEventListener("seeked", () => resolve(), { once: true });
      v.currentTime = t;
    });

  /** Grab frames at even steps through the whole video. */
  async function auto() {
    if (!ready()) return;
    const v = video.current!;
    if (!Number.isFinite(v.duration) || v.duration <= 0) return setError("The length of this video is unknown, so frames cannot be spread across it.");
    setError(null);
    setBusy(true);
    const back = v.currentTime;
    v.pause();
    try {
      const list: Frame[] = [];
      for (let i = 0; i < AUTO_COUNT; i++) {
        await seek(v, (v.duration * (i + 0.5)) / AUTO_COUNT);
        list.push(await grab());
      }
      setFrames((l) => [...l, ...list]);
      await seek(v, back);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (f: Frame) => `${baseName(file?.name ?? "video")}-${f.time.toFixed(1)}s.${ext}`;

  async function zip() {
    const entries = await Promise.all(frames.map(async (f) => ({ name: nameOf(f), data: new Uint8Array(await f.blob.arrayBuffer()) })));
    downloadBlob(new Blob([createZip(entries) as BlobPart], { type: "application/zip" }), `${baseName(file?.name ?? "video")}-frames.zip`);
  }

  return (
    <div className="space-y-6">
      <FileDropzone accept="video/*" hint="MP4 or WebM (whatever your browser can play). Nothing is uploaded." onFiles={pick} />
      {error && <Alert tone="error">{error}</Alert>}
      {src && file && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {file.name}, {formatBytes(file.size)}. Move to the moment you want, then save the frame.
          </p>
          <video ref={video} src={src} controls playsInline preload="auto" className="max-h-96 max-w-full border border-foreground bg-black" onError={() => setError("This browser cannot play that video, so it cannot read its frames. Try an MP4 or WebM file.")} />
          <div className="space-y-2">
            <p className="text-sm font-medium">Save as</p>
            <Segmented label="Format" value={type} onChange={setType} options={FORMATS} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={capture} disabled={busy}>
              <Camera aria-hidden /> Save this frame
            </Button>
            <Button variant="outline" onClick={auto} disabled={busy}>
              <Images aria-hidden /> {busy ? "Working…" : `Grab ${AUTO_COUNT} frames across the video`}
            </Button>
          </div>
        </div>
      )}
      {frames.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Saved frames</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {frames.map((f) => (
              <li key={f.id} className="space-y-1 border border-foreground p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={`Frame at ${stamp(f.time)}`} className="w-full border border-border" />
                <p className="text-xs text-muted-foreground">
                  {stamp(f.time)}, {f.width} × {f.height}
                </p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => downloadBlob(f.blob, nameOf(f))}>
                  <Download aria-hidden /> Download
                </Button>
              </li>
            ))}
          </ul>
          {frames.length > 1 && (
            <Button onClick={zip}>
              <FileArchive aria-hidden /> Download all as zip
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
