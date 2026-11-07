import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALES, ALL_LOCALES } from "@/i18n/routing";

import {
  ALLOWED_IDENTICAL,
  ALLOWED_IDENTICAL_BY_LOCALE,
  allowedIdenticalFor,
} from "./allowed-identical";

import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import itMessages from "./it.json";

/**
 * I cinque dizionari hanno le stesse chiavi, e nessuno è a metà.
 *
 * ⚠️ **La guardia è sulle CHIAVI, non sul loro numero.** Un test che dicesse
 * «414 foglie» sarebbe rosso il giorno che qualcuno aggiunge una stringa
 * legittima, e verde il giorno che ne toglie una da un file e ne aggiunge
 * un'altra altrove: conterebbe giusto e descriverebbe due dizionari diversi. Qui
 * si confrontano gli insiemi, e il messaggio dice **quale** chiave manca e dove.
 *
 * ⚠️ **`de/fr/es` nascono dalle chiavi E dai valori di `en.json`**, non da
 * `it.json`, e non è indifferente: se una pagina tedesca sfuggisse accesa a
 * metà, mostrerebbe **inglese**, che un lettore tedesco ha qualche probabilità
 * di capire, invece di italiano, che non ha nessuna ragione di capire.
 */

const DIZIONARI = { it: itMessages, en, de, fr, es } as const;

/**
 * Tutte le chiavi foglia in forma piatta: `namespace.chiave.annidata`.
 *
 * ⚠️ **Scende anche negli ARRAY**, e non è un dettaglio: `privacy.sections` e
 * `cookie.sections` sono array di `{ heading, body }`, cioè **decine di stringhe
 * di copy legale**. Un camminatore che si fermasse agli oggetti le salterebbe
 * tutte, e il test direbbe «parità» guardando meno di due terzi del dizionario.
 * Le voci escono come `privacy.sections.0.heading`.
 *
 * Prende `unknown` e restringe dentro, invece di dichiarare una forma e poi
 * forzarla con un cast: la forma vera dei messaggi include gli array, e un cast
 * l'avrebbe nascosta al typecheck invece di modellarla.
 */
function foglie(valore: unknown, p = ""): Map<string, string> {
  const fuori = new Map<string, string>();
  if (typeof valore === "string") {
    if (p) fuori.set(p, valore);
    return fuori;
  }
  if (Array.isArray(valore)) {
    valore.forEach((v, i) => {
      for (const [k, vv] of foglie(v, `${p}.${i}`)) fuori.set(k, vv);
    });
    return fuori;
  }
  if (valore && typeof valore === "object") {
    for (const [k, v] of Object.entries(valore)) {
      for (const [kk, vv] of foglie(v, p ? `${p}.${k}` : k)) fuori.set(kk, vv);
    }
  }
  return fuori;
}

describe("parità dei dizionari", () => {
  it("i cinque file coprono tutte e sole le lingue dichiarate", () => {
    // Se una lingua entra in `ALL_LOCALES` senza il suo file, la scoperta deve
    // avvenire qui e non al primo `import` a runtime.
    expect(Object.keys(DIZIONARI).sort()).toEqual([...ALL_LOCALES].sort());
  });

  for (const lingua of ALL_LOCALES) {
    if (lingua === "it") continue;
    it(`${lingua}.json ha esattamente le chiavi di it.json`, () => {
      const attese = [...foglie(itMessages).keys()].sort();
      const presenti = [...foglie(DIZIONARI[lingua]).keys()].sort();
      const mancanti = attese.filter((k) => !presenti.includes(k));
      const inPiu = presenti.filter((k) => !attese.includes(k));
      expect(mancanti, `chiavi mancanti in ${lingua}.json`).toEqual([]);
      expect(inPiu, `chiavi di troppo in ${lingua}.json`).toEqual([]);
    });
  }

  for (const lingua of ALL_LOCALES) {
    it(`${lingua}.json non ha valori vuoti`, () => {
      // Una stringa vuota non è una traduzione mancante che si nota: è un'etichetta
      // che sparisce dalla pagina senza rompere niente.
      const vuote = [...foglie(DIZIONARI[lingua])]
        .filter(([, v]) => v.trim() === "")
        .map(([k]) => k);
      expect(vuote, `valori vuoti in ${lingua}.json`).toEqual([]);
    });
  }
});

/**
 * ⛔ **Il cancello che impedisce di accendere una lingua a metà.**
 *
 * Per ogni lingua ATTIVA diversa dall'inglese, nessun valore può essere identico
 * a quello inglese fuori dalle ammesse di quella lingua. Oggi gira sull'**italiano** e
 * passa perché i suoi 44 valori identici sono esattamente quelli ammessi; il
 * giorno che `de` entra in `ACTIVE_LOCALES` con `de.json` ancora uguale a
 * `en.json`, questo test diventa rosso su 370 chiavi e la lingua non si accende.
 *
 * ⚠️ **Le ammesse stanno in `./allowed-identical.ts`** dal 14/09/2026: le 44 comuni e le
 * eccezioni per lingua, con la ragione. Aggiungerne una è una decisione, e va presa lì.
 */
describe("nessuna lingua attiva è a metà", () => {
  const inglese = foglie(en);

  for (const lingua of ACTIVE_LOCALES) {
    if (lingua === "en") continue;
    const ammesse = allowedIdenticalFor(lingua);
    it(`${lingua} non ripete l'inglese fuori dalle ${ammesse.size} ammesse`, () => {
      const uguali = [...foglie(DIZIONARI[lingua])]
        .filter(([k, v]) => inglese.get(k) === v)
        .map(([k]) => k);
      const nonAmmesse = uguali.filter((k) => !ammesse.has(k));
      expect(
        nonAmmesse,
        `${lingua}.json ripete l'inglese su chiavi non dichiarate: o si traduce, o si aggiunge in allowed-identical.ts con la ragione\n  ${nonAmmesse.join("\n  ")}`,
      ).toEqual([]);
    });
  }

  it("l'elenco delle ammesse non invecchia", () => {
    // Il difetto opposto: una voce che resta dopo che la stringa è stata
    // tradotta fa sembrare concessa una deroga che non serve più.
    const italiano = foglie(itMessages);
    const orfane = [...ALLOWED_IDENTICAL].filter((k) => inglese.get(k) !== italiano.get(k));
    expect(orfane, "voci di ALLOWED_IDENTICAL che non sono più identiche fra it ed en").toEqual([]);
  });

  it("le eccezioni per lingua non invecchiano", () => {
    // Una voce vale solo finché in quella lingua la parola resta identica all'inglese:
    // se la traduzione cambia, la deroga non serve più e va tolta.
    for (const [lingua, voci] of Object.entries(ALLOWED_IDENTICAL_BY_LOCALE)) {
      const dizionario = foglie(DIZIONARI[lingua as keyof typeof DIZIONARI]);
      const orfane = Object.keys(voci).filter((k) => dizionario.get(k) !== inglese.get(k));
      expect(orfane, `eccezioni di ${lingua} non più identiche all'inglese`).toEqual([]);
    }
  });

  it("ogni eccezione per lingua è una chiave vera, non doppia, con la ragione", () => {
    const italiano = foglie(itMessages);
    for (const [lingua, voci] of Object.entries(ALLOWED_IDENTICAL_BY_LOCALE)) {
      for (const [chiave, ragione] of Object.entries(voci)) {
        expect(italiano.has(chiave), `${lingua} · ${chiave} non esiste in it.json`).toBe(true);
        expect(ALLOWED_IDENTICAL.has(chiave), `${lingua} · ${chiave} è già fra le comuni`).toBe(
          false,
        );
        expect(ragione.trim(), `${lingua} · ${chiave} senza ragione`).not.toBe("");
      }
    }
  });

  it("oggi il cancello gira davvero, e non a vuoto", () => {
    // Se `ACTIVE_LOCALES` contenesse solo `en`, i test qui sopra non girerebbero
    // e questo file passerebbe senza guardare niente.
    expect(ACTIVE_LOCALES.filter((l) => l !== "en").length).toBeGreaterThan(0);
  });
});
