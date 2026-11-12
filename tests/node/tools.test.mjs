// Checks for the pure tool logic. Run with: npm run test:node
// (Uses Node's built-in test runner, so it needs no extra setup.)
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseRanges } from "../../src/lib/tools/page-ranges.ts";
import { convertCase, splitWords, cleanText, diffLines } from "../../src/lib/tools/text-tools.ts";
import { convertUnit, formatNumber } from "../../src/lib/tools/unit-convert.ts";
import { parseColor, toHex, toHsl, hslToRgb, contrastRatio, paletteFromPixels } from "../../src/lib/tools/color.ts";
import { pctOf, whatPercent, pctChange, dateDiff, parseDay, parseStamp, parseClock } from "../../src/lib/tools/calc-tools.ts";
import { decodeJwt } from "../../src/lib/tools/jwt.ts";
import { generateLorem } from "../../src/lib/tools/lorem.ts";
import { runRegex } from "../../src/lib/tools/regex-tools.ts";
import { urlEncode, urlDecode, parseQuery } from "../../src/lib/tools/url-tools.ts";

test("page ranges", () => {
  assert.deepEqual(parseRanges("1-3, 5", 10), { ok: true, groups: [[1, 2, 3], [5]] });
  assert.deepEqual(parseRanges("8-", 10), { ok: true, groups: [[8, 9, 10]] });
  assert.deepEqual(parseRanges("-2", 10), { ok: true, groups: [[1, 2]] });
  assert.equal(parseRanges("", 10).ok, false);
  assert.equal(parseRanges("0", 10).ok, false);
  assert.equal(parseRanges("11", 10).ok, false);
  assert.equal(parseRanges("5-2", 10).ok, false);
  assert.equal(parseRanges("a-b", 10).ok, false);
  assert.equal(parseRanges("1--2", 10).ok, false);
});

test("case conversion", () => {
  assert.deepEqual(splitWords("fooBar_baz-QUX HTTPServer"), ["foo", "Bar", "baz", "QUX", "HTTP", "Server"]);
  assert.equal(convertCase("hello WORLD", "title"), "Hello World");
  assert.equal(convertCase("hello. world! ok", "sentence"), "Hello. World! Ok");
  assert.equal(convertCase("Hello big world", "camel"), "helloBigWorld");
  assert.equal(convertCase("Hello big world", "pascal"), "HelloBigWorld");
  assert.equal(convertCase("Hello big world", "snake"), "hello_big_world");
  assert.equal(convertCase("Hello big world", "kebab"), "hello-big-world");
  assert.equal(convertCase("Hello big world", "constant"), "HELLO_BIG_WORLD");
  assert.equal(convertCase("ab", "upper"), "AB");
  assert.equal(convertCase("मेरा test", "kebab"), "मेरा-test");
});

test("text cleanup", () => {
  assert.equal(cleanText("  a  b \n\n b\nb\n", ["spaces", "trim", "blank"]), "a b\nb\nb");
  assert.equal(cleanText("b\na\nb", ["dupes"]), "b\na");
  assert.equal(cleanText("b\na\nc", ["sort"]), "a\nb\nc");
});

test("line diff", () => {
  assert.deepEqual(diffLines("a\nb\nc", "a\nc\nd"), [
    { type: "same", text: "a" },
    { type: "del", text: "b" },
    { type: "same", text: "c" },
    { type: "add", text: "d" },
  ]);
  assert.deepEqual(diffLines("", "x"), [{ type: "add", text: "x" }]);
  assert.deepEqual(diffLines("x", "x"), [{ type: "same", text: "x" }]);
  assert.equal(diffLines("a\n".repeat(4001), "b"), null);
});

test("unit conversion", () => {
  assert.equal(convertUnit("length", 1, "km", "m"), 1000);
  assert.ok(Math.abs(convertUnit("length", 1, "mi", "km") - 1.609344) < 1e-9);
  assert.equal(convertUnit("temperature", 100, "c", "f"), 212);
  assert.equal(convertUnit("temperature", 32, "f", "c"), 0);
  assert.equal(convertUnit("temperature", 0, "c", "k"), 273.15);
  assert.equal(convertUnit("data", 1, "kib", "b"), 1024);
  assert.ok(Math.abs(convertUnit("mass", 1, "lb", "kg") - 0.45359237) < 1e-12);
  assert.equal(convertUnit("nope", 1, "a", "b"), null);
  assert.equal(convertUnit("length", 1, "m", "zz"), null);
  assert.equal(formatNumber(0.1 + 0.2), "0.3");
  assert.equal(formatNumber(1234.5), "1234.5");
  assert.equal(formatNumber(0), "0");
});

test("colours", () => {
  assert.deepEqual(parseColor("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseColor("#ff8000"), { r: 255, g: 128, b: 0 });
  assert.deepEqual(parseColor("rgb(10, 20, 30)"), { r: 10, g: 20, b: 30 });
  assert.deepEqual(parseColor("hsl(0, 100%, 50%)"), { r: 255, g: 0, b: 0 });
  assert.equal(parseColor("rgb(300, 0, 0)"), null);
  assert.equal(parseColor("nonsense"), null);
  assert.equal(toHex({ r: 255, g: 128, b: 0 }), "#ff8000");
  assert.deepEqual(toHsl({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, l: 50 });
  assert.deepEqual(toHsl({ r: 0, g: 0, b: 255 }), { h: 240, s: 100, l: 50 });
  assert.deepEqual(toHsl({ r: 128, g: 128, b: 128 }), { h: 0, s: 0, l: 50 });
  assert.deepEqual(hslToRgb(120, 100, 50), { r: 0, g: 255, b: 0 });
  assert.ok(Math.abs(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }) - 21) < 1e-9);
  assert.ok(Math.abs(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 255, g: 255, b: 255 }) - 1) < 1e-9);
});

test("percentages and dates", () => {
  assert.equal(pctOf(15, 200), 30);
  assert.equal(whatPercent(50, 200), 25);
  assert.ok(Number.isNaN(whatPercent(1, 0)));
  assert.equal(pctChange(100, 150), 50);
  assert.equal(pctChange(200, 100), -50);
  assert.deepEqual(dateDiff(parseDay("2000-01-31"), parseDay("2000-03-01")), { years: 0, months: 1, days: 1, totalDays: 30 });
  assert.deepEqual(dateDiff(parseDay("1990-05-20"), parseDay("2024-05-19")), { years: 33, months: 11, days: 29, totalDays: 12418 });
  assert.deepEqual(dateDiff(parseDay("2024-03-01"), parseDay("2024-03-01")), { years: 0, months: 0, days: 0, totalDays: 0 });
  assert.equal(dateDiff(parseDay("2024-03-10"), parseDay("2024-03-01")).totalDays, 9); // order does not matter
  assert.equal(parseDay("2023-02-29"), null);
  assert.equal(parseDay("2024-02-29") instanceof Date, true);
  assert.equal(parseDay("nope"), null);
});

test("timestamps", () => {
  assert.deepEqual(parseStamp("0"), { iso: "1970-01-01T00:00:00.000Z", seconds: 0, millis: 0 });
  assert.equal(parseStamp("1700000000").iso, "2023-11-14T22:13:20.000Z");
  assert.equal(parseStamp("1700000000000").iso, "2023-11-14T22:13:20.000Z");
  assert.equal(parseStamp("2023-11-14T22:13:20Z").seconds, 1700000000);
  assert.equal(parseStamp("garbage"), null);
  assert.equal(parseStamp(""), null);
});

test("jwt decode", () => {
  const tok =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const j = decodeJwt(tok);
  assert.deepEqual(j.header, { alg: "HS256", typ: "JWT" });
  assert.deepEqual(j.payload, { sub: "1234567890", name: "John Doe", iat: 1516239022 });
  assert.equal(decodeJwt("not.a.jwt"), null);
  assert.equal(decodeJwt("only.two"), null);
  assert.equal(decodeJwt(""), null);
});

test("lorem", () => {
  assert.ok(generateLorem("paragraphs", 3).split("\n\n").length === 3);
  assert.ok(generateLorem("paragraphs", 1).startsWith("Lorem ipsum dolor sit amet"));
  assert.equal(generateLorem("words", 10).split(" ").length, 10);
  assert.ok(generateLorem("words", 10).startsWith("lorem ipsum dolor sit amet"));
  assert.equal(generateLorem("sentences", 4, false).split(". ").length, 4);
  assert.equal(generateLorem("words", 500).split(" ").length, 200); // capped
  assert.equal(generateLorem("words", 0).split(" ").length, 1); // at least one
});

test("regex tester", () => {
  const r = runRegex("(\\d+)-(\\w)", "g", "10-a and 20-b");
  assert.equal(r.ok, true);
  assert.equal(r.matches.length, 2);
  assert.deepEqual(r.matches[0], { index: 0, text: "10-a", groups: ["10", "a"] });
  assert.equal(runRegex("(", "", "x").ok, false);
  assert.equal(runRegex("a", "zz", "x").ok, false);
  assert.deepEqual(runRegex("", "g", "x"), { ok: true, matches: [], truncated: false });
  assert.equal(runRegex("a", "i", "A a").matches.length, 2); // g is added automatically
  assert.equal(runRegex("", "g", "abc").matches.length, 0);
  const many = runRegex("a", "", "a".repeat(2000));
  assert.equal(many.matches.length, 1000);
  assert.equal(many.truncated, true);
  assert.equal(runRegex("x*", "", "abc").matches.length, 4); // empty matches do not loop forever
});

test("url tools", () => {
  assert.equal(urlEncode("a b&c=d/é", "component"), "a%20b%26c%3Dd%2F%C3%A9");
  assert.equal(urlEncode("https://x.com/a b?q=é", "full"), "https://x.com/a%20b?q=%C3%A9");
  assert.equal(urlDecode("a%20b%26", "component"), "a b&");
  assert.equal(urlDecode("%E0%A4%A", "component"), null);
  assert.deepEqual(parseQuery("https://x.com/?a=1&b=two%20words&a=3"), [
    { name: "a", value: "1" },
    { name: "b", value: "two words" },
    { name: "a", value: "3" },
  ]);
  assert.equal(parseQuery("not a url"), null);
});

test("clock times", () => {
  assert.equal(parseClock("90"), 90);
  assert.equal(parseClock("1:30"), 90);
  assert.equal(parseClock("1:02:03"), 3723);
  assert.equal(parseClock("0:00:01.5"), 1.5);
  assert.equal(parseClock("1:75"), null);
  assert.equal(parseClock("abc"), null);
  assert.equal(parseClock(""), null);
  assert.equal(parseClock("-5"), null);
});

test("palette from pixels", () => {
  const px = [];
  for (let i = 0; i < 6; i++) px.push(255, 0, 0, 255); // 6 red
  for (let i = 0; i < 3; i++) px.push(0, 0, 255, 255); // 3 blue
  px.push(0, 255, 0, 255); // 1 green
  px.push(10, 10, 10, 0); // transparent: ignored
  const pal = paletteFromPixels(new Uint8ClampedArray(px), 2);
  assert.deepEqual(pal, [{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }]);
  assert.deepEqual(paletteFromPixels(new Uint8ClampedArray([1, 2, 3, 0]), 3), []);
});
