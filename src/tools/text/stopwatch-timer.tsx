"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Segmented } from "@/components/ui/form";
import { ToolField } from "@/components/tool/tool-field";

function format(ms: number, hundredths: boolean): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const base = `${h > 0 ? h + ":" : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
  return hundredths ? `${base}.${String(Math.floor((total % 1000) / 10)).padStart(2, "0")}` : base;
}

/** Counts time while running. Elapsed time is measured from timestamps, so it stays right even if the tab is slow. */
function useClock() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const base = useRef(0); // elapsed time before the current run
  const startedAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(base.current + performance.now() - startedAt.current), 50);
    return () => clearInterval(id);
  }, [running]);

  return {
    elapsed,
    running,
    start() {
      startedAt.current = performance.now();
      setRunning(true);
    },
    pause() {
      base.current += performance.now() - startedAt.current;
      setElapsed(base.current);
      setRunning(false);
    },
    reset() {
      base.current = 0;
      setElapsed(0);
      setRunning(false);
    },
  };
}

export default function StopwatchTimer() {
  const [mode, setMode] = useState<string>("stopwatch");
  const [minutes, setMinutes] = useState("5");
  const clock = useClock();
  const [laps, setLaps] = useState<number[]>([]);

  const total = Math.max(0, Math.round((Number(minutes) || 0) * 60_000));
  const remaining = total - clock.elapsed;
  const finished = mode === "timer" && total > 0 && remaining <= 0;
  const shown = mode === "stopwatch" ? format(clock.elapsed, true) : format(Math.ceil(Math.max(0, remaining) / 1000) * 1000, false);

  // Stop at zero.
  useEffect(() => {
    if (finished && clock.running) clock.pause();
  }, [finished, clock]);

  function switchMode(m: string) {
    clock.reset();
    setLaps([]);
    setMode(m);
  }

  return (
    <div className="space-y-6">
      <Segmented
        label="Mode"
        value={mode}
        onChange={switchMode}
        options={[
          { value: "stopwatch", label: "Stopwatch" },
          { value: "timer", label: "Timer" },
        ]}
      />
      {mode === "timer" && (
        <ToolField label="Minutes" htmlFor="tm">
          <Input id="tm" type="number" min={0} step="0.5" value={minutes} onChange={(e) => { clock.reset(); setMinutes(e.target.value); }} className="w-28" />
        </ToolField>
      )}
      <p className="font-mono text-6xl tabular-nums" role="timer" aria-live="off">
        {shown}
      </p>
      {finished && (
        <p role="status" className="text-lg font-medium">
          Time is up.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {clock.running ? (
          <Button onClick={clock.pause}>
            <Pause aria-hidden /> Pause
          </Button>
        ) : (
          <Button onClick={clock.start} disabled={mode === "timer" && (total === 0 || finished)}>
            <Play aria-hidden /> {clock.elapsed > 0 ? "Resume" : "Start"}
          </Button>
        )}
        {mode === "stopwatch" && (
          <Button variant="outline" disabled={!clock.running} onClick={() => setLaps((l) => [...l, clock.elapsed])}>
            Lap
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            clock.reset();
            setLaps([]);
          }}
        >
          <RotateCcw aria-hidden /> Reset
        </Button>
      </div>
      {laps.length > 0 && (
        <ol className="max-w-xs border-t border-foreground">
          {laps.map((l, i) => (
            <li key={i} className="flex justify-between border-b border-foreground py-1 font-mono text-sm tabular-nums">
              <span>Lap {i + 1}</span>
              <span>{format(l, true)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
