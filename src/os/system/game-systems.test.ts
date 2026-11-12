import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, MAX_NAME_LENGTH, sanitizeName, sanitizePrefs } from "../settings/prefs";
import { createDialogueStore, fillTemplate, visibleLength } from "./dialogue";
import { BEATS_PER_BAR, PROGRESSION, generateBar, midiToHz } from "./music";
import { SFX, createSoundEngine, type SfxName } from "./sound";

describe("dialogue store", () => {
  it("walks through pages and closes after the last", () => {
    const d = createDialogueStore();
    d.say([{ speaker: "A", text: "one" }, { speaker: "A", text: "two" }]);
    expect(d.state.get()?.index).toBe(0);
    d.advance();
    expect(d.state.get()?.index).toBe(1);
    d.advance();
    expect(d.state.get()).toBeNull();
  });

  it("accepts a plain string and ignores empty conversations", () => {
    const d = createDialogueStore();
    d.say("hello");
    expect(d.state.get()?.pages[0]).toEqual({ speaker: "", text: "hello" });
    d.say([]);
    expect(d.state.get()).toBeNull();
  });

  it("does not advance past a page with choices until one is chosen", () => {
    const d = createDialogueStore();
    const picked = vi.fn();
    d.say({ speaker: "A", text: "pick", choices: [{ label: "x", run: picked }, { label: "y", run: () => d.say("after") }] });
    d.advance();
    expect(d.state.get()).not.toBeNull();
    d.choose(0);
    expect(picked).toHaveBeenCalledOnce();
    expect(d.state.get()).toBeNull();
  });

  it("lets a choice start a follow-up dialogue", () => {
    const d = createDialogueStore();
    d.say({ speaker: "A", text: "pick", choices: [{ label: "more", run: () => d.say("second") }] });
    d.choose(0);
    expect(d.state.get()?.pages[0]?.text).toBe("second");
  });

  it("keepOpen choices leave the dialogue showing", () => {
    const d = createDialogueStore();
    d.say({ speaker: "A", text: "t", choices: [{ label: "stay", run: () => undefined, keepOpen: true }] });
    d.choose(0);
    expect(d.state.get()).not.toBeNull();
  });

  it("ignores out-of-range choices and closing when nothing is open", () => {
    const d = createDialogueStore();
    expect(() => {
      d.choose(3);
      d.advance();
      d.close();
    }).not.toThrow();
    d.say({ speaker: "A", text: "t", choices: [{ label: "x", run: () => undefined }] });
    d.choose(9);
    expect(d.state.get()).not.toBeNull();
  });
});

describe("typewriter helpers", () => {
  it("reveals characters over time and never exceeds the text", () => {
    expect(visibleLength(10, 0, 40)).toBe(0);
    expect(visibleLength(10, 100, 40)).toBe(4);
    expect(visibleLength(10, 10_000, 40)).toBe(10);
  });
  it("shows everything immediately when the speed is zero (reduced motion)", () => {
    expect(visibleLength(25, 0, 0)).toBe(25);
  });
  it("fills name templates and leaves unknown ones alone", () => {
    expect(fillTemplate("Hi {name}! {x}", { name: "Ada" })).toBe("Hi Ada! {x}");
  });
});

describe("music generator", () => {
  it("is deterministic for a bar and seed", () => {
    expect(generateBar(3, 7)).toEqual(generateBar(3, 7));
    expect(generateBar(3, 7)).not.toEqual(generateBar(3, 8));
  });

  it("loops through the chord progression", () => {
    for (let bar = 0; bar < 8; bar++) {
      const pad = generateBar(bar).filter((n) => n.part === "pad").map((n) => n.midi);
      expect(pad).toEqual([...PROGRESSION[bar % PROGRESSION.length]!]);
    }
  });

  it("keeps every note inside the bar and at a sensible loudness", () => {
    for (let bar = 0; bar < 16; bar++) {
      for (const n of generateBar(bar)) {
        expect(n.at).toBeGreaterThanOrEqual(0);
        expect(n.at).toBeLessThan(BEATS_PER_BAR);
        expect(n.beats).toBeGreaterThan(0);
        expect(n.gain).toBeGreaterThan(0);
        expect(n.gain).toBeLessThanOrEqual(0.1);
        expect(n.midi).toBeGreaterThan(20);
        expect(n.midi).toBeLessThan(100);
      }
    }
  });

  it("converts MIDI to frequency", () => {
    expect(midiToHz(69)).toBeCloseTo(440, 5);
    expect(midiToHz(57)).toBeCloseTo(220, 5);
  });
});

describe("sound effects", () => {
  it("defines every effect with sane tones", () => {
    for (const [name, tones] of Object.entries(SFX) as [SfxName, (typeof SFX)[SfxName]][]) {
      expect(tones.length, name).toBeGreaterThan(0);
      for (const t of tones) {
        expect(t.f, name).toBeGreaterThan(50);
        expect(t.d, name).toBeGreaterThan(0);
        expect(t.d, name).toBeLessThan(0.5);
        expect(t.gain ?? 0.05, name).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it("does nothing, and never creates audio, while sound is off", () => {
    const Ctor = vi.fn();
    vi.stubGlobal("AudioContext", Ctor);
    const engine = createSoundEngine(() => false);
    engine.play("click");
    expect(Ctor).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not throw when the browser has no Web Audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => createSoundEngine(() => true).play("click")).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("preferences", () => {
  it("returns defaults for garbage", () => {
    for (const junk of [undefined, null, 5, "x", [], {}]) expect(sanitizePrefs(junk)).toEqual(DEFAULT_PREFS);
  });

  it("keeps valid fields and replaces invalid ones individually", () => {
    const p = sanitizePrefs({ prefs: { theme: "forest", hoodie: "nonsense", sound: false, crt: "yes", musicVolume: 7, motion: "reduce", clock24h: true } });
    expect(p).toMatchObject({ theme: "forest", hoodie: DEFAULT_PREFS.hoodie, sound: false, crt: DEFAULT_PREFS.crt, musicVolume: 1, motion: "reduce", clock24h: true });
  });

  it("ignores fields from older versions", () => {
    const p = sanitizePrefs({ theme: "dark", accent: "indigo", wallpaper: "aurora", taskbarPosition: "top", iconPositions: { a: { col: 1, row: 1 } } });
    expect(p.theme).toBe(DEFAULT_PREFS.theme);
    expect(Object.keys(p).sort()).toEqual(Object.keys(DEFAULT_PREFS).sort());
  });

  it("cleans player names", () => {
    expect(sanitizeName("  Ada   Lovelace  ")).toBe("Ada Lovelace");
    expect(sanitizeName("<b>x</b>")).toBe("bx/b");
    expect(sanitizeName("a".repeat(100))).toHaveLength(MAX_NAME_LENGTH);
    expect(sanitizeName("\u0000\u0007")).toBe(DEFAULT_PREFS.playerName);
    expect(sanitizeName("   ")).toBe(DEFAULT_PREFS.playerName);
    expect(sanitizeName(42)).toBe(DEFAULT_PREFS.playerName);
  });
});
