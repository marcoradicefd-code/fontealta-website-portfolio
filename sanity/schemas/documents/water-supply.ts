/**
 * Marcatore acqua calda/fredda (le «gocce» del catalogo stampato).
 *
 * SORGENTE UNICA, condivisa da `model` e `concealedBody`. Vive qui e non dentro
 * `model.ts` per la stessa ragione di `model-taxonomy.ts`: due copie della stessa
 * lista divergono al primo ritocco, e la divergenza si manifesta come un valore che
 * uno schema accetta e l'altro rifiuta — invisibile finché qualcuno non salva.
 *
 * Il modulo NON importa da `sanity`, così resta consumabile anche da uno script Node
 * (gli one-shot scrivono via `@sanity/client`, fuori dallo Studio).
 *
 * `none` esiste per gli accessori senza alimentazione: sui `model` è usato, sui
 * `concealedBody` no — i 17 corpi sono tutti `cold` o `hot-cold`. La lista resta
 * comunque una sola: un corpo senza acqua è concepibile, e vincolarlo a due valori
 * significherebbe scoprire il terzo il giorno in cui serve.
 */
export const WATER_SUPPLY = [
  { title: "Solo acqua fredda", value: "cold" },
  { title: "Acqua calda e fredda", value: "hot-cold" },
  { title: "Nessuna (accessorio)", value: "none" },
] as const;

/** I soli valori, per le guardie degli script one-shot. */
export const WATER_SUPPLY_VALUES: readonly string[] = WATER_SUPPLY.map((w) => w.value);
