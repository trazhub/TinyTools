/** Lorem Ipsum generator. */

const WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(
    " ",
  );

export type LoremUnit = "paragraphs" | "sentences" | "words";

export function loremWords(count: number, rand: () => number = Math.random): string[] {
  return Array.from({ length: count }, () => WORDS[Math.floor(rand() * WORDS.length)]!);
}

function sentence(rand: () => number): string {
  const w = loremWords(6 + Math.floor(rand() * 9), rand);
  const text = w.join(" ");
  return text[0]!.toUpperCase() + text.slice(1) + ".";
}

const LEAD = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";

export function generateLorem(unit: LoremUnit, count: number, startWithLorem = true, rand: () => number = Math.random): string {
  const n = Math.max(1, Math.min(200, Math.floor(count)));
  if (unit === "words") {
    const w = loremWords(n, rand);
    if (startWithLorem) for (let i = 0; i < Math.min(n, 5); i++) w[i] = WORDS[i]!;
    return w.join(" ");
  }
  if (unit === "sentences") {
    const list = Array.from({ length: n }, () => sentence(rand));
    if (startWithLorem) list[0] = LEAD;
    return list.join(" ");
  }
  const paras = Array.from({ length: n }, () => Array.from({ length: 3 + Math.floor(rand() * 4) }, () => sentence(rand)).join(" "));
  if (startWithLorem) paras[0] = LEAD + " " + paras[0]!.split(". ").slice(1).join(". ");
  return paras.join("\n\n");
}
