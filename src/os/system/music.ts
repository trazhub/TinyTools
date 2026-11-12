import { rng } from "../pixel/sprites";

/**
 * A tiny generative lo-fi player. It composes a few bars at a time from a chord
 * progression and a pentatonic melody, and plays them with Web Audio oscillators.
 * Nothing is downloaded; it is a toy, but a pleasant one.
 */

export interface MusicNote {
  /** MIDI note number. */
  midi: number;
  /** Start time in beats from the start of the bar. */
  at: number;
  /** Length in beats. */
  beats: number;
  part: "pad" | "bass" | "melody";
  gain: number;
}

export const BEATS_PER_BAR = 4;
export const BPM = 68;

// Am7 - Fmaj7 - Cmaj7 - G6, one chord per bar.
export const PROGRESSION: readonly (readonly number[])[] = [
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [48, 55, 59, 64],
  [55, 59, 62, 64],
];
const BASS_ROOTS = [45, 41, 36, 43];
const MELODY_SCALE = [69, 72, 74, 76, 79, 81, 84]; // A minor pentatonic

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Notes for one bar. Deterministic for a given bar number and seed. */
export function generateBar(bar: number, seed = 1): MusicNote[] {
  const chord = PROGRESSION[bar % PROGRESSION.length]!;
  const rand = rng(seed * 1000 + bar);
  const notes: MusicNote[] = chord.map((midi) => ({ midi, at: 0, beats: BEATS_PER_BAR, part: "pad", gain: 0.035 }));
  const root = BASS_ROOTS[bar % BASS_ROOTS.length]!;
  notes.push({ midi: root, at: 0, beats: 1.5, part: "bass", gain: 0.09 }, { midi: root, at: 2.5, beats: 1, part: "bass", gain: 0.07 });
  let step = Math.floor(rand() * MELODY_SCALE.length);
  for (let beat = 0; beat < BEATS_PER_BAR; beat += 0.5) {
    if (rand() < 0.42) continue; // rests keep it relaxed
    step = Math.min(MELODY_SCALE.length - 1, Math.max(0, step + Math.floor(rand() * 3) - 1));
    notes.push({ midi: MELODY_SCALE[step]!, at: beat, beats: 0.5 + (rand() < 0.3 ? 0.5 : 0), part: "melody", gain: 0.03 });
  }
  return notes;
}

export interface MusicPlayer {
  start(): void;
  stop(): void;
  setVolume(volume: number): void;
  isPlaying(): boolean;
  subscribe(listener: () => void): () => void;
}

export function createMusicPlayer(getContext: () => AudioContext | null, getVolume: () => number): MusicPlayer {
  let timer: ReturnType<typeof setInterval> | undefined;
  let master: GainNode | null = null;
  let nextBarTime = 0;
  let bar = 0;
  let playing = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const secondsPerBeat = 60 / BPM;

  const schedule = (ctx: AudioContext, out: AudioNode, notes: MusicNote[], barStart: number) => {
    for (const n of notes) {
      const t0 = barStart + n.at * secondsPerBeat;
      const dur = n.beats * secondsPerBeat;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.part === "bass" ? "sine" : n.part === "pad" ? "triangle" : "square";
      osc.frequency.value = midiToHz(n.midi);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(n.gain, t0 + (n.part === "pad" ? 0.4 : 0.02));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let node: AudioNode = gain;
      if (n.part === "melody") {
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1400;
        gain.connect(filter);
        node = filter;
      }
      osc.connect(gain);
      node.connect(out);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }
  };

  const tick = () => {
    const ctx = getContext();
    if (!ctx || !master) return;
    // Keep about two bars scheduled ahead.
    while (nextBarTime < ctx.currentTime + BEATS_PER_BAR * secondsPerBeat * 1.5) {
      schedule(ctx, master, generateBar(bar++), nextBarTime);
      nextBarTime += BEATS_PER_BAR * secondsPerBeat;
    }
  };

  return {
    start() {
      if (playing) return;
      const ctx = getContext();
      if (!ctx) return;
      void ctx.resume().catch(() => undefined);
      master = ctx.createGain();
      master.gain.value = getVolume();
      master.connect(ctx.destination);
      nextBarTime = ctx.currentTime + 0.1;
      bar = 0;
      playing = true;
      tick();
      timer = setInterval(tick, 400);
      emit();
    },
    stop() {
      if (!playing) return;
      clearInterval(timer);
      const m = master;
      const ctx = getContext();
      if (m && ctx) {
        m.gain.cancelScheduledValues(ctx.currentTime);
        m.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
        setTimeout(() => m.disconnect(), 800);
      }
      master = null;
      playing = false;
      emit();
    },
    setVolume(volume) {
      const ctx = getContext();
      if (master && ctx) master.gain.setTargetAtTime(Math.min(1, Math.max(0, volume)), ctx.currentTime, 0.05);
    },
    isPlaying: () => playing,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
