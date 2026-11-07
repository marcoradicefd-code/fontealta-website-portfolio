import { stripTrailingSlashes } from "./trailing-slashes";

/**
 * ⚠️ **Il cancello M20 non sta più qui** (17/09/2026). Qui c'era
 * `isIndexableSiteUrl`, che decideva l'indicizzazione dal solo
 * `NEXT_PUBLIC_SITE_URL`: ma su Vercel la variabile è una sola per Production e
 * Preview, e da quando vale `https://fontealta.it` apriva anche le anteprime.
 * `robots.ts` e l'header `X-Robots-Tag` in `next.config.ts` leggono ora
 * `VERCEL_ENV === "production"`, e la funzione è stata tolta perché nessuno la usava
 * più.
 */

/**
 * La base assoluta dei canonical e del JSON-LD.
 *
 * ⚠️ È lo STESSO valore che tre `generateMetadata` — `blog/page.tsx`,
 * `blog/[slug]/page.tsx`, `produzione/page.tsx` — scrivono inline. Qui non nasce
 * una seconda base: nasce l'unico posto in cui scriverla, e le tre copie inline
 * restano da consolidare nella PR SEO (debito M24-bis). Il codice nuovo passa da
 * qui, così il consolidamento sarà una sostituzione e non un'archeologia.
 *
 * In produzione oggi risolve all'alias `fontealta-website-sigma.vercel.app` —
 * verificato sull'HTML servito — ed è ATTESO fino al cutover DNS (M27), quando
 * `NEXT_PUBLIC_SITE_URL` cambierà nella stessa finestra dei canonical.
 *
 * ⚠️ **Lo slash finale della variabile si toglie qui, una volta per tutte.** Su
 * Vercel `NEXT_PUBLIC_SITE_URL` è scritta CON lo slash, e chi legge questa
 * funzione la concatena come stringa in tre punti: il risultato misurato in
 * produzione il 9/09 era `…app//brand/fontealta-monogram-gray.png` nel logo
 * dell'`Organization`, che risponde **308** invece di 200, e al cutover sarebbe
 * diventato `Sitemap: https://fontealta.it//sitemap.xml` in `robots.txt` —
 * cioè il puntatore che Google segue.
 *
 * ⚠️ **Nessun test poteva vederlo**, ed è la parte che vale: in locale la
 * variabile non è impostata e il fallback non ha lo slash, quindi la guardia
 * girava su una base sana mentre la produzione ne serviva una malformata. La
 * normalizzazione sta QUI e non nei tre punti che concatenano, perché una
 * variabile scritta a mano non deve poter produrre un URL storto: è la stessa
 * ragione per cui `absoluteUrl` toglie lo slash della radice.
 */
export function siteUrl(): string {
  return stripTrailingSlashes(process.env.NEXT_PUBLIC_SITE_URL ?? "https://fontealta.it");
}
