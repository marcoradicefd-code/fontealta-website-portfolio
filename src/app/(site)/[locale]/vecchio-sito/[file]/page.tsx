import { notFound, permanentRedirect } from "next/navigation";

import { getAllCollectionSlugs, getAllModelSlugs } from "@/lib/content";
import { destinazioneVecchioSito } from "@/lib/vecchio-sito";

/**
 * Gli indirizzi `.aspx` del vecchio sito (20/10/2026). Non ci si arriva da un link: li manda qui la
 * rewrite di `next.config.ts` (`rewriteDopoIFile` in `src/lib/redirects.ts`), che porta
 * `/COLLEZIONE-CODICE.aspx` a `/it/vecchio-sito/COLLEZIONE-CODICE.aspx`.
 *
 * Scheda viva → 308 alla scheda; codice fuori produzione o variante → 308 alla collezione; nessuna
 * corrispondenza → 404. 308 e non 301: per Google sono lo stesso redirect permanente
 * (https://developers.google.com/search/docs/crawling-indexing/301-redirects, riga «Permanent»), ed
 * è il codice degli altri redirect del sito (`permanent: true`). La regola sta in
 * `src/lib/vecchio-sito.ts`; qui si leggono solo gli slug vivi, con la cache per tag (`model`,
 * `collection`): un modello pubblicato domani funziona senza deploy.
 *
 * ⚠️ **`revalidate = 0`, e non le altre due forme provate il 20/10 su `next start`:**
 * - in ISR (`revalidate = false`, come la scheda) la PRIMA risposta, quella `MISS`, usciva con DUE
 *   intestazioni `Location` identiche, e ogni indirizzo sconosciuto diventava una voce ISR con la
 *   sua scrittura, proprio il costo che la rule `cache-isr` chiede di evitare per i bot;
 * - con `dynamic = "force-dynamic"` la `Location` era una sola, ma la lista dei modelli NON
 *   entrava nella cache dati: la guida di Next dice che equivale a `cache: 'no-store'` su ogni
 *   fetch.
 * Con `revalidate = 0` la pagina è dinamica (`no-store`, nessuna scrittura ISR), la `Location` è una
 * sola, e le due liste restano nella cache dati coi loro tag: la guida, «Ensure a layout or page is
 * always dynamically rendered … but leaves fetch requests that opt into 'force-cache' … as is»
 * (`caching-without-cache-components.md`), e misurato sulla cartella `fetch-cache`.
 */
export const revalidate = 0;

export default async function VecchioSito({
  params,
}: {
  params: Promise<{ locale: string; file: string }>;
}) {
  const { file } = await params;
  const [modelli, collezioni] = await Promise.all([getAllModelSlugs(), getAllCollectionSlugs()]);
  const destinazione = destinazioneVecchioSito(
    file,
    new Set(modelli.map((m) => m.slug).filter((s): s is string => Boolean(s))),
    new Set(collezioni.map((c) => c.slug).filter((s): s is string => Boolean(s))),
  );
  if (!destinazione) notFound();
  permanentRedirect(destinazione);
}
