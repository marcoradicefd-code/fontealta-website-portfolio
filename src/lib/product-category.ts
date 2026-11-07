/**
 * FRONT 2 — macro-categoria (6) dal campo Sanity `productMacro`.
 *
 * Sorgente unica condivisa (ordine di render + classificazione): usata da
 * CollectionCard (label-macro), dal filtro categoria ModelsSection (toggle) e da
 * CollectionHero (label hero). Label i18n nel namespace `productCategories`.
 *
 * ORDINE: le tre macro storiche restano nella posizione bloccata da PR #48 +
 * f444279, le tre di FRONT 2 sono in coda. Appendere invece di riordinare
 * significa che NIENTE di esistente si muove.
 */
export const MACRO_ORDER = ["lavabo", "doccia", "vasca", "cucina", "giardino", "bidet"] as const;
export type MacroKey = (typeof MACRO_ORDER)[number];

/**
 * Macro-categoria di un modello. Dal 28/07/2026 (PR-B) legge SOLO `productMacro`:
 * il ripiego su `categoryKey(productType)` è stato rimosso insieme al campo legacy,
 * che era popolato su 595/595 e quindi non veniva più esercitato da nessun articolo.
 *
 * La validazione contro `MACRO_ORDER` non è pedanteria: lo Studio vincola il campo
 * all'enum, ma una scrittura diretta via `@sanity/client` bypassa quella validazione,
 * quindi un valore fuori enum resta fisicamente possibile. Senza il controllo verrebbe
 * accettato e poi scartato in silenzio dai `MACRO_ORDER.filter(...)` dei consumatori:
 * l'articolo sparirebbe dai filtri senza un errore da nessuna parte. Il `console.error`
 * è quel che resta della vecchia rete: non ripariamo il dato (non c'è più niente su cui
 * ripiegare) ma lo rendiamo rumoroso — server-side finisce nei runtime log, client-side
 * nella console. Non si solleva: un refuso in un dato non deve portare giù una pagina.
 */
export function resolveMacro(model: { productMacro?: string | null }): MacroKey | null {
  if (!model.productMacro) return null;
  if ((MACRO_ORDER as readonly string[]).includes(model.productMacro)) {
    return model.productMacro as MacroKey;
  }
  console.error(
    `[taxonomy] productMacro fuori enum: «${model.productMacro}» — l'articolo sparisce dai filtri.`,
  );
  return null;
}
