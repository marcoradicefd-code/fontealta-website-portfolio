import "server-only";

import { defineLive } from "next-sanity/live";

import { client } from "./client";

const serverToken = process.env.SANITY_API_READ_TOKEN;

/**
 * `sanityFetch`: typed GROQ fetch with ISR + draft mode support.
 * `SanityLive`: client component to drop in [locale]/layout.tsx for live revalidation.
 *
 * NB: serverToken is only required to read drafts (preview). Production reads
 * use the public dataset and don't need a token. We pass it conditionally so
 * dev preview works once the .env.local is populated (see TODO.md).
 *
 * Nessuna scadenza a tempo sulle fetch: la freschezza viene dal webhook
 * (/api/revalidate), che fa `revalidateTag` sui `tags` espliciti di ogni
 * sanityFetch (Fix B). La cache delle rotte sta nei segmenti: schede
 * `revalidate = false`, liste `revalidate = 86400`.
 *
 * ⚠️ Da next-sanity 13 (15/10/2026) `fetchOptions` non esiste più: `revalidate:
 * false` è scritto nel codice di next-sanity sulla fetch del risultato
 * (`dist/live/conditions/react-server/index.js`, la condizione che Next carica
 * SENZA `cacheComponents`), e i nostri `tags` finiscono in `next.tags`. La fetch
 * che cerca i sync tag invece non va più in cache dati (guida di migrazione,
 * «sanityFetch in cacheComponents: false mode no longer caches the internal
 * sync-tag lookup request»): non abbassa il `revalidate` della rotta, misurato
 * sul `prerender-manifest`. <SanityLive> resta deliberatamente non montato.
 */
export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: serverToken && serverToken.length > 0 ? serverToken : false,
  browserToken: false,
});
