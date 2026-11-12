import { HOODIES, findHoodie } from "../pixel/palette";
import { sanitizeName } from "../settings/prefs";
import type { DialoguePage } from "../system/dialogue";
import type { Kernel } from "../system/kernel";
import type { PlacedItem, RoomAction } from "./layout";

/** Which app each app-opening object launches. Every one of these is a real, working app. */
export const OBJECT_APPS: Partial<Record<RoomAction, string>> = {
  bookshelf: "explorer",
  notebook: "notes",
  window: "ambient",
  record: "music",
  handheld: "snake",
};

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

const CAT_LINES: Record<string, { name: string; lines: string[] }> = {
  "cat-bed": { name: "Mochi", lines: ["Mochi purrs softly and kneads the blanket.", "Mochi opens one eye, then goes right back to sleep.", "Mochi stretches. Very cozy."] },
  "cat-cushion": { name: "Biscuit", lines: ["Biscuit rolls over for tummy rubs. (It's a trap.)", "Biscuit chirps happily.", "Biscuit presses a warm paw against your hand."] },
  "cat-shelf": { name: "Pixel", lines: ["Pixel looks down from the shelf like a tiny king.", "Pixel blinks slowly. That means 'I trust you'.", "Pixel knocks nothing off the shelf. Today."] },
};

const POSTER_LINES: Record<string, string> = {
  "poster-mountain": "A poster of a mountain under a crescent moon. The caption says PIXEL. Someday you'll climb it.",
  "poster-sign": "DREAM. BUILD. PLAY. Good rules for a computer, too.",
  "poster-sunset": "A sunset over still water. It's always golden hour in here.",
  "poster-planet": "A ringed planet. Somewhere out there is a computer just like this one.",
};

/** Tour stops, in order: the object to point at and what to say about it. */
const TOUR: { id: string; text: string }[] = [
  { id: "computer", text: "The computer is the main launcher. Every app lives there: the terminal, calculator, settings and more." },
  { id: "bookshelf", text: "The bookshelf is your File Explorer: folders, files, a Trash, and import and export." },
  { id: "notebook", text: "The notebook on the floor opens Notes. It saves as you type and understands Markdown." },
  { id: "window", text: "The window is the Ambient app: rain, snow, fireflies and a quiet night city." },
  { id: "record-player", text: "The record player plays gentle lo-fi music, made up on the spot." },
  { id: "handheld", text: "And that little handheld? A game of Snake. Beat your own high score!" },
];

function time(kernel: Kernel) {
  const now = new Date();
  return now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: !kernel.prefs.get().clock24h });
}

function say(kernel: Kernel, pages: DialoguePage | DialoguePage[] | string) {
  kernel.dialogue.say(pages);
}

function playerPage(kernel: Kernel, text: string, extra: Partial<DialoguePage> = {}): DialoguePage {
  return { speaker: kernel.prefs.get().playerName, portrait: true, text, ...extra };
}

function chat(kernel: Kernel) {
  const name = kernel.prefs.get().playerName;
  const back = () => chat(kernel);
  say(
    kernel,
    playerPage(kernel, `Hi, I'm ${name}! Welcome to your little computer. What would you like to know?`, {
      choices: [
        {
          label: "What can I do here?",
          run: () =>
            say(kernel, [
              playerPage(kernel, "Everything in this room is real. Click an object to open the app that lives inside it."),
              playerPage(kernel, "Or press the computer to see all the apps at once. You can also press Ctrl+K anywhere.", { choices: [{ label: "Thanks!", run: () => undefined }, { label: "Anything else?", run: back }] }),
            ]),
        },
        { label: "Show me around", run: () => tour(kernel) },
        {
          label: "Where are my files?",
          run: () =>
            say(
              kernel,
              playerPage(kernel, "Right here, in this browser. Files, notes and settings are saved on your device. There's no account and nothing is uploaded. If you clear this site's data, they'll be erased, so export anything important!", { choices: [{ label: "Got it", run: () => undefined }, { label: "Anything else?", run: back }] }),
            ),
        },
        { label: "Change my name", run: () => void rename(kernel) },
        { label: "Change my hoodie", run: () => hoodie(kernel) },
        { label: "Never mind", run: () => undefined },
      ],
    }),
  );
}

async function rename(kernel: Kernel) {
  const answer = await kernel.prompt({ title: "What's your name?", label: "Name (up to 16 characters)", initial: kernel.prefs.get().playerName, confirmLabel: "Save" });
  if (answer === null) return;
  const name = sanitizeName(answer);
  kernel.prefs.set({ playerName: name });
  kernel.sfx("select");
  say(kernel, playerPage(kernel, `${name}. I like it! Nice to meet you.`));
}

function hoodie(kernel: Kernel) {
  say(
    kernel,
    playerPage(kernel, "Which hoodie today?", {
      choices: [
        ...HOODIES.map((h) => ({
          label: h.name,
          run: () => {
            kernel.prefs.set({ hoodie: h.id });
            kernel.sfx("pop");
            say(kernel, playerPage(kernel, `${findHoodie(h.id).name}! Cozy.`));
          },
        })),
        { label: "Keep it", run: () => undefined },
      ],
    }),
  );
}

function tour(kernel: Kernel) {
  const pages: DialoguePage[] = TOUR.map((stop, i) => ({
    ...playerPage(kernel, stop.text),
    onShow: () => kernel.ui.set((s) => ({ ...s, highlightId: stop.id })),
    ...(i === TOUR.length - 1 ? { choices: [{ label: "Thanks, that helps!", run: () => undefined }, { label: "Tell me more", run: () => chat(kernel) }] } : {}),
  }));
  say(kernel, pages);
}

/** Do what the object does. */
export function runRoomAction(item: PlacedItem, kernel: Kernel): void {
  const action = item.action;
  if (!action) return;
  const cx = item.x + item.width / 2;

  const app = OBJECT_APPS[action];
  if (app) {
    kernel.openApp(app);
    return;
  }

  switch (action) {
    case "computer":
      kernel.dialogue.close();
      kernel.sfx("open");
      kernel.setLauncherOpen(true);
      return;

    case "character":
      kernel.sfx("pop");
      kernel.spawnEffect("sparkle", cx - 3, item.y - 4);
      chat(kernel);
      return;

    case "bed": {
      const off = !kernel.prefs.get().lightsOff;
      kernel.prefs.set({ lightsOff: off });
      kernel.sfx("switch");
      say(kernel, off ? "You switch off the big light. Only the desk lamp glows now. Sweet dreams." : "You switch the light back on. Good morning!");
      return;
    }

    case "cat-bed":
    case "cat-cushion":
    case "cat-shelf": {
      const cat = CAT_LINES[action]!;
      kernel.sfx("meow");
      kernel.spawnEffect("heart", cx - 3, item.y - 6);
      say(kernel, { speaker: cat.name, text: pick(cat.lines) });
      return;
    }

    case "plant-big":
    case "plant-vines":
    case "plant-small":
      kernel.sfx("water");
      kernel.spawnEffect("sparkle", cx - 3, item.y);
      say(kernel, pick(["You give the plant a little water. It looks happier already.", "A leaf unfurls. Someone is thriving.", "You wipe the dust off a leaf. Perfect."]));
      return;

    case "poster-mountain":
    case "poster-sign":
    case "poster-sunset":
    case "poster-planet":
      kernel.sfx("click");
      say(kernel, POSTER_LINES[action]!);
      return;

    case "clock": {
      const next = !kernel.prefs.get().clock24h;
      kernel.prefs.set({ clock24h: next });
      kernel.sfx("switch");
      say(kernel, `It's ${time(kernel)}. The clock now shows ${next ? "24-hour" : "12-hour"} time.`);
      return;
    }
  }
}

export { TOUR };
