/**
 * I namespace dei messaggi che il BROWSER riceve davvero.
 *
 * Il layout passava a `NextIntlClientProvider` il dizionario intero: ~38 KB per pagina,
 * di cui **15 di `legale`**, che nessun componente client legge — le menzioni legali sono
 * rese dal server. Qui si passa il solo sottoinsieme che serve: misurato il 21/09/2026,
 * da 38,1 a 7,9 KB in italiano e lo stesso ordine di grandezza nelle altre quattro lingue.
 *
 * ⚠️ **L'elenco NON è «i namespace dei file con `"use client"`».** Un componente senza il
 * direttivo, importato da uno che ce l'ha, è client lo stesso: `model-card.tsx` è di questi,
 * e usa `modello` e `productSubtypes`. Togliendoli, le card dentro la griglia filtrata
 * fallirebbero a runtime con `MISSING_MESSAGE` — e non lo vedrebbe nessun test di unità,
 * perché il markup del server resta identico.
 *
 * Chi lo tiene onesto è `client-messages.test.ts`, che ricostruisce la **chiusura
 * transitiva degli import** a partire dai file `"use client"` e pretende che ogni namespace
 * trovato lì sia in questo elenco. Un componente client nuovo che usa un namespace non
 * elencato fa fallire quel test, non la pagina in produzione.
 */
export const CLIENT_NAMESPACES = [
  "contatti",
  "corpiIncasso",
  "dettaglio",
  "errorPages",
  "home",
  "modello",
  "nav",
  "productCategories",
  "productSubtypes",
] as const;

export type ClientNamespace = (typeof CLIENT_NAMESPACES)[number];

/**
 * Tiene del dizionario i soli namespace di `CLIENT_NAMESPACES`.
 *
 * Un namespace assente dal dizionario viene semplicemente saltato: non è un caso che
 * debba rompere il render: `parita.test.ts` è il posto dove un dizionario incompleto
 * viene preso, e lì fallisce per tutte e cinque le lingue insieme.
 */
export function pickClientMessages<T extends Record<string, unknown>>(messages: T): Partial<T> {
  const out: Partial<T> = {};
  for (const ns of CLIENT_NAMESPACES) {
    if (ns in messages) out[ns as keyof T] = messages[ns as keyof T];
  }
  return out;
}
