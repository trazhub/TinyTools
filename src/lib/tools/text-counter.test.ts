import { describe, expect, it } from "vitest";
import { analyzeText, formatDuration } from "./text-counter";

describe("analyzeText", () => {
  it("returns zeros for empty input", () => {
    const s = analyzeText("");
    expect(s).toMatchObject({ words: 0, characters: 0, sentences: 0, paragraphs: 0, lines: 0 });
    expect(s.topWords).toEqual([]);
  });

  it("counts words, characters and sentences", () => {
    const s = analyzeText("Hello world. How are you? Fine!");
    expect(s.words).toBe(6);
    expect(s.characters).toBe(31);
    expect(s.charactersNoSpaces).toBe(26);
    expect(s.sentences).toBe(3);
  });

  it("does not count punctuation-only tokens as words", () => {
    expect(analyzeText("hello - world -- !!!").words).toBe(2);
  });

  it("treats contractions and hyphenated numbers sensibly", () => {
    expect(analyzeText("don't stop").words).toBe(2);
  });

  it("counts an emoji family as one character", () => {
    expect(analyzeText("a👨‍👩‍👧b").characters).toBe(3);
  });

  it("counts paragraphs and lines", () => {
    const s = analyzeText("one\ntwo\n\nthree\n\n\n\nfour");
    expect(s.paragraphs).toBe(3);
    expect(s.lines).toBe(8);
  });

  it("handles Windows line endings", () => {
    const s = analyzeText("a\r\nb\r\n\r\nc");
    expect(s.paragraphs).toBe(2);
    expect(s.lines).toBe(4);
  });

  it("handles whitespace-only input", () => {
    const s = analyzeText("   \n  ");
    expect(s.words).toBe(0);
    expect(s.charactersNoSpaces).toBe(0);
    expect(s.sentences).toBe(0);
    expect(s.paragraphs).toBe(0);
  });

  it("reports repeated words, ignoring case, short words and numbers", () => {
    const s = analyzeText("Apple apple APPLE banana banana of of of 2024 2024 cherry");
    expect(s.topWords).toEqual([
      { word: "apple", count: 3 },
      { word: "banana", count: 2 },
    ]);
  });

  it("estimates reading and speaking time", () => {
    const s = analyzeText(Array(476).fill("word").join(" "));
    expect(s.words).toBe(476);
    expect(s.readingMinutes).toBeCloseTo(2, 5);
    expect(s.speakingMinutes).toBeCloseTo(3.17, 1);
  });

  it("copes with a large document", () => {
    const text = "The quick brown fox jumps over the lazy dog. ".repeat(20000);
    const start = performance.now();
    const s = analyzeText(text);
    expect(s.words).toBe(180000);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});

describe("formatDuration", () => {
  it("formats ranges", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(0.4)).toBe("under 1 min");
    expect(formatDuration(3.2)).toBe("3 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(65.4)).toBe("1 hr 5 min");
  });
});
