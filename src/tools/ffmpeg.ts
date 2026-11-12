import { vendorUrl } from "./shared";

/** The few parts of ffmpeg.wasm (@ffmpeg/ffmpeg 0.12) used here. Declared locally because the package types pull in worker typings. */
export interface FFmpeg {
  load(config: { classWorkerURL: string; coreURL: string; wasmURL: string }): Promise<boolean>;
  exec(args: string[]): Promise<number>;
  writeFile(path: string, data: Uint8Array): Promise<boolean>;
  readFile(path: string): Promise<Uint8Array | string>;
  deleteFile(path: string): Promise<boolean>;
  on(event: "progress", cb: (e: { progress: number }) => void): void;
  off(event: "progress", cb: (e: { progress: number }) => void): void;
  terminate(): void;
}

/**
 * Start ffmpeg. It is loaded from our own origin at runtime (not bundled): ffmpeg starts its own
 * worker from these files. The core is about 30 MB, so call this only when the user asks for work.
 */
export async function loadFFmpeg(): Promise<FFmpeg> {
  const lib: { FFmpeg: new () => FFmpeg } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ vendorUrl("ffmpeg/lib/index.js"));
  const ff = new lib.FFmpeg();
  await ff.load({
    classWorkerURL: vendorUrl("ffmpeg/lib/worker.js"),
    coreURL: vendorUrl("ffmpeg/ffmpeg-core.js"),
    wasmURL: vendorUrl("ffmpeg/ffmpeg-core.wasm"),
  });
  return ff;
}

/** A safe input file name for ffmpeg: keeps only the extension of the original name. */
export function inputName(file: File): string {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).replace(/[^.\w]/g, "") : "";
  return `input${ext}`;
}
