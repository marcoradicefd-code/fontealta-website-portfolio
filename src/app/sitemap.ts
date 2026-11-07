import type { MetadataRoute } from "next";

import { vociSitemap } from "@/lib/sitemap";
import { client } from "@/sanity/lib/client";
import { SITEMAP_QUERY } from "@/sanity/lib/queries";

/**
 * `/sitemap.xml`.
 *
 * Sta in `src/app/`, non sotto `(site)/[locale]/`: è **una** sitemap per tutto il
 * sito, con una voce per ogni pagina in ogni lingua attiva e la mappa hreflang su
 * ciascuna. Il proxy di next-intl non la tocca, perché il suo matcher scarta ogni
 * percorso con un'estensione (`src/proxy.ts:19`), esattamente come per
 * `robots.txt`.
 */

/**
 * ⚠️ **Rotta dinamica, e la query non passa da nessuna cache. Non è pigrizia:
 * è la fine di quattro tentativi, tutti misurati in produzione il 9/09/2026.**
 *
 * Il problema di partenza: la sitemap non si aggiornava quando un documento
 * veniva pubblicato su Sanity. Le quattro misure, in ordine, ognuna delle quali
 * ha scartato una spiegazione plausibile:
 *
 * 1. **Solo build (#162).** `x-vercel-cache: HIT` **senza**
 *    `x-nextjs-prerender`, `age` crescente dal deploy, mentre ogni pagina
 *    risponde `STALE` **con** `x-nextjs-prerender: 1`. Si rinfrescava al deploy
 *    e basta.
 * 2. **`revalidate = 3600` (#163) non scatta.** Letture alle 10:28:31Z con
 *    `age 3635` e alle 10:29:43Z con `age 3707`: entrambe `HIT`, nessuno
 *    `STALE`, `lastmod` fermo. Oltre i 3600 secondi la scadenza **non** ha
 *    prodotto una rigenerazione: su Vercel questa rotta non partecipa all'ISR
 *    come lo fa una pagina.
 * 3. **`revalidatePath("/sitemap.xml")` (#164) fa il suo lavoro, e non basta.**
 *    Publish alle 10:33:38Z; lettura alle 12:02:36Z **`MISS` con `age 0`**: la
 *    rotta *si è* ricostruita. Ma il `lastmod` servito era `09:33:15Z`, cioè
 *    **il publish precedente**. La rotta si ricompone, e legge un dato vecchio.
 * 4. **È la cache dati di Next.** `sanityFetch` mette sulle sue fetch
 *    `revalidate: false` (fino a next-sanity 12 da `fetchOptions` in
 *    `sanity/lib/live.ts`; da next-sanity 13, ottobre 2026, è scritto nel
 *    codice di next-sanity, `dist/live/conditions/react-server/index.js:53`),
 *    cioè una voce che non scade **mai** per tempo: si muove solo a tag. Il valore che
 *    finisce lì dentro al momento della rigenerazione ci resta fino
 *    all'invalidazione successiva, e la firma misurata — sempre esattamente
 *    **un publish indietro**, mai due — è quella di una voce riscritta con un
 *    dato non ancora aggiornato e poi bloccata senza scadenza.
 *
 * ⚠️ **Il CDN di Sanity è escluso, non assunto innocente.** Era il sospetto
 * ovvio. `sanityFetch` imposta `cacheMode: "noStale"` quando `useCdn` è vero
 * (`next-sanity/dist/live/conditions/react-server/index.js:32`, in 13.3.4), il client lo
 * mette in query string (`@sanity/client/dist/index.js:986`) e la sua
 * documentazione dice «APICDN will not return a cached response if the content
 * is stale». Quindi non è APICDN a servire lo scatto vecchio.
 *
 * ⚠️ **Cosa resta non stabilito, e va detto.** *Perché* la voce di cache venga
 * riscritta con un dato precedente all'invalidazione non è stato dimostrato
 * dall'interno: sarebbe una corsa fra `revalidateTag` e la rigenerazione, in due
 * store distinti sul bordo di Vercel, che da qui non si osserva. Quello che è
 * dimostrato è il **comportamento**: quattro configurazioni, quattro misure, e
 * un dato sempre in ritardo di un publish. Il caso non è isolato —
 * https://community.vercel.com/t/revalidatepath-sitemap-xml-returns-202-but-sitemap-cache-remains-hit-on-preview/48397
 * riporta `revalidatePath('/sitemap.xml')` che risponde 202 mentre la sitemap
 * resta `HIT`.
 *
 * La cura smette di cercare la cache giusta e toglie di mezzo tutte le cache
 * che stanno fra il publish e i byte serviti:
 *
 * - **`dynamic = "force-dynamic"`** invece di `revalidate`: la rotta si
 *   ricostruisce a ogni richiesta. Nel tabellone del build passa da `○` a `ƒ`.
 * - **`client.fetch` diretto invece di `sanityFetch`**, perché `sanityFetch`
 *   **non accetta opzioni di cache**: la sua firma (`defineLive.d.ts`) è
 *   `{ query, params, tags, perspective, stega, requestTag }` e basta. Il
 *   `revalidate` non si sceglie per chiamata: da next-sanity 13 è `false` fisso
 *   nel codice della libreria. E `useCdn` non è nemmeno un parametro:
 *   `sanityFetch` lo calcola da sé come `perspective === "published"`
 *   (`react-server/index.js:30`, in 13.3.4), quindi da lì `useCdn: false` è
 *   irraggiungibile.
 * - **`cache: "no-store"`** toglie la cache dati di Next, **`useCdn: false`**
 *   toglie APICDN: la query legge il Content Lake vivo a ogni richiesta.
 *
 * ⚠️ **Il prezzo, detto per intero.** 1312 voci ricostruite a ogni richiesta,
 * crawler compresi, dove prima la query girava una volta l'ora. È accettabile
 * perché una sitemap la si legge di rado e per una macchina, ma se un giorno
 * comparisse nei tempi di risposta la leva è questa riga, non un'altra cache.
 *
 * ⚠️ **`tags` non c'è più, ed è deliberato.** Con `no-store` non esiste una voce
 * di cache a cui attaccarli: passarli sarebbe una promessa vuota, la stessa
 * ragione per cui `revalidatePath("/sitemap.xml")` è stato tolto dal webhook.
 * Per lo stesso motivo sono spariti `TIPI_IN_SITEMAP` e `tipoInSitemap`, nati in
 * #164: erano la sorgente unica di quei due consumatori, e senza consumatori una
 * costante «autorevole» è solo qualcosa che qualcuno userà credendola vera.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await client.fetch(
    SITEMAP_QUERY,
    {},
    {
      // ⚠️ `perspective: "published"`: la sitemap non deve mai contenere una
      // bozza, che pubblicherebbe l'URL di una pagina che i visitatori non
      // vedono.
      perspective: "published",
      stega: false,
      useCdn: false,
      cache: "no-store",
    },
  );

  // Nessun `??` che inventa: se il fetch non torna, le liste sono vuote e la
  // sitemap contiene le sole rotte statiche. È l'unico grado di degrado sensato
  // — una sitemap parziale è meglio di una route che va in errore — ma resta
  // visibile, perché il conteggio crolla da 1312 a 22.
  return vociSitemap({
    collections: data?.collections ?? [],
    models: data?.models ?? [],
    bodies: data?.bodies ?? [],
    references: data?.references ?? [],
    posts: data?.posts ?? [],
    usePages: data?.usePages ?? [],
  });
}
