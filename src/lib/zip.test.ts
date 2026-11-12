import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { crc32, createZip, uniqueNames } from "./zip";

const enc = (s: string) => new TextEncoder().encode(s);

describe("crc32", () => {
  it("matches known vectors", () => {
    expect(crc32(enc(""))).toBe(0);
    expect(crc32(enc("123456789"))).toBe(0xcbf43926);
    expect(crc32(enc("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });
});

describe("uniqueNames", () => {
  it("de-duplicates while keeping extensions", () => {
    expect(uniqueNames(["a.png", "a.png", "b", "b", "a.png"])).toEqual(["a.png", "a (2).png", "b", "b (2)", "a (3).png"]);
  });
});

describe("createZip", () => {
  it("writes a valid archive structure", () => {
    const zip = createZip([
      { name: "hello.txt", data: enc("hello") },
      { name: "ünï.txt", data: enc("unicode") },
    ]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    // End of central directory is the last 22 bytes
    const eocd = zip.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(2);
    const dirOffset = view.getUint32(eocd + 16, true);
    expect(view.getUint32(dirOffset, true)).toBe(0x02014b50);
    expect(view.getUint32(dirOffset + 16, true)).toBe(crc32(enc("hello")));
  });

  it("round-trips: every entry's name, bytes and CRC can be read back from the archive", () => {
    const binary = new Uint8Array(3000).map((_, i) => (i * 17) % 256);
    const zip = createZip([
      { name: "a.txt", data: enc("hello world") },
      { name: "dir/ünï.bin", data: binary },
      { name: "empty", data: new Uint8Array() },
    ]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocd = zip.length - 22;
    const count = view.getUint16(eocd + 10, true);
    let pos = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    const found: Record<string, Uint8Array> = {};
    for (let i = 0; i < count; i++) {
      expect(view.getUint32(pos, true)).toBe(0x02014b50);
      const crc = view.getUint32(pos + 16, true);
      const size = view.getUint32(pos + 24, true);
      const nameLen = view.getUint16(pos + 28, true);
      const localOffset = view.getUint32(pos + 42, true);
      const name = decoder.decode(zip.subarray(pos + 46, pos + 46 + nameLen));
      // Local header sits at localOffset: 30 bytes + name + extra, then the data.
      expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
      const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      const data = zip.subarray(dataStart, dataStart + size);
      expect(crc32(data)).toBe(crc);
      found[name] = data;
      pos += 46 + nameLen;
    }
    expect(Object.keys(found)).toEqual(["a.txt", "dir/ünï.bin", "empty"]);
    expect(decoder.decode(found["a.txt"]!)).toBe("hello world");
    expect(found["dir/ünï.bin"]).toEqual(binary);
    expect(found["empty"]).toEqual(new Uint8Array());
  });

  // Windows 10+, macOS and most Linux distros ship a `tar` (bsdtar) that reads ZIP files; GNU tar does not.
  const hasZipTar = (() => {
    try {
      return /bsdtar|libarchive/i.test(execFileSync("tar", ["--version"]).toString());
    } catch {
      return false;
    }
  })();

  it.skipIf(!hasZipTar)("can be extracted by a real unzip tool with identical bytes", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tinytools-zip-"));
    try {
      const binary = new Uint8Array(5000).map((_, i) => (i * 31) % 256);
      const zipPath = path.join(dir, "test.zip");
      writeFileSync(zipPath, createZip([
        { name: "a.txt", data: enc("hello world") },
        { name: "bin.dat", data: binary },
      ]));
      // `tar` ships with Windows 10+, macOS and Linux and understands zip.
      execFileSync("tar", ["-xf", zipPath, "-C", dir]);
      expect(readFileSync(path.join(dir, "a.txt"), "utf8")).toBe("hello world");
      expect(new Uint8Array(readFileSync(path.join(dir, "bin.dat")))).toEqual(binary);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
