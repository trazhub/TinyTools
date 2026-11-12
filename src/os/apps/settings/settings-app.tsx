"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Accessibility, Check, HardDrive, Info, Keyboard, Palette, RotateCcw, User, Volume2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Segmented } from "@/components/ui/form";
import { cn, formatBytes } from "@/lib/utils";
import { HOODIES, ROOM_THEMES } from "../../pixel/palette";
import { PixelProvider, PixelIcon } from "../../pixel/pixel-context";
import { MAX_NAME_LENGTH, sanitizeName, type MotionMode } from "../../settings/prefs";
import { useFsVersion, useKernel, usePrefs } from "../../system/kernel-context";
import { OS_NAME, OS_TAGLINE, OS_VERSION } from "../../version";

type SectionId = "room" | "sound" | "accessibility" | "player" | "storage" | "shortcuts" | "about";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "room", label: "Room", icon: Palette },
  { id: "sound", label: "Sound & effects", icon: Volume2 },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
  { id: "player", label: "You", icon: User },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "about", label: "About", icon: Info },
];

export default function SettingsApp() {
  const [section, setSection] = useState<SectionId>("room");

  return (
    <div className="@container flex h-full flex-col @2xl:flex-row" data-testid="settings">
      <nav aria-label="Settings sections" className="flex shrink-0 gap-1 overflow-x-auto border-b-2 border-border bg-muted/40 p-2 @2xl:w-52 @2xl:flex-col @2xl:overflow-visible @2xl:border-b-0 @2xl:border-r-2">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={section === id ? "page" : undefined}
            onClick={() => setSection(id)}
            className={cn(
              "font-pixel flex shrink-0 items-center gap-2.5 px-3 py-2 text-left text-[15px] font-semibold",
              section === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-xl space-y-7">
          {section === "room" && <RoomSettings />}
          {section === "sound" && <SoundSettings />}
          {section === "accessibility" && <AccessibilitySettings />}
          {section === "player" && <PlayerSettings />}
          {section === "storage" && <StorageSettings />}
          {section === "shortcuts" && <Shortcuts />}
          {section === "about" && <About />}
        </div>
      </div>
    </div>
  );
}

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-pixel text-[19px] font-bold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function RoomSettings() {
  const kernel = useKernel();
  const prefs = usePrefs();

  return (
    <>
      <Group title="Room theme" description="The same room in different light. This changes the artwork and every window.">
        <div role="radiogroup" aria-label="Room theme" className="grid gap-3 @lg:grid-cols-2">
          {ROOM_THEMES.map((t) => {
            const selected = prefs.theme === t.id;
            const swatch = [t.ramp.n9, t.ramp.n7, t.ramp.p4, t.ramp.b4, t.ramp.b2, "#ffc866"];
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  kernel.prefs.set({ theme: t.id });
                  kernel.sfx("select");
                }}
                className={cn("space-y-2 p-3 text-left", selected ? "bg-accent outline outline-[3px] -outline-offset-3 outline-primary" : "bg-card hover:bg-muted")}
              >
                <span className="flex h-8">
                  {swatch.map((c) => (
                    <span key={c} className="flex-1" style={{ background: c }} />
                  ))}
                </span>
                <span className="font-pixel flex items-center gap-2 text-[16px] font-bold">
                  {t.name}
                  {selected && <Check className="size-4 text-primary" aria-hidden />}
                </span>
                <span className="block text-xs text-muted-foreground">{t.blurb}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Lights">
        <Checkbox
          label="Lights off"
          hint="Only the desk lamp and the moon light the room. You can also press the bed."
          checked={prefs.lightsOff}
          onCheckedChange={(lightsOff) => {
            kernel.prefs.set({ lightsOff });
            kernel.sfx("switch");
          }}
        />
      </Group>
    </>
  );
}

function SoundSettings() {
  const kernel = useKernel();
  const prefs = usePrefs();
  return (
    <>
      <Group title="Sound" description="Chunky little beeps for clicks and windows. Music and ambient sounds only play when you start them.">
        <Checkbox label="Sound effects and audio" checked={prefs.sound} onCheckedChange={(sound) => { kernel.prefs.set({ sound }); if (sound) kernel.sfx("select"); }} hint="The same as the speaker button at the top of the room. Turning it off also silences music." />
        <label className="mt-2 grid gap-1 text-sm font-medium">
          Music and ambient volume
          <input
            type="range"
            className="range"
            min={0}
            max={100}
            value={Math.round(prefs.musicVolume * 100)}
            onChange={(e) => kernel.prefs.set({ musicVolume: Number(e.target.value) / 100 })}
            aria-valuetext={`${Math.round(prefs.musicVolume * 100)} percent`}
          />
        </label>
      </Group>

      <Group title="Screen effect">
        <Checkbox label="CRT scanlines and vignette" hint="A subtle old-monitor look over the whole screen. Turn it off for a perfectly clean picture." checked={prefs.crt} onCheckedChange={(crt) => kernel.prefs.set({ crt })} />
      </Group>
    </>
  );
}

function AccessibilitySettings() {
  const kernel = useKernel();
  const prefs = usePrefs();
  return (
    <>
      <Group title="Motion" description="Cats breathe, lamps flicker, dust floats and text types itself. Reduce this if animation bothers you.">
        <Segmented<MotionMode>
          label="Motion"
          value={prefs.motion}
          onChange={(motion) => kernel.prefs.set({ motion })}
          options={[
            { value: "system", label: "Follow system" },
            { value: "reduce", label: "Reduced" },
            { value: "full", label: "Full" },
          ]}
        />
        <p className="text-xs text-muted-foreground">“Follow system” respects your device&rsquo;s reduced-motion setting. With reduced motion, text appears instantly and scenes become still images.</p>
      </Group>
      <Group title="Keyboard and touch" description="Everything in the room is a real button. Tab moves left to right through the objects, Enter opens one. On phones, the strip at the bottom has a button for each object.">
        <p className="text-sm text-muted-foreground">Text in windows uses a plain, readable font. The pixel font is only used for headings and dialogue.</p>
      </Group>
    </>
  );
}

function PlayerSettings() {
  const kernel = useKernel();
  const prefs = usePrefs();
  const [name, setName] = useState(prefs.playerName);

  const save = () => {
    const clean = sanitizeName(name);
    setName(clean);
    if (clean !== prefs.playerName) {
      kernel.prefs.set({ playerName: clean });
      kernel.sfx("select");
    }
  };

  return (
    <>
      <Group title="Your name" description="What the little character in the room calls you. It stays on this device.">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input aria-label="Your name" value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} onBlur={save} />
          <Button type="submit" variant="secondary">
            Save
          </Button>
        </form>
      </Group>

      <Group title="Hoodie" description="Pick a colour. The character in the room changes right away.">
        <div role="radiogroup" aria-label="Hoodie colour" className="flex flex-wrap gap-3">
          {HOODIES.map((h) => {
            const selected = prefs.hoodie === h.id;
            return (
              <button
                key={h.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={h.name}
                title={h.name}
                onClick={() => {
                  kernel.prefs.set({ hoodie: h.id });
                  kernel.sfx("pop");
                }}
                className={cn("grid size-11 place-items-center", selected ? "outline outline-[3px] outline-offset-2 outline-primary" : "")}
                style={{ background: h.base, boxShadow: `inset 0 -4px 0 0 ${h.shade}, 0 0 0 2px var(--px-bd)` }}
              >
                {selected && <Check className="size-5 text-white" aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="px-frame mt-2 grid size-[84px] place-items-center bg-[var(--px-title)]" aria-hidden>
          <PixelProvider themeId={prefs.theme} hoodieId={prefs.hoodie}>
            <PixelIcon id="portrait" scale={3} />
          </PixelProvider>
        </div>
      </Group>

      <Group title="Clock">
        <Segmented<"12" | "24">
          label="Time format"
          value={prefs.clock24h ? "24" : "12"}
          onChange={(v) => kernel.prefs.set({ clock24h: v === "24" })}
          options={[
            { value: "12", label: "12-hour" },
            { value: "24", label: "24-hour" },
          ]}
        />
        <p className="text-xs text-muted-foreground">Used by the alarm clock on the nightstand and the Window View. You can also press the clock.</p>
      </Group>
    </>
  );
}

function StorageSettings() {
  const kernel = useKernel();
  useFsVersion();
  const { fs } = kernel;
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null | "unavailable">(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const storage = navigator.storage;
    if (!storage?.estimate) {
      Promise.resolve().then(() => !cancelled && setEstimate("unavailable"));
      return;
    }
    storage.estimate().then(
      (e) => !cancelled && setEstimate({ usage: e.usage, quota: e.quota }),
      () => !cancelled && setEstimate("unavailable"),
    );
    storage.persisted?.().then((p) => !cancelled && setPersisted(p), () => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const requestPersist = async () => {
    try {
      const granted = (await navigator.storage?.persist?.()) ?? false;
      setPersisted(granted);
      kernel.notify(
        granted
          ? { tone: "success", message: "Your browser promised to keep your files unless you clear them yourself." }
          : { tone: "warning", message: "Your browser didn't grant persistent storage. Your files are still saved, but it may clear them if the device runs low on space." },
      );
    } catch {
      kernel.notify({ tone: "error", message: "Couldn't ask the browser for persistent storage." });
    }
  };

  const erase = async () => {
    const ok = await kernel.confirm({
      title: "Erase all files and notes?",
      message: "This permanently deletes everything in the virtual filesystem, including the Trash, and recreates the default folders. It cannot be undone. Settings are kept.",
      confirmLabel: "Erase everything",
      danger: true,
    });
    if (!ok) return;
    await fs.reset();
    kernel.notify({ tone: "success", message: "All files were erased." });
  };

  return (
    <>
      <Group title="Where your data lives" description="Files and notes are stored inside this browser (IndexedDB). Settings use localStorage. Nothing is sent to a server.">
        <dl className="divide-y-2 divide-border bg-card text-sm">
          <Row label="Saving files" value={fs.persistent ? "Working" : "Not available: files will be lost when this tab closes"} warn={!fs.persistent} />
          <Row label="Files in TinyTools OS" value={formatBytes(fs.usage())} />
          <Row label="Items in Trash" value={String(fs.trashCount())} />
          <Row
            label="Browser storage used"
            value={
              estimate === "unavailable"
                ? "Your browser doesn't report this"
                : estimate === null
                  ? "Checking…"
                  : estimate.usage !== undefined && estimate.quota !== undefined
                    ? `${formatBytes(estimate.usage)} of about ${formatBytes(estimate.quota)} (an estimate; includes everything this site stores)`
                    : "Unknown"
            }
          />
          <Row label="Protected from clearing" value={persisted === null ? "Unknown" : persisted ? "Yes" : "No (the browser may clear it if space runs low)"} />
        </dl>
        {persisted === false && (
          <Button variant="outline" size="sm" onClick={requestPersist}>
            Ask the browser to keep my files
          </Button>
        )}
      </Group>

      <Group title="Reset">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const ok = await kernel.confirm({ title: "Reset all settings?", message: "Theme, sound, effects, your name and hoodie go back to the defaults. Your files are not touched.", confirmLabel: "Reset settings" });
                if (ok) {
                  kernel.prefs.reset();
                  kernel.notify({ tone: "success", message: "Settings were reset to the defaults." });
                }
              }}
            >
              <RotateCcw aria-hidden /> Reset settings
            </Button>
            <p className="text-xs text-muted-foreground">Keeps your files.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="destructive" size="sm" onClick={erase}>
              Erase all files…
            </Button>
            <p className="text-xs text-muted-foreground">Deletes everything in File Explorer, Notes and the Trash.</p>
          </div>
        </div>
      </Group>
    </>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium", warn && "text-warning")}>{value}</dd>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Click · Tap · Enter", "Use any object in the room (Tab moves between them)"],
  ["Ctrl/⌘ + K", "Open or close the computer's app launcher"],
  ["Alt + ` (backtick)", "Switch windows: hold Alt and press ` repeatedly, release to switch"],
  ["Alt + Tab", "Same, on systems that let the browser see it (most reserve it)"],
  ["Esc", "Close menus, the launcher, dialogue and dialogs"],
  ["Enter · Space (dialogue)", "Finish typing the line, then go to the next"],
  ["F2 · Delete · Ctrl+C/X/V (File Explorer)", "Rename, move to Trash, copy, cut, paste"],
  ["Alt + N (Notes)", "New note"],
  ["Arrows or WASD (Snake)", "Steer. Space pauses"],
  ["↑ ↓ · Tab · Ctrl+L (Terminal)", "History, completion, clear screen"],
];

function Shortcuts() {
  return (
    <Group title="Keyboard shortcuts" description="TinyTools OS avoids shortcuts your browser already uses (Ctrl+W, Ctrl+T, F5…), so it never gets in the way.">
      <dl className="divide-y-2 divide-border bg-card text-sm">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={keys} className="grid gap-1 px-4 py-2.5 @lg:grid-cols-[220px_1fr] @lg:gap-4">
            <dt>
              <kbd className="font-pixel bg-muted px-1.5 py-0.5 text-[13px] font-semibold">{keys}</kbd>
            </dt>
            <dd className="text-muted-foreground">{what}</dd>
          </div>
        ))}
      </dl>
    </Group>
  );
}

function About() {
  return (
    <>
      <Group title={OS_NAME}>
        <p className="text-sm text-muted-foreground">
          {OS_TAGLINE} Version {OS_VERSION}. A free, cozy computer that lives in your browser.
        </p>
      </Group>
      <Group title="Privacy">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>No account, ads, analytics or tracking scripts.</li>
          <li>Files, notes and settings stay in this browser. TinyTools OS has no server that receives them.</li>
          <li>The artwork, sounds and music are drawn and synthesised in your browser. Fonts are bundled, not loaded from anywhere else.</li>
          <li>Once loaded, the room keeps working offline.</li>
        </ul>
      </Group>
      <Group title="Honest limits">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>The file system is virtual. It cannot see or change the real files on your computer unless you import or export them yourself.</li>
          <li>The Terminal is a simulation. It only understands TinyTools OS commands and never runs programs on your computer.</li>
          <li>Clearing this site&rsquo;s data in your browser deletes your files. Export anything important.</li>
        </ul>
      </Group>
    </>
  );
}
