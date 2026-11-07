import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
// ⚠️ `messaggiIt` e non `it`: l'import dei messaggi italiani COPRE l'`it()` di vitest, e il
// file fallisce in raccolta con «default is not a function» e «0 test» — la firma descritta
// in CLAUDE.md. Stessa ragione per cui `json-ld.test.ts` li chiama `messaggiIt`/`messaggiEn`.
import messaggiIt from "@/messages/it.json";

/**
 * ⚠️ **Due file, una soglia.** Il menu desktop compare a `xl` (`navigation.tsx`) e la fascia
 * `.fa-nav-scrim` sparisce alla stessa larghezza (`globals.css`, `80rem`). Sono scritte in
 * posti diversi e nessun typecheck le lega: se un giorno una delle due si muove, fra le due
 * larghezze resta una barra-hamburger senza la sua protezione, e il difetto si vede solo in
 * una fascia stretta di viewport che nessuno apre apposta.
 *
 * ⚠️ Il test guarda il **testo dei file**, non il CSS renderizzato: è l'unico modo di legare
 * una utility Tailwind a una media query scritta a mano. Grezzo, e per questo non si rompe
 * per ragioni che non c'entrano.
 */
const leggi = (p: string) => readFileSync(path.join(process.cwd(), p), "utf-8");
const REM_PER_BREAKPOINT: Record<string, string> = { lg: "64rem", xl: "80rem", "2xl": "96rem" };

describe("la soglia dell'hamburger", () => {
  const nav = leggi("src/components/layout/navigation.tsx");

  it("è la stessa su tutte e cinque le classi del menu", () => {
    const soglie = [
      ...nav.matchAll(/(?:^|\s)(sm|md|lg|xl|2xl):(?:flex|hidden|block)(?=["\s])/g),
    ].map((m) => m[1]);
    // ul delle voci, gruppo di destra, hamburger, sfondo del menu lingua, pannello mobile.
    expect(soglie).toHaveLength(5);
    expect(new Set(soglie)).toEqual(new Set(["xl"]));
  });

  it("è la stessa a cui sparisce la fascia della nav", () => {
    const soglia = nav.match(/(?:^|\s)(sm|md|lg|xl|2xl):flex(?=["\s])/)![1]!;
    const css = leggi("src/app/globals.css");
    const media = css.match(/@media \(min-width: ([\d.]+rem)\) \{\s*\.fa-nav-scrim/)![1];
    expect(media).toBe(REM_PER_BREAKPOINT[soglia]);
  });
});

/**
 * ⚠️ **Il nome del contenitore dei corpi a incasso è un TESTO, non un dato.** Nel footer
 * arrivava dal `title` del documento Sanity, che è italiano, e si leggeva «Corpi a incasso»
 * in ogni lingua, inglese compreso. La cura è la chiave dei messaggi; questo test tiene che
 * la chiave sia davvero tradotta, perché una chiave che ripete l'italiano rimetterebbe le
 * cose com'erano senza che nulla diventi rosso.
 */
describe("il nome dei corpi a incasso nei messaggi", () => {
  const dizionari = { it: messaggiIt, en, de, fr, es };

  it("c'è in tutte e cinque le lingue", () => {
    for (const [lingua, m] of Object.entries(dizionari))
      expect(m.corpiIncasso.eyebrow, lingua).toBeTruthy();
  });

  it("non è l'italiano nelle altre quattro", () => {
    for (const [lingua, m] of Object.entries(dizionari)) {
      if (lingua === "it") continue;
      expect(m.corpiIncasso.eyebrow, lingua).not.toBe(messaggiIt.corpiIncasso.eyebrow);
    }
  });
});
