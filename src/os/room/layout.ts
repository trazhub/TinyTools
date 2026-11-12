import { spriteSize, type SpriteId } from "../pixel/registry";
import { STAGE_H, STAGE_W } from "../pixel/sprites";

export { STAGE_H, STAGE_W };

/** What happens when you click an object. Each id maps to a real behaviour in actions.ts. */
export type RoomAction =
  | "computer"
  | "bookshelf"
  | "notebook"
  | "window"
  | "character"
  | "record"
  | "handheld"
  | "bed"
  | "cat-bed"
  | "cat-cushion"
  | "cat-shelf"
  | "plant-big"
  | "plant-vines"
  | "plant-small"
  | "poster-mountain"
  | "poster-sign"
  | "poster-sunset"
  | "poster-planet"
  | "clock";

export interface RoomItem {
  id: string;
  sprite: SpriteId;
  /** One variant, or several that are cycled to animate the sprite. */
  frames?: string[];
  /** Seconds for a full animation cycle. */
  cycle?: number;
  x: number;
  y: number;
  /** Added to the sprite's bottom edge to decide draw order (larger = in front). */
  depth?: number;
  action?: RoomAction;
  /** Accessible name and the label shown on hover. */
  label?: string;
  /** Extra clickable margin in logical pixels (helps with small objects on touch screens). */
  hitPad?: number;
  /** Sprite is drawn only in some conditions. */
  when?: "never";
}

export interface FloorShadow {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const SHADOWS: FloorShadow[] = [
  { x: 2, y: 136, w: 88, h: 9 },
  { x: 88, y: 112, w: 30, h: 10 },
  { x: 114, y: 128, w: 126, h: 10 },
  { x: 250, y: 119, w: 52, h: 10 },
  { x: 288, y: 128, w: 30, h: 9 },
  { x: 140, y: 166, w: 40, h: 7 },
  { x: 22, y: 166, w: 40, h: 7 },
];

export const ROOM_ITEMS: RoomItem[] = [
  // Wall
  { id: "poster-mountain", sprite: "posterMountain", x: 88, y: 12, action: "poster-mountain", label: "Mountain poster" },
  { id: "poster-sign", sprite: "posterSign", x: 130, y: 10, action: "poster-sign", label: "Wall sign" },
  { id: "poster-sunset", sprite: "posterSunset", x: 172, y: 8, action: "poster-sunset", label: "Sunset poster" },
  { id: "poster-planet", sprite: "posterPlanet", x: 208, y: 10, action: "poster-planet", label: "Planet poster" },
  { id: "note-a", sprite: "noteA", x: 116, y: 50, depth: -200 },
  { id: "note-b", sprite: "noteB", x: 125, y: 44, depth: -200 },
  { id: "window", sprite: "window", x: 248, y: 8, action: "window", label: "Window: ambient scenes", hitPad: 1 },
  // Bookshelf corner
  { id: "bookshelf", sprite: "bookshelf", x: 10, y: 24, action: "bookshelf", label: "Bookshelf: File Explorer" },
  { id: "vines", sprite: "vines", x: 16, y: 16, action: "plant-vines", label: "Hanging plant", depth: 100 },
  { id: "cat-shelf", sprite: "catShelf", frames: ["0", "1"], cycle: 2.4, x: 46, y: 8, action: "cat-shelf", label: "Cat on the shelf", depth: 2 },
  { id: "bed", sprite: "bed", x: 4, y: 94, action: "bed", label: "Bed: lights" },
  { id: "cat-bed", sprite: "catBed", frames: ["0", "1"], cycle: 3, x: 46, y: 108, action: "cat-bed", label: "Sleepy cat", depth: 40 },
  { id: "nightstand", sprite: "nightstand", x: 92, y: 92 },
  { id: "clock", sprite: "alarmClock", x: 92, y: 80, action: "clock", label: "Alarm clock", depth: 4, hitPad: 2 },
  // Desk
  { id: "desk", sprite: "desk", x: 118, y: 84 },
  { id: "tower", sprite: "tower", x: 122, y: 56, depth: 60 },
  { id: "computer", sprite: "crt", frames: ["on", "off"], cycle: 1.1, x: 148, y: 40, action: "computer", label: "Computer: app launcher", depth: 60 },
  { id: "keyboard", sprite: "keyboard", x: 152, y: 81, depth: 61 },
  { id: "mug", sprite: "mug", x: 200, y: 76, depth: 61 },
  { id: "steam", sprite: "steam", frames: ["0", "1"], cycle: 1.6, x: 201, y: 66, depth: 62 },
  { id: "lamp", sprite: "lamp", x: 210, y: 44, depth: 60 },
  { id: "chair", sprite: "chair", x: 157, y: 112 },
  // Right wall
  { id: "record-player", sprite: "recordPlayer", x: 256, y: 80, action: "record", label: "Record player: music" },
  { id: "plant-big", sprite: "plantBig", x: 292, y: 96, action: "plant-big", label: "Big plant", depth: 4 },
  // Floor
  { id: "rug", sprite: "rug", x: 98, y: 130, depth: -1000 },
  { id: "character", sprite: "character", frames: ["0", "1"], cycle: 1.8, x: 147, y: 138, action: "character", label: "You: help and profile", depth: 6 },
  { id: "cushion", sprite: "cushion", x: 24, y: 158 },
  { id: "cat-cushion", sprite: "catCushion", frames: ["0", "1"], cycle: 3.4, x: 31, y: 152, action: "cat-cushion", label: "Orange cat", depth: 14 },
  { id: "plant-small", sprite: "plantSmall", x: 6, y: 150, action: "plant-small", label: "Little plant", depth: 3 },
  { id: "notebook", sprite: "notebook", x: 236, y: 150, action: "notebook", label: "Notebook: Notes", hitPad: 3 },
  { id: "handheld", sprite: "handheld", x: 266, y: 154, action: "handheld", label: "Handheld: games", hitPad: 3 },
];

export interface PlacedItem extends RoomItem {
  width: number;
  height: number;
}

/** Items with sizes, sorted back-to-front by their bottom edge. */
export function placedItems(items: readonly RoomItem[] = ROOM_ITEMS): PlacedItem[] {
  return items
    .map((item) => {
      const { width, height } = spriteSize(item.sprite, item.frames?.[0] ?? "");
      return { ...item, width, height };
    })
    .sort((a, b) => a.y + a.height + (a.depth ?? 0) - (b.y + b.height + (b.depth ?? 0)));
}

// ---- fitting the stage to the screen -----------------------------------------------

export interface StageFit {
  scale: number;
  /** Screen position of the stage's top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Scale the stage to fit the area. Large screens step in halves (so art pixels stay
 * a regular size while the room fills the screen); when the room would be tiny
 * (phones), the exact fractional scale is used so the whole room stays visible.
 */
export function fitStage(areaWidth: number, areaHeight: number): StageFit {
  const exact = Math.min(areaWidth / STAGE_W, areaHeight / STAGE_H);
  const scale = exact >= 2 ? Math.min(10, Math.floor(exact * 2) / 2) : Math.max(0.5, Math.floor(exact * 100) / 100);
  const width = STAGE_W * scale;
  const height = STAGE_H * scale;
  return { scale, width, height, x: Math.round((areaWidth - width) / 2), y: Math.round((areaHeight - height) / 2) };
}
