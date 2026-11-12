"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { baseName, vendorUrl } from "./shared";

const MAX_BYTES = 500 * 1024 * 1024;

/** Output formats and the ffmpeg arguments for each. */
const FORMATS = {
  mp4: { label: "MP4", mime: "video/mp4", args: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart"] },
  webm: { label: "WebM", mime: "video/webm", args: ["-c:v", "libvpx", "-crf", "30", "-b:v", "1M", "-c:a", "libvorbis"] },
  mov: { label: "MOV", mime: "video/quicktime", args: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac"] },
  gif: { label: "GIF", mime: "image/gif", args: ["-vf", "fps=12,scale=480:-1:flags=lanczos", "-loop", "0"] },
  mp3: { label: "MP3 (audio only)", mime: "audio/mpeg", args: ["-vn", "-c:a", "libmp3lame", "-q:a", "2"] },
} as const;
type Format = keyof typeof FORMATS;

const OPTIONS = (Object.keys(FORMATS) as Format[]).map((value) => ({ value, label: FORMATS[value].label }));

/** The few parts of ffmpeg.wasm (@ffmpeg/ffmpeg 0.12) used here. Declared locally because the package types pull in worker typings. */
interface FFmpeg {
  load(config: { classWorkerURL: string; coreURL: string; wasmURL: string }): Promise<boolean>;
  exec(args: string[]): Promise<number>;
  writeFile(path: string, data: Uint8Array): Promise<boolean>;
  readFile(path: string): Promise<Uint8Array | string>;
  deleteFile(path: string): Promise<boolean>;
  on(event: "progress", cb: (e: { progress: number }) => void): void;
  off(event: "progress", cb: (e: { progress: number }) => void): void;
  terminate(): void;
}
type FFmpegInstance = FFmpeg;

export default function VideoConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<Format>("mp4");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const ffmpeg = useRef<FFmpegInstance | null>(null);

  useEffect(() => () => ffmpeg.current?.terminate(), []);

  async function getFFmpeg() {
    if (ffmpeg.current) return ffmpeg.current;
    setStatus("Loading the converter (about 30 MB, once)…");
    // Loaded from our own origin at runtime (not bundled): ffmpeg starts its own worker from these files.
    const lib: { FFmpeg: new () => FFmpeg } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ vendorUrl("ffmpeg/lib/index.js"));
    const ff = new lib.FFmpeg();
    await ff.load({
      classWorkerURL: vendorUrl("ffmpeg/lib/worker.js"),
      coreURL: vendorUrl("ffmpeg/ffmpeg-core.js"),
      wasmURL: vendorUrl("ffmpeg/ffmpeg-core.wasm"),
    });
    ffmpeg.current = ff;
    return ff;
  }

  async function run() {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is over 500 MB, which is too large for the browser.");
    setError(null);
    setResult(null);
    const { mime, args } = FORMATS[format];
    const input = `input${file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).replace(/[^.\w]/g, "") : ""}`;
    const output = `output.${format}`;
    let ff: FFmpegInstance | null = null;
    let onProgress: ((e: { progress: number }) => void) | null = null;
    try {
      ff = await getFFmpeg();
      onProgress = ({ progress }) => setStatus(`Converting… ${Math.min(100, Math.max(0, Math.round(progress * 100)))}%`);
      ff.on("progress", onProgress);
      setStatus("Converting… 0%");
      await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
      const code = await ff.exec(["-i", input, ...args, output]);
      if (code !== 0) throw new Error(format === "mp3" ? "No audio could be extracted. The file may have no audio track." : "This video could not be converted. It may use a format the converter does not know.");
      const data = (await ff.readFile(output)) as Uint8Array;
      setResult({ blob: new Blob([data as BlobPart], { type: mime }), name: `${baseName(file.name)}.${format}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The conversion failed.");
      // A failed run can leave the engine in a bad state; start fresh next time.
      ffmpeg.current?.terminate();
      ffmpeg.current = null;
    } finally {
      if (ff && onProgress) ff.off("progress", onProgress);
      if (ffmpeg.current) {
        await ffmpeg.current.deleteFile(input).catch(() => {});
        await ffmpeg.current.deleteFile(output).catch(() => {});
      }
      setStatus(null);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="video/*,audio/*,.mkv,.avi,.flv,.wmv,.3gp"
        hint="MP4, MOV, WebM, MKV, AVI and more. Nothing is uploaded."
        onFiles={([f]) => {
          if (!f) return;
          setFile(f);
          setResult(null);
          setError(null);
        }}
      />
      {file && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {file.name}, {formatBytes(file.size)}
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Convert to</p>
            <Segmented
              label="Format"
              value={format}
              onChange={(v) => {
                setFormat(v);
                setResult(null);
              }}
              options={OPTIONS}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            This runs on your device, so it is slow for long or large videos. Keep this tab open while it works.
          </p>
          <Button onClick={run} disabled={status !== null}>
            {status ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {status ?? "Convert"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {result && (
        <div className="space-y-3 border border-foreground p-4">
          <p className="text-sm">
            {result.name}, {formatBytes(result.blob.size)}
          </p>
          <Button onClick={() => downloadBlob(result.blob, result.name)}>
            <Download aria-hidden /> Download
          </Button>
        </div>
      )}
    </div>
  );
}
