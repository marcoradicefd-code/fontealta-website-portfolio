/**
 * Reading time from Portable Text body (runtime — there is no stored field;
 * see post schema note "reading time is computed at runtime").
 *
 * Counts ONLY the words in span text nodes of `block` items (ignores images,
 * non-text members and non-block content), divides by 200 wpm, floor 1 minute.
 */
const WORDS_PER_MINUTE = 200;

type PortableSpan = { _type?: string; text?: string };
type PortableBlock = { _type?: string; children?: PortableSpan[] };

export function readingTimeMinutes(body: unknown): number {
  if (!Array.isArray(body)) return 1;

  let words = 0;
  for (const block of body as PortableBlock[]) {
    if (block?._type !== "block" || !Array.isArray(block.children)) continue;
    for (const child of block.children) {
      if (child?._type === "span" && typeof child.text === "string") {
        words += child.text.trim().split(/\s+/).filter(Boolean).length;
      }
    }
  }

  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
