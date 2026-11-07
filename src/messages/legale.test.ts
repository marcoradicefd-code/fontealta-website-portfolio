import { describe, expect, it } from "vitest";

import { ALL_LOCALES } from "@/i18n/routing";
import { LEGAL_SECTIONS } from "@/lib/legal-sections";

import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import messaggiIt from "./it.json";

/**
 * Guardie sui testi della pagina «Menzioni legali», in tutte e cinque le lingue.
 *
 * ⚠️ **Le parentesi quadre sono la guardia che conta.** Il testo di partenza segna fra
 * quadre i dati che solo l'azienda ha (Registro delle Imprese, REA, capitale sociale,
 * PEC): una pagina legale con «[indirizzo PEC]» dentro non si pubblica. E siccome tutti
 * i messaggi viaggiano verso il client, un segnaposto nei dizionari finirebbe nel
 * sorgente di ogni pagina del sito anche se la sezione non si rendesse.
 *
 * ⚠️ Il dizionario italiano si chiama `messaggiIt` e non `it`: un import `it` copre
 * l'`it()` di vitest e il file risulta con «0 test» invece che rosso.
 */
const DIZIONARI = { it: messaggiIt, en, de, fr, es } as const;

function foglie(valore: unknown, p = ""): Array<[string, string]> {
  if (typeof valore === "string") return [[p, valore]];
  if (Array.isArray(valore)) return valore.flatMap((v, i) => foglie(v, `${p}.${i}`));
  if (valore && typeof valore === "object")
    return Object.entries(valore).flatMap(([k, v]) => foglie(v, p ? `${p}.${k}` : k));
  return [];
}

describe.each(ALL_LOCALES)("menzioni legali · %s", (lingua) => {
  const d = DIZIONARI[lingua];
  const testi = [
    ...foglie(d.legale, "legale"),
    ["contatti.form.privacyRiga", d.contatti.form.privacyRiga] as [string, string],
    ["contatti.form.newsletterCasella", d.contatti.form.newsletterCasella] as [string, string],
    ["nav.menzioniLegali", d.nav.menzioniLegali] as [string, string],
  ];

  it("ha esattamente le sezioni di LEGAL_SECTIONS", () => {
    expect(Object.keys(d.legale.sezioni).sort()).toEqual([...LEGAL_SECTIONS].sort());
  });

  it("nessuna parentesi quadra: i dati mancanti non si pubblicano", () => {
    const conQuadre = testi.filter(([, v]) => /[[\]]/.test(v)).map(([k]) => k);
    expect(conQuadre).toEqual([]);
  });

  it("nessuna em dash o en dash, nessun apostrofo o virgoletta ASCII", () => {
    const sporchi = testi.filter(([, v]) => /[—–'"]/.test(v)).map(([k]) => k);
    expect(sporchi).toEqual([]);
  });

  it("ogni sezione dichiara il suo ultimo aggiornamento, con l’anno", () => {
    for (const id of LEGAL_SECTIONS) {
      expect(d.legale.sezioni[id].aggiornato, id).toMatch(/\d{4}/);
    }
  });

  it("ogni blocco ha una sola chiave, fra h3, p e li", () => {
    for (const id of LEGAL_SECTIONS) {
      for (const blocco of d.legale.sezioni[id].blocchi) {
        const chiavi = Object.keys(blocco);
        expect(chiavi, id).toHaveLength(1);
        expect(["h3", "p", "li"], id).toContain(chiavi[0]);
      }
    }
  });

  it("i grassetti sono chiusi, e la riga sotto il modulo ha il suo link", () => {
    for (const [k, v] of testi) {
      expect(v.split("<b>").length, k).toBe(v.split("</b>").length);
    }
    // `privacyRiga` (19/10/2026) al posto di `privacyNota`; un link anche nella casella newsletter.
    expect(d.contatti.form.privacyRiga).toMatch(/^[^<]*<link>[^<]+<\/link>[^<]*$/);
    expect(d.contatti.form.newsletterCasella).toMatch(/^[^<]*<link>[^<]+<\/link>[^<]*$/);
  });
});

describe("menzioni legali · decisioni a registro", () => {
  it("l’Area Riservata non compare: si aggiunge quando esisterà", () => {
    // Decisione di Marco del 16/09/2026: niente trattamenti descritti al futuro.
    const testo = foglie(messaggiIt.legale)
      .map(([, v]) => v)
      .join(" ");
    expect(testo).not.toMatch(/area riservata/i);
  });

  it("la struttura dei blocchi è la stessa in tutte le lingue", () => {
    // `parita.test.ts` confronta le chiavi; qui si dice perché conta: un blocco in più
    // in una lingua sposta tutti i successivi, e la pagina mescola i paragrafi.
    const forma = (l: keyof typeof DIZIONARI) =>
      LEGAL_SECTIONS.map((id) =>
        DIZIONARI[l].legale.sezioni[id].blocchi.map((b) => Object.keys(b)[0]).join(","),
      );
    for (const lingua of ALL_LOCALES) expect(forma(lingua), lingua).toEqual(forma("it"));
  });
});
