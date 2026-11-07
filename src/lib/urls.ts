import { getPathname } from "@/i18n/navigation";
import { ACTIVE_LOCALES, type ActiveLocale } from "@/i18n/routing";
import { siteUrl } from "@/lib/seo";

/**
 * URL assoluti e localizzati, per canonical, alternates, sitemap e JSON-LD.
 *
 * ⚠️ **Perché non sta in `seo.ts`, dove il perimetro lo chiedeva.** `seo.ts` è
 * importato da **`next.config.ts:5`**, che Next compila in
 * `next.config.compiled.js` e carica con Node **prima** del bundle dell'app: lì
 * l'alias `@/` non esiste. Provato, non dedotto: aggiungendo
 * `import { getPathname } from "@/i18n/navigation"` a `seo.ts` il build muore con
 * `MODULE_NOT_FOUND` su `src/lib/seo.ts`, con `next.config.compiled.js` nello
 * stack. Quindi `seo.ts` deve restare senza dipendenze dall'app, e tutto ciò che
 * tocca `routing`/`navigation` vive qui.
 *
 * ⚠️ **Si costruisce SOPRA `getPathname` di next-intl, non accanto.** È la
 * funzione che risolve la mappa `pathnames` ed è già usata da `breadcrumb.tsx`,
 * `breadcrumb-json-ld.tsx` e dalle `generateMetadata` esistenti. Una seconda
 * risoluzione fatta a mano (concatenare `/en` + slug) diverge il giorno che una
 * voce della mappa cambia, e diverge in silenzio.
 */

/**
 * La chiave di rotta, nella forma che `getPathname` accetta: o la stringa della
 * mappa (`"/collezioni"`), o `{ pathname, params }` per le rotte dinamiche
 * (`{ pathname: "/modello/[slug]", params: { slug: "b40l" } }`).
 *
 * Il tipo si deriva da `getPathname` e non si riscrive: così una chiave che non
 * esiste nella mappa è un errore di typecheck, non una 404 scoperta in
 * produzione. È lo stesso motivo per cui `breadcrumb.tsx:14` deriva il suo.
 */
export type RouteHref = Parameters<typeof getPathname>[0]["href"];

/**
 * URL assoluto della rotta nel locale dato.
 *
 * ⚠️ **Lo slash finale della radice si toglie, e non è pignoleria.** `new URL()`
 * normalizza il path vuoto a `/`, quindi la home italiana uscirebbe
 * `https://fontealta.it/`. Nel `<link rel="canonical">` non si vede, perché la
 * pipeline dei metadata di Next lo toglie da sé; nella **sitemap** invece resta,
 * e i due artefatti finiscono per dichiarare due stringhe diverse per la stessa
 * pagina. Sono lo stesso URL per la RFC 3986 e per Google, ma chi un giorno
 * confronterà sitemap e canonical riga per riga troverà una differenza da
 * spiegare. La regola vale solo sulla radice: ogni altro path esce già senza
 * slash finale, ed è la convenzione del sito (`/collezioni/` fa 308).
 */
export function absoluteUrl(locale: ActiveLocale, href: RouteHref): string {
  const url = new URL(getPathname({ locale, href }), siteUrl()).toString();
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * La mappa `{ locale: url }` per gli `alternates.languages`, con `x-default`.
 *
 * ⚠️ Itera su **`ACTIVE_LOCALES`**, non su `ALL_LOCALES`: dichiarare un hreflang
 * verso una lingua che non esiste ancora manda i motori su pagine che non ci
 * sono. Il giorno che DE entra in `ACTIVE_LOCALES` le sue voci compaiono da sole
 * ovunque, senza toccare nessun altro file: è il punto di avere una funzione
 * sola.
 *
 * ⚠️ **`x-default` = EN, e non IT.** La radice serve italiano per costruzione
 * (`localePrefix: "as-needed"` con `defaultLocale: "it"`), ma `x-default` non
 * dice «la lingua di casa»: dice dove mandare chi non combacia con nessuna delle
 * lingue dichiarate, e quello è un visitatore internazionale. Prima di questa PR
 * valeva IT in due posti diversi, il nostro `alternates` e l'header `Link` del
 * middleware; ora il middleware non lo emette più (`alternateLinks: false`) e la
 * sorgente è una sola.
 */
export function localizedUrls(
  href: RouteHref,
  /**
   * Le lingue in cui la pagina esiste, quando non sono tutte (le pagine d'uso, c1b): un
   * hreflang verso una lingua che dà 404 manda i motori su una pagina che non c'è. `x-default`
   * resta EN se c'è, altrimenti la prima presente.
   */
  lingue: readonly ActiveLocale[] = ACTIVE_LOCALES,
): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const locale of ACTIVE_LOCALES)
    if (lingue.includes(locale)) urls[locale] = absoluteUrl(locale, href);
  // Il ripiego esiste perché il tipo non garantisce `en`, e un `undefined` in un hreflang è
  // peggio di IT. Nessuna lingua, nessuna mappa: niente `x-default` verso il vuoto.
  const ripiego = urls.en ?? Object.values(urls)[0];
  if (ripiego) urls["x-default"] = ripiego;
  return urls;
}
