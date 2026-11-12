export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  /** Minutes at 238 words per minute (average adult silent reading speed). */
  readingMinutes: number;
  /** Minutes at 150 words per minute (typical speaking pace). */
  speakingMinutes: number;
  topWords: { word: string; count: number }[];
}

const READING_WPM = 238;
const SPEAKING_WPM = 150;

const hasSegmenter = typeof Intl !== "undefined" && "Segmenter" in Intl;

function segments(text: string, granularity: "word" | "grapheme" | "sentence") {
  return Array.from(new Intl.Segmenter(undefined, { granularity }).segment(text));
}

function wordList(text: string): string[] {
  if (!hasSegmenter) return text.match(/\S+/g) ?? [];
  return segments(text, "word")
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);
}

function countGraphemes(text: string): number {
  if (!hasSegmenter) return Array.from(text).length;
  // Intl.Segmenter is accurate (emoji sequences count as one) but slow for huge
  // inputs, so fall back to code points above ~2M characters.
  if (text.length > 2_000_000) return Array.from(text).length;
  return segments(text, "grapheme").length;
}

function countSentences(text: string): number {
  if (!text.trim()) return 0;
  if (hasSegmenter) {
    return segments(text, "sentence").filter((s) => /[\p{L}\p{N}]/u.test(s.segment)).length;
  }
  return (text.match(/[^.!?]+[.!?]*/g) ?? []).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
}

export function analyzeText(text: string): TextStats {
  if (text.length === 0) {
    return {
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      sentences: 0,
      paragraphs: 0,
      lines: 0,
      readingMinutes: 0,
      speakingMinutes: 0,
      topWords: [],
    };
  }

  const words = wordList(text);
  const paragraphs = text.split(/\r?\n\s*\r?\n/).filter((p) => p.trim().length > 0).length;
  const lines = text.split(/\r\n|\r|\n/).length;

  const frequency = new Map<string, number>();
  for (const raw of words) {
    const w = raw.toLocaleLowerCase();
    if (w.length < 3 || /^\d+$/.test(w)) continue;
    frequency.set(w, (frequency.get(w) ?? 0) + 1);
  }
  const topWords = [...frequency.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  return {
    words: words.length,
    characters: countGraphemes(text),
    charactersNoSpaces: countGraphemes(text.replace(/\s+/g, "")),
    sentences: countSentences(text),
    paragraphs,
    lines,
    readingMinutes: words.length / READING_WPM,
    speakingMinutes: words.length / SPEAKING_WPM,
    topWords,
  };
}

/** "under 1 min", "3 min", "1 hr 5 min" */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 1) return "under 1 min";
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
