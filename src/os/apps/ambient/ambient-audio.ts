import type { SceneInfo } from "./scenes";

type AmbientSound = NonNullable<SceneInfo["sound"]>;

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

/**
 * Start a generated ambient sound (rain, wind or crickets) and return a function that stops it.
 * Everything is synthesised from noise and oscillators; nothing is downloaded.
 */
export function startAmbientSound(ctx: AudioContext, kind: AmbientSound, volume: number): () => void {
  const out = ctx.createGain();
  out.gain.value = 0.0001;
  out.gain.setTargetAtTime(volume, ctx.currentTime, 0.4);
  out.connect(ctx.destination);
  const sources: (AudioScheduledSourceNode | { stop(): void })[] = [];

  if (kind === "rain" || kind === "wind") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 4, kind === "wind");
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = kind === "rain" ? "bandpass" : "lowpass";
    filter.frequency.value = kind === "rain" ? 2400 : 380;
    filter.Q.value = kind === "rain" ? 0.4 : 0.7;
    const gain = ctx.createGain();
    gain.gain.value = kind === "rain" ? 0.5 : 0.8;
    src.connect(filter).connect(gain).connect(out);
    src.start();
    sources.push(src);
    if (kind === "wind") {
      // Slow gusts.
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.12;
      depth.gain.value = 0.35;
      lfo.connect(depth).connect(gain.gain);
      lfo.start();
      sources.push(lfo);
    }
  } else {
    // Crickets: a high tone chopped by a fast square-wave LFO.
    const tone = ctx.createOscillator();
    tone.frequency.value = 4300;
    const amp = ctx.createGain();
    amp.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 7;
    const depth = ctx.createGain();
    depth.gain.value = 0.12;
    lfo.connect(depth).connect(amp.gain);
    tone.connect(amp).connect(out);
    tone.start();
    lfo.start();
    sources.push(tone, lfo);
  }

  return () => {
    out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
    setTimeout(() => {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          // already stopped
        }
      }
      out.disconnect();
    }, 700);
  };
}
