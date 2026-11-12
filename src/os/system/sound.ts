/**
 * Sound effects, synthesised with the Web Audio API (no audio files are shipped or
 * downloaded). Sounds only play when the user has them turned on, and the audio
 * context is created lazily after the first click, as browsers require.
 */

export type SfxName = "click" | "open" | "close" | "select" | "pop" | "meow" | "water" | "switch" | "error" | "type";

export interface Tone {
  /** Frequency in Hz. */
  f: number;
  /** Seconds after the sound starts. */
  at: number;
  /** Duration in seconds. */
  d: number;
  wave?: OscillatorType;
  gain?: number;
  /** Frequency to glide to by the end of the tone. */
  to?: number;
}

export const SFX: Record<SfxName, Tone[]> = {
  click: [{ f: 520, at: 0, d: 0.05, wave: "square", gain: 0.05 }],
  select: [{ f: 660, at: 0, d: 0.05, wave: "square", gain: 0.05 }, { f: 880, at: 0.05, d: 0.07, wave: "square", gain: 0.05 }],
  open: [{ f: 392, at: 0, d: 0.06, wave: "square", gain: 0.05 }, { f: 523, at: 0.06, d: 0.06, wave: "square", gain: 0.05 }, { f: 784, at: 0.12, d: 0.1, wave: "square", gain: 0.05 }],
  close: [{ f: 784, at: 0, d: 0.06, wave: "square", gain: 0.05 }, { f: 523, at: 0.06, d: 0.06, wave: "square", gain: 0.05 }, { f: 330, at: 0.12, d: 0.1, wave: "square", gain: 0.05 }],
  pop: [{ f: 300, to: 700, at: 0, d: 0.08, wave: "triangle", gain: 0.08 }],
  meow: [{ f: 520, to: 880, at: 0, d: 0.12, wave: "triangle", gain: 0.08 }, { f: 880, to: 420, at: 0.12, d: 0.2, wave: "triangle", gain: 0.07 }],
  water: [{ f: 900, to: 400, at: 0, d: 0.07, wave: "sine", gain: 0.06 }, { f: 800, to: 350, at: 0.09, d: 0.07, wave: "sine", gain: 0.05 }, { f: 1000, to: 450, at: 0.18, d: 0.07, wave: "sine", gain: 0.05 }],
  switch: [{ f: 180, at: 0, d: 0.04, wave: "square", gain: 0.07 }, { f: 120, at: 0.04, d: 0.06, wave: "square", gain: 0.05 }],
  error: [{ f: 220, at: 0, d: 0.1, wave: "sawtooth", gain: 0.05 }, { f: 160, at: 0.1, d: 0.14, wave: "sawtooth", gain: 0.05 }],
  type: [{ f: 1200, at: 0, d: 0.015, wave: "square", gain: 0.012 }],
};

export interface SoundEngine {
  play(name: SfxName): void;
  /** The shared audio context, once created (also used by the music player and ambient scenes). */
  context(): AudioContext | null;
}

export function createSoundEngine(isEnabled: () => boolean): SoundEngine {
  let ctx: AudioContext | null = null;

  const ensure = (): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  };

  return {
    play(name) {
      if (!isEnabled()) return;
      try {
        const audio = ensure();
        if (!audio) return;
        const start = audio.currentTime;
        for (const tone of SFX[name]) {
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          const t0 = start + tone.at;
          osc.type = tone.wave ?? "square";
          osc.frequency.setValueAtTime(tone.f, t0);
          if (tone.to) osc.frequency.linearRampToValueAtTime(tone.to, t0 + tone.d);
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.linearRampToValueAtTime(tone.gain ?? 0.05, t0 + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.d);
          osc.connect(gain).connect(audio.destination);
          osc.start(t0);
          osc.stop(t0 + tone.d + 0.02);
        }
      } catch {
        // Audio is a nicety: never let it break the app.
      }
    },
    context: () => ctx ?? ensure(),
  };
}
