import { lazy, type ComponentType } from "react";
import {
  Binary,
  Braces,
  Calculator,
  CloudMoon,
  Disc3,
  FolderOpen,
  Gamepad2,
  ImageDown,
  KeyRound,
  Settings,
  SquareTerminal,
  StickyNote,
  TextCursorInput,
} from "lucide-react";
import type { AppDefinition } from "./types";

/** Wrap a standalone tool UI (which takes no props) so it fits the app interface and scrolls inside its window. */
function utility(load: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    const { default: Tool } = await load();
    return {
      default: function UtilityApp() {
        return (
          <div className="mx-auto max-w-3xl p-4 sm:p-6">
            <Tool />
          </div>
        );
      },
    };
  });
}

/**
 * Every app in the OS. To add one: write a component that takes AppComponentProps,
 * lazy-load it here, and give it an icon, size and description. The computer's
 * launcher, search, and the terminal (`apps`, `open`) all read this list. To give
 * an app a place in the room, point an object at it in room/actions.ts.
 */
export const APPS: readonly AppDefinition[] = [
  {
    id: "explorer",
    name: "File Explorer",
    description: "Browse, organise and preview your files and folders.",
    category: "system",
    keywords: ["files", "folders", "documents", "trash", "recycle", "browse", "downloads"],
    icon: FolderOpen,
    hue: 245,
    size: { width: 860, height: 540 },
    minSize: { width: 520, height: 340 },
    component: lazy(() => import("./explorer/explorer-app")),
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "A simulated command line connected to your files and apps.",
    category: "system",
    keywords: ["shell", "command", "cli", "console", "bash", "prompt"],
    icon: SquareTerminal,
    hue: 155,
    size: { width: 700, height: 440 },
    minSize: { width: 380, height: 240 },
    component: lazy(() => import("./terminal/terminal-app")),
  },
  {
    id: "notes",
    name: "Notes",
    description: "Write notes with Markdown, saved automatically.",
    category: "productivity",
    keywords: ["text", "write", "markdown", "memo", "editor", "document", "todo"],
    icon: StickyNote,
    hue: 85,
    size: { width: 820, height: 540 },
    minSize: { width: 480, height: 320 },
    singleton: true,
    component: lazy(() => import("./notes/notes-app")),
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Arithmetic with parentheses, percentages and keyboard support.",
    category: "utilities",
    keywords: ["math", "calc", "numbers", "arithmetic", "percent"],
    icon: Calculator,
    hue: 40,
    size: { width: 340, height: 590 },
    minSize: { width: 300, height: 540 },
    resizable: false,
    singleton: true,
    component: lazy(() => import("./calculator/calculator-app")),
  },
  {
    id: "settings",
    name: "Settings",
    description: "Room theme, sound, effects, reduced motion, your name and storage.",
    category: "system",
    keywords: ["preferences", "theme", "room", "sound", "crt", "motion", "name", "hoodie", "clock", "reset", "storage"],
    icon: Settings,
    hue: 275,
    size: { width: 760, height: 520 },
    minSize: { width: 520, height: 360 },
    singleton: true,
    component: lazy(() => import("./settings/settings-app")),
  },
  {
    id: "ambient",
    name: "Window View",
    description: "Watch the night city, rain, snow or fireflies, with gentle sound.",
    category: "media",
    keywords: ["window", "ambient", "weather", "rain", "snow", "night", "relax", "scene", "fireflies"],
    icon: CloudMoon,
    hue: 265,
    size: { width: 760, height: 520 },
    minSize: { width: 420, height: 360 },
    singleton: true,
    component: lazy(() => import("./ambient/ambient-app")),
  },
  {
    id: "music",
    name: "Record Player",
    description: "Endless gentle lo-fi music, made up on the spot.",
    category: "media",
    keywords: ["music", "lofi", "lo-fi", "record", "player", "audio", "sound", "relax"],
    icon: Disc3,
    hue: 20,
    size: { width: 460, height: 600 },
    minSize: { width: 340, height: 480 },
    singleton: true,
    component: lazy(() => import("./music/music-app")),
  },
  {
    id: "snake",
    name: "Snake",
    description: "The classic game on your handheld. Keyboard, swipe or buttons.",
    category: "games",
    keywords: ["game", "snake", "handheld", "play", "arcade", "retro"],
    icon: Gamepad2,
    hue: 150,
    size: { width: 560, height: 640 },
    minSize: { width: 340, height: 560 },
    singleton: true,
    component: lazy(() => import("./snake/snake-app")),
  },
  {
    id: "json-formatter",
    name: "JSON Formatter",
    description: "Format, validate and minify JSON with exact error locations.",
    category: "utilities",
    keywords: ["json", "format", "validate", "minify", "prettify", "developer"],
    icon: Braces,
    hue: 205,
    size: { width: 720, height: 600 },
    minSize: { width: 440, height: 360 },
    singleton: true,
    component: utility(() => import("./utilities/json-formatter")),
  },
  {
    id: "base64",
    name: "Base64",
    description: "Encode and decode Base64 with correct UTF-8 support.",
    category: "utilities",
    keywords: ["encode", "decode", "base64", "utf-8", "developer"],
    icon: Binary,
    hue: 300,
    size: { width: 680, height: 580 },
    minSize: { width: 420, height: 360 },
    singleton: true,
    component: utility(() => import("./utilities/base64-encoder-decoder")),
  },
  {
    id: "word-counter",
    name: "Word Counter",
    description: "Count words, characters and reading time as you type.",
    category: "utilities",
    keywords: ["words", "characters", "count", "reading time", "writing"],
    icon: TextCursorInput,
    hue: 175,
    size: { width: 680, height: 600 },
    minSize: { width: 420, height: 360 },
    singleton: true,
    component: utility(() => import("./utilities/word-counter")),
  },
  {
    id: "password-generator",
    name: "Passwords",
    description: "Generate strong random passwords with your browser's secure randomness.",
    category: "utilities",
    keywords: ["password", "generator", "random", "secure", "security"],
    icon: KeyRound,
    hue: 20,
    size: { width: 600, height: 600 },
    minSize: { width: 400, height: 380 },
    singleton: true,
    component: utility(() => import("./utilities/password-generator")),
  },
  {
    id: "image-compressor",
    name: "Image Compressor",
    description: "Shrink JPEG, PNG and WebP images without uploading them.",
    category: "media",
    keywords: ["image", "photo", "compress", "jpeg", "png", "webp", "resize", "optimize"],
    icon: ImageDown,
    hue: 335,
    size: { width: 760, height: 620 },
    minSize: { width: 460, height: 400 },
    singleton: true,
    component: utility(() => import("./utilities/image-compressor")),
  },
];

const byId = new Map(APPS.map((a) => [a.id, a]));

export function getApp(id: string): AppDefinition | undefined {
  return byId.get(id);
}

/** Find an app by id or by name, ignoring case ("notes", "File Explorer"). */
export function findApp(query: string): AppDefinition | undefined {
  const q = query.trim().toLowerCase();
  return APPS.find((a) => a.id === q || a.name.toLowerCase() === q);
}
