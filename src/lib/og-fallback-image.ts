import "server-only";

import type { ActiveLocale } from "@/i18n/routing";
import { getSiteSettings } from "@/lib/content";
import { OG_DEFAULT_IMAGE, ogImageScena } from "@/lib/open-graph";

/**
 * L'immagine di condivisione di riserva del sito: quella scelta in Studio se c'è,
 * altrimenti il file in `public/`.
 *
 * ⚠️ **Esiste perché `og:url` costringe ogni pagina a dichiarare il proprio
 * `openGraph`, e dichiararlo CANCELLA quello del layout.** Fino a questa PR
 * undici rotte non ne dichiaravano nessuno ed ereditavano il blocco del layout,
 * riserva compresa; aggiungere lì un `openGraph` nudo le avrebbe staccate da
 * `defaultSeo.ogImage` senza che si vedesse, perché quel campo **è vuoto oggi**
 * (misurato su Sanity l'11/09/2026: `defaultSeo.ogImage` è `null`, e tutte le
 * pagine servono `/og-default.jpg`). Il guasto sarebbe comparso il giorno che
 * Marco caricasse l'immagine da Studio e si accorgesse che raggiunge metà sito:
 * `CLAUDE.md` registra che quella leva vale **58 pagine su 102**.
 *
 * ⚠️ **Non sta in `open-graph.ts`, e non è una preferenza.** Quel file è puro e
 * ha il suo test; importarci `content.ts` ci porterebbe dentro `server-only`,
 * che fuori da un ambiente RSC **lancia all'import** — cioè «0 test» invece di
 * un test rosso, la firma già annotata quattro volte in questo repo.
 *
 * `ogImageScena` e non l'immagine grezza: porta a 1200×630 col ritaglio, che su
 * un'immagine già in quel formato è un ridimensionamento a vuoto e su una
 * caricata storta la salva.
 */
export async function fallbackOgImages(locale: ActiveLocale) {
  const settings = await getSiteSettings(locale);
  return settings?.defaultSeo?.ogImage?.asset
    ? ogImageScena(settings.defaultSeo.ogImage)
    : [{ ...OG_DEFAULT_IMAGE }];
}
