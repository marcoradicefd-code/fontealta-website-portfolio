import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La regola di ripiego di ogni campo localizzato, resa **esigibile**.
 *
 * ⚠️ **Il difetto che questo test coglie non è un bug: è una dimenticanza.** Una
 * query nuova che proietta `campo[$locale]` senza dire quale regola segue passa
 * typecheck, lint, build e ogni altro test — e il giorno che una lingua si
 * accende a metà serve italiano su una pagina tedesca, oppure `null` dove serviva
 * un titolo. Qui ogni occorrenza deve essere classificata, e una non classificata
 * fa cadere il test con il nome della query e la riga.
 *
 * Le tre classi, e perché esistono:
 *
 * 1. **`coalesce(campo[$locale], campo.it)`** — il campo è un'ETICHETTA: un nome,
 *    un titolo, il testo di un link. Senza, non si disegna niente. È la regola di
 *    `modelDisplayName`.
 * 2. **nudo, dichiarato qui sotto** — il campo è PROSA od ornamento: la regola è
 *    «nella lingua o niente», perché servirlo in italiano su una pagina tedesca è
 *    il difetto che `taglineForLocale` è nato per togliere.
 * 3. **`defined(campo[$locale])`** — non è una lettura, è un RILEVATORE DI
 *    ASSENZA: alimenta `contenutoNellaLingua`, cioè la regola «la SEO segue la
 *    lingua del contenuto». Avvolgerlo in un `coalesce` lo renderebbe sempre vero
 *    e spegnerebbe quella regola in silenzio, senza rompere niente di visibile.
 *    ⛔ **Questi tre non si toccano mai.**
 */

/** I campi che restano NUDI per scelta, con la ragione. Aggiungerne uno è una
 *  decisione, e va presa qui prima che nella query. */
const SENZA_RIPIEGO = new Set([
  "SITE_SETTINGS_QUERY.tagline",
  "CONCEALED_BODIES_INDEX_QUERY.description",
  "CONCEALED_BODY_BY_SLUG_QUERY.description",
  "MODEL_DETAIL_QUERY.description",
  // Le FAQ sono domande per mercato, non traduzioni (spec FAQ § 2.1): una lingua senza FAQ non
  // ha la sezione né il JSON-LD, e l'italiano su una pagina tedesca sarebbe il difetto qui sopra.
  "FAQ_QUERY.faq",
  // La descrizione per l'alt composto (spec contenuti-per-lingua § A): senza la lingua l'alt
  // non si compone e ripiega sull'alt italiano con lang="it". Un ripiego qui darebbe una
  // frase italiana senza lang su una pagina tedesca.
  "CONCEALED_BODIES_INDEX_QUERY.descrizioneAlt",
  "CONCEALED_BODY_BY_SLUG_QUERY.descrizioneAlt",
  "COLLECTION_DETAIL_QUERY.descrizioneAlt",
  "MODEL_DETAIL_QUERY.descrizioneAlt",
  // La pagina d'uso esce solo nella lingua in cui è scritta (spec seo-pagine-contenuto § 5, c1b):
  // il cancello è il titolo, e un'introduzione o un corpo italiani sotto un indirizzo tedesco
  // sarebbero proprio la pagina che il cancello esclude.
  "USE_PAGE_QUERY.intro",
  "USE_PAGE_QUERY.body",
]);

interface Occorrenza {
  query: string;
  campo: string;
  classe: "coalesce" | "defined" | "nudo";
  riga: string;
}

function occorrenze(): Occorrenza[] {
  // Percorso da `process.cwd()`: sotto jsdom `import.meta.url` è un URL http e
  // la lettura fallisce con «The URL must be of scheme file».
  const testo = readFileSync(join(process.cwd(), "sanity/lib/queries.ts"), "utf-8");
  const pezzi = testo.split(/^export const (\w+) = defineQuery\(`/m);
  const fuori: Occorrenza[] = [];

  for (let i = 1; i < pezzi.length; i += 2) {
    const query = pezzi[i];
    const corpo = pezzi[i + 1].split("`)")[0];
    for (const m of corpo.matchAll(/\[\$locale\]/g)) {
      const inizio = corpo.lastIndexOf("\n", m.index) + 1;
      const riga = corpo.slice(inizio, corpo.indexOf("\n", m.index)).trim();
      // Un commento non è una proiezione.
      if (riga.startsWith("//")) continue;
      const prima = corpo.slice(Math.max(0, m.index - 90), m.index);
      const aperto = (fn: string) =>
        prima.includes(fn) && prima.lastIndexOf(fn) > prima.lastIndexOf(")");
      const classe = aperto("coalesce(") ? "coalesce" : aperto("defined(") ? "defined" : "nudo";
      // Il nome del campo: la chiave proiettata, o l'identificatore stesso.
      const chiave = /"([^"]+)":/.exec(riga)?.[1] ?? /(\w+)\[\$locale\]/.exec(riga)?.[1] ?? "?";
      fuori.push({ query, campo: chiave, classe, riga });
    }
  }
  return fuori;
}

describe("ogni [$locale] dichiara la sua regola di ripiego", () => {
  it("ce n'è almeno una per classe: il test non passa a vuoto", () => {
    const o = occorrenze();
    expect(o.length, "nessuna occorrenza trovata: la sonda non legge il file").toBeGreaterThan(10);
    for (const classe of ["coalesce", "defined", "nudo"] as const) {
      expect(
        o.filter((x) => x.classe === classe).length,
        `nessuna occorrenza di classe ${classe}`,
      ).toBeGreaterThan(0);
    }
  });

  it("nessuna occorrenza nuda fuori dall'elenco dichiarato", () => {
    const nude = occorrenze()
      .filter((x) => x.classe === "nudo")
      .map((x) => `${x.query}.${x.campo}`);
    const nonDichiarate = nude.filter((k) => !SENZA_RIPIEGO.has(k));
    expect(
      nonDichiarate,
      `campi nudi non dichiarati: decidere la regola e aggiungerli a SENZA_RIPIEGO, oppure avvolgerli in coalesce\n  ${nonDichiarate.join("\n  ")}`,
    ).toEqual([]);
  });

  it("l'elenco non invecchia: ogni campo dichiarato esiste ancora", () => {
    // Il difetto opposto, e meno ovvio: una voce rimasta nell'elenco dopo che la
    // query è cambiata fa sembrare decisa una cosa che non c'è più.
    const nude = new Set(
      occorrenze()
        .filter((x) => x.classe === "nudo")
        .map((x) => `${x.query}.${x.campo}`),
    );
    expect([...SENZA_RIPIEGO].filter((k) => !nude.has(k))).toEqual([]);
  });

  it("i rilevatori di assenza restano tre, e sono quelli", () => {
    // ⛔ Se questo numero cambia, qualcuno ha toccato `contenutoNellaLingua`.
    const rilevatori = occorrenze()
      .filter((x) => x.classe === "defined")
      .map((x) => x.query)
      .sort();
    expect(rilevatori).toEqual([
      "CONCEALED_BODY_BY_SLUG_QUERY",
      "MODEL_DETAIL_QUERY",
      "POST_BY_SLUG_QUERY",
    ]);
  });

  it("le etichette hanno tutte il ripiego sull'italiano", () => {
    const coalesced = occorrenze().filter((x) => x.classe === "coalesce");
    for (const x of coalesced) {
      expect(x.riga, `${x.query}.${x.campo} non ripiega su .it`).toMatch(/\.it\b/);
    }
    expect(coalesced.length, "meno coalesce del previsto").toBeGreaterThanOrEqual(15);
  });
});
