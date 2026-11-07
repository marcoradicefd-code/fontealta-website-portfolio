/**
 * FRONT 2 — tabelle della tassonomia prodotto, sorgente UNICA.
 *
 * Estratte da `model.ts` perché servono a due consumatori che devono essere
 * provabilmente d'accordo:
 *   1. lo schema Studio (dropdown + validazione della coppia macro/sottotipo);
 *   2. lo script di migrazione one-shot (`scripts/migrate-taxonomy.ts`), che
 *      scrive via `@sanity/client` BYPASSANDO la validazione dello Studio.
 *
 * Se le due copie divergessero, la migrazione scriverebbe coppie che lo Studio
 * poi rifiuta — un disallineamento invisibile fino al primo salvataggio manuale.
 * Questo modulo NON importa da `sanity`, così è consumabile da uno script Node
 * senza tirarsi dietro il pacchetto Studio.
 *
 * Piano completo: `docs/front2-design.md`.
 */

export const PRODUCT_MACROS = [
  { title: "Lavabo", value: "lavabo" },
  { title: "Doccia", value: "doccia" },
  { title: "Vasca", value: "vasca" },
  { title: "Cucina", value: "cucina" },
  { title: "Giardino", value: "giardino" },
  { title: "Bidet", value: "bidet" },
] as const;

/** 24 sottotipi, in ordine alfabetico per renderli cercabili nel dropdown Studio. */
export const PRODUCT_SUBTYPES = [
  { title: "Accessori", value: "accessori" },
  { title: "Accessori colonna", value: "accessori-colonna" },
  { title: "Batteria 3 fori", value: "batteria-3-fori" },
  { title: "Bocca", value: "bocca" },
  // ⚠️ `title` è SOLO l'etichetta del dropdown Studio; il `value` è la chiave che
  // finisce nei dati e nei filtri e NON si tocca. «Body Jet» (29/07, Andrea): la
  // grafia dev'essere la stessa ovunque, compreso lo strumento dove si lavora.
  { title: "Body Jet", value: "bodyjet" },
  { title: "Braccio", value: "braccio" },
  { title: "Braccio con soffione", value: "braccio-con-soffione" },
  { title: "Cascata", value: "cascata" },
  { title: "Colonna", value: "colonna" },
  { title: "Colonna divisibile", value: "colonna-divisibile" },
  { title: "Doccetta", value: "doccetta" },
  { title: "Erogazione parete", value: "erogazione-parete" },
  { title: "Flessibile", value: "flessibile" },
  { title: "Kit", value: "kit" },
  { title: "Miscelatore", value: "miscelatore" },
  { title: "Miscelatore parete", value: "miscelatore-parete" },
  { title: "Pannello", value: "pannello" },
  { title: "Ponte", value: "ponte" },
  { title: "Rubinetto", value: "rubinetto" },
  { title: "Rubinetto parete", value: "rubinetto-parete" },
  { title: "Saliscendi", value: "saliscendi" },
  { title: "Scarico", value: "scarico" },
  { title: "Soffione", value: "soffione" },
  { title: "Soffitto", value: "soffitto" },
] as const;

/**
 * Combinazioni ammesse, derivate dal catalogo reale (595 articoli →
 * `scripts/data/taxonomy-v2-2026-07-25.json`): 33 coppie effettive sulle 144
 * teoricamente possibili. Alimenta la validazione del campo `productSubtype` in
 * Studio e la guardia G4 dello script di migrazione.
 * Se il listino introdurrà una coppia nuova, si aggiunge il valore qui.
 */
export const MACRO_SUBTYPES: Record<string, readonly string[]> = {
  lavabo: ["batteria-3-fori", "bocca", "colonna", "miscelatore", "rubinetto", "scarico"],
  doccia: [
    "accessori",
    "accessori-colonna",
    "bodyjet",
    "braccio",
    "braccio-con-soffione",
    "cascata",
    "colonna",
    "colonna-divisibile",
    "doccetta",
    "erogazione-parete",
    "flessibile",
    "kit",
    "miscelatore",
    "miscelatore-parete",
    "pannello",
    "ponte",
    "rubinetto",
    "rubinetto-parete",
    "saliscendi",
    "soffione",
    "soffitto",
  ],
  vasca: ["colonna", "miscelatore"],
  cucina: ["miscelatore"],
  giardino: ["colonna", "rubinetto-parete"],
  bidet: ["miscelatore"],
};

export const MACRO_VALUES: readonly string[] = PRODUCT_MACROS.map((m) => m.value);
export const SUBTYPE_VALUES: readonly string[] = PRODUCT_SUBTYPES.map((s) => s.value);

/**
 * Etichetta del catalogo (MAIUSCOLA, es. "MISCELATORE PARETE") → slug enum
 * ("miscelatore-parete"). Regola unica: minuscolo, spazi → trattino. Il chiamante
 * DEVE validare il risultato contro `SUBTYPE_VALUES`: questa funzione non
 * garantisce che lo slug esista, solo che sia derivato in modo deterministico.
 */
export function toSlug(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "-");
}
