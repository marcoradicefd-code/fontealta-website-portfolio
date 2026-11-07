import { describe, expect, it } from "vitest";

import { stripTrailingSlashes } from "@/lib/trailing-slashes";

/** La regex che `stripTrailingSlashes` sostituisce in `seo.ts`, `brevo.ts` e `derive-source.ts`. */
const conRegex = (s: string) => s.replace(/\/+$/, "");

const FILA = "/".repeat(32_000);

/** Il tempo più basso su cinque giri: un giro solo può prendersi una pausa del garbage collector. */
function millisecondi(f: () => void): number {
  let migliore = Infinity;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    f();
    migliore = Math.min(migliore, performance.now() - t0);
  }
  return migliore;
}

describe("stripTrailingSlashes", () => {
  it.each([
    "",
    "/",
    "//",
    "a",
    "a/",
    "a///",
    "/contatti",
    "/contatti/",
    "/blog/post//",
    "/a//b",
    "https://fontealta.it",
    "https://fontealta.it/",
    "https://fontealta-website-sigma.vercel.app//",
    "http://localhost:3998/",
    "http://127.0.0.1:3998/v3",
    `${FILA}x`,
    `x${FILA}`,
    FILA,
  ])("dà lo stesso risultato della regex: %#", (s) => {
    expect(stripTrailingSlashes(s)).toBe(conRegex(s));
  });

  // 50 ms e non 5 (Marco, 28/10/2026): la regex vecchia ci mette 400-500 ms, quindi la soglia
  // distingue ancora, e 5 ms rischiava rossi casuali sulle macchine della CI.
  const SOGLIA_MS = 50;

  it("una fila di 32.000 / costa meno di 50 ms, e la regex no (controprova)", () => {
    for (const s of [`${FILA}x`, `x${FILA}`, FILA]) {
      expect(millisecondi(() => stripTrailingSlashes(s))).toBeLessThan(SOGLIA_MS);
    }
    // La soglia separa davvero: sulla stessa fila la regex vecchia ci mette centinaia di ms.
    const t0 = performance.now();
    conRegex(`${FILA}x`);
    expect(performance.now() - t0).toBeGreaterThan(SOGLIA_MS);
  });
});

describe("trimEnd al posto di /\\s+$/ nel titolo del blog", () => {
  // `\s` e `trimEnd` usano lo stesso insieme (WhiteSpace e LineTerminator di ECMAScript):
  // spazio, tab, a capo, U+00A0, U+2028, U+FEFF e gli spazi Unicode.
  it.each(["", "Titolo", "Titolo  ", "Titolo\t\n", "Titolo ", "Titolo ﻿　", " a b "])(
    "dà lo stesso risultato: %#",
    (s) => {
      expect(s.trimEnd()).toBe(s.replace(/\s+$/, ""));
    },
  );
});
