"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { ToolField } from "@/components/tool/tool-field";
import { parseClock } from "@/lib/tools/calc-tools";
import { formatBytes } from "@/lib/utils";
import { baseName, errorMessage } from "./shared";
import { inputName, loadFFmpeg, type FFmpeg } from "./ffmpeg";
import { ResultCard } from "./result-card";

const MAX_BYTES = 500 * 1024 * 1024;

const AUDIO = {
  mp3: { label: "MP3", mime: "audio/mpeg", args: ["-vn", "-c:a", "libmp3lame", "-q:a", "2"] },
  wav: { label: "WAV", mime: "audio/wav", args: ["-vn", "-c:a", "pcm_s16le"] },
  ogg: { label: "OGG", mime: "audio/ogg", args: ["-vn", "-c:a", "libvorbis", "-q:a", "5"] },
  m4a: { label: "M4A (AAC)", mime: "audio/mp4", args: ["-vn", "-c:a", "aac", "-b:a", "192k"] },
  flac: { label: "FLAC", mime: "audio/flac", args: ["-vn", "-c:a", "flac"] },
} as const;
type AudioFormat = keyof typeof AUDIO;

/** Re-encoding settings per video container, used for exact (not keyframe-only) trims. */
const REENCODE: Record<string, { mime: string; args: string[] }> = {
  mp4: { mime: "video/mp4", args: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac"] },
  mov: { mime: "video/quicktime", args: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac"] },
  webm: { mime: "video/webm", args: ["-c:v", "libvpx", "-crf", "30", "-b:v", "1M", "-c:a", "libvorbis"] },
  mkv: { mime: "video/x-matroska", args: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac"] },
};

const GIF_WIDTHS = [
  { value: "320", label: "Small (320 px)" },
  { value: "480", label: "Medium (480 px)" },
  { value: "640", label: "Large (640 px)" },
] as const;
const GIF_FPS = [
  { value: "8", label: "8 fps" },
  { value: "12", label: "12 fps" },
  { value: "15", label: "15 fps" },
] as const;
const QUALITY = [
  { value: "30", label: "Smallest file" },
  { value: "26", label: "Balanced" },
  { value: "22", label: "Best quality" },
] as const;
const HEIGHTS = [
  { value: "0", label: "Same size" },
  { value: "720", label: "720p" },
  { value: "480", label: "480p" },
  { value: "360", label: "360p" },
] as const;

export type MediaKind = "video-trim" | "audio-convert" | "audio-extract" | "video-gif" | "video-compress";

const BUTTON: Record<MediaKind, string> = {
  "video-trim": "Cut video",
  "audio-convert": "Convert",
  "audio-extract": "Extract audio",
  "video-gif": "Make GIF",
  "video-compress": "Compress video",
};

/** Several tools on the same in-browser engine (ffmpeg): trim, convert audio, extract audio, make a GIF, compress. */
export default function MediaTool({ kind }: { kind: MediaKind }) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<AudioFormat>("mp3");
  const [start, setStart] = useState("0:00");
  const [end, setEnd] = useState("");
  const [precise, setPrecise] = useState(false);
  const [length, setLength] = useState("5");
  const [gifWidth, setGifWidth] = useState<string>("480");
  const [fps, setFps] = useState<string>("12");
  const [crf, setCrf] = useState<string>("26");
  const [height, setHeight] = useState<string>("0");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string; note?: string } | null>(null);
  const ffmpeg = useRef<FFmpeg | null>(null);

  const isAudio = kind === "audio-convert" || kind === "audio-extract";

  useEffect(() => () => ffmpeg.current?.terminate(), []);


  async function run() {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is over 500 MB, which is too large for the browser.");

    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
    const input = inputName(file);
    let args: string[];
    let outExt: string;
    let mime: string;
    let suffix = "";
    if (isAudio) {
      outExt = format;
      mime = AUDIO[format].mime;
      args = ["-i", input, ...AUDIO[format].args, `output.${outExt}`];
    } else if (kind === "video-gif") {
      const s = parseClock(start || "0");
      const len = Number(length);
      if (s === null) return setError("Start time is not valid. Use seconds or a time like 1:30.");
      if (!(len >= 0.5 && len <= 20)) return setError("Length must be between 0.5 and 20 seconds.");
      outExt = "gif";
      mime = "image/gif";
      suffix = "";
      // A tuned colour palette makes GIFs look much better than the default one.
      args = ["-ss", String(s), "-t", String(len), "-i", input, "-vf", `fps=${fps},scale=${gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`, "-loop", "0", `output.${outExt}`];
    } else if (kind === "video-compress") {
      outExt = "mp4";
      mime = "video/mp4";
      suffix = "-small";
      const h = Number(height);
      args = ["-i", input, ...(h > 0 ? ["-vf", `scale=-2:'min(${h},ih)'`] : []), "-c:v", "libx264", "-preset", "veryfast", "-crf", crf, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", `output.${outExt}`];
    } else {
      const s = parseClock(start || "0");
      const e = end.trim() ? parseClock(end) : null;
      if (s === null) return setError("Start time is not valid. Use seconds or a time like 1:30.");
      if (end.trim() && e === null) return setError("End time is not valid. Use seconds or a time like 2:45.");
      if (e !== null && e <= s) return setError("The end time must be after the start time.");
      outExt = ext in REENCODE ? ext : "mp4";
      const re = REENCODE[outExt]!;
      mime = re.mime;
      suffix = "-trimmed";
      const range = ["-ss", String(s), ...(e !== null ? ["-to", String(e)] : [])];
      // Copying is instant but can only cut at keyframes; re-encoding is exact but slower.
      args = precise || outExt !== ext ? [...range, "-i", input, ...re.args, `output.${outExt}`] : [...range, "-i", input, "-c", "copy", `output.${outExt}`];
    }

    setError(null);
    setResult(null);
    const output = `output.${outExt}`;
    let onProgress: ((e: { progress: number }) => void) | null = null;
    try {
      if (!ffmpeg.current) {
        setStatus("Loading the engine (about 30 MB, once)…");
        ffmpeg.current = await loadFFmpeg();
      }
      const ff = ffmpeg.current;
      onProgress = ({ progress }) => setStatus(`Working… ${Math.min(100, Math.max(0, Math.round(progress * 100)))}%`);
      ff.on("progress", onProgress);
      setStatus("Working… 0%");
      await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
      const code = await ff.exec(args);
      if (code !== 0) {
        throw new Error(
          isAudio
            ? "No audio could be read from that file. It may have no sound."
            : kind === "video-trim"
              ? "This video could not be cut. Try the exact (slower) option."
              : "This video could not be processed. It may use a format the engine does not know.",
        );
      }
      const data = (await ff.readFile(output)) as Uint8Array;
      if (data.length === 0) throw new Error("The result was empty. Check the start time and length.");
      const note = kind === "video-compress" && data.length >= file.size ? "The result is not smaller than the original. Try a lower quality or a smaller size." : undefined;
      setResult({ blob: new Blob([data as BlobPart], { type: mime }), name: `${baseName(file.name)}${suffix}.${outExt}`, note });
    } catch (e) {
      setError(errorMessage(e));
      ffmpeg.current?.terminate();
      ffmpeg.current = null;
    } finally {
      if (ffmpeg.current && onProgress) ffmpeg.current.off("progress", onProgress);
      if (ffmpeg.current) {
        await ffmpeg.current.deleteFile(input).catch(() => {});
        await ffmpeg.current.deleteFile(output).catch(() => {});
      }
      setStatus(null);
    }
  }

  const reset = () => setResult(null);

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={kind === "audio-convert" ? "audio/*,video/*,.mkv,.flac" : "video/*,.mkv"}
        hint={
          kind === "audio-convert"
            ? "Any audio or video file up to 500 MB. Nothing is uploaded."
            : "MP4, MOV, WebM or MKV up to 500 MB. Nothing is uploaded."
        }
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

          {isAudio && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{kind === "audio-extract" ? "Save the audio as" : "Convert to"}</p>
              <Segmented
                label="Format"
                value={format}
                onChange={(v) => {
                  setFormat(v);
                  reset();
                }}
                options={(Object.keys(AUDIO) as AudioFormat[]).map((value) => ({ value, label: AUDIO[value].label }))}
              />
            </div>
          )}

          {kind === "video-trim" && (
            <>
              <div className="flex flex-wrap gap-4">
                <ToolField label="Start" htmlFor="ts" hint="Seconds or 1:30">
                  <Input id="ts" value={start} onChange={(e) => setStart(e.target.value)} className="w-32" />
                </ToolField>
                <ToolField label="End (empty = to the end)" htmlFor="te" hint="Seconds or 2:45">
                  <Input id="te" value={end} onChange={(e) => setEnd(e.target.value)} className="w-32" />
                </ToolField>
              </div>
              <Checkbox label="Exact cut (slower)" hint="Fast mode cuts at the nearest keyframe, which can be a second or two off." checked={precise} onCheckedChange={setPrecise} />
            </>
          )}

          {kind === "video-gif" && (
            <>
              <div className="flex flex-wrap gap-4">
                <ToolField label="Start" htmlFor="gs" hint="Seconds or 1:30">
                  <Input id="gs" value={start} onChange={(e) => setStart(e.target.value)} className="w-32" />
                </ToolField>
                <ToolField label="Length (seconds)" htmlFor="gl" hint="0.5 to 20">
                  <Input id="gl" type="number" min={0.5} max={20} step="0.5" value={length} onChange={(e) => setLength(e.target.value)} className="w-32" />
                </ToolField>
              </div>
              <div className="flex flex-wrap gap-8">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Size</p>
                  <Segmented label="Size" value={gifWidth} onChange={setGifWidth} options={GIF_WIDTHS} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Smoothness</p>
                  <Segmented label="Smoothness" value={fps} onChange={setFps} options={GIF_FPS} />
                </div>
              </div>
            </>
          )}

          {kind === "video-compress" && (
            <div className="flex flex-wrap gap-8">
              <div className="space-y-2">
                <p className="text-sm font-medium">Quality</p>
                <Segmented label="Quality" value={crf} onChange={setCrf} options={QUALITY} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Size</p>
                <Segmented label="Size" value={height} onChange={setHeight} options={HEIGHTS} />
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">This runs on your device, so it is slow for long files. Keep this tab open while it works.</p>
          <Button onClick={run} disabled={status !== null}>
            {status && <Loader2 className="animate-spin" aria-hidden />}
            {status ?? BUTTON[kind]}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {result && <ResultCard blob={result.blob} name={result.name} note={result.note ?? (kind === "video-compress" && file ? `Was ${formatBytes(file.size)}.` : undefined)} />}
    </div>
  );
}
