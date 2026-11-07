import "server-only";

import type { Metadata } from "next";

import { getTranslations } from "next-intl/server";

import type { ActiveLocale } from "@/i18n/routing";
import { fallbackOgImages } from "@/lib/og-fallback-image";
import { OG_SITE_NAME, conAltOg, openGraphBase, titoloOg } from "@/lib/open-graph";
import { absoluteUrl, localizedUrls, type RouteHref } from "@/lib/urls";

/**
 * I metadata di una rotta STATICA: titolo, description, canonical, hreflang e
 * Open Graph, da una `href` sola.
 *
 * ⚠️ **Nato da una misura, non da un'idea di eleganza.** Aggiungendo `og:url` a
 * ogni pagina, nove `generateMetadata` che erano soltanto SIMILI sono diventate
 * identiche per diciotto righe: SonarCloud le ha contate come duplicazione sul
 * codice nuovo, **8,6%** contro il 3% richiesto. Quella condizione è diversa dal
 * rosso strutturale della copertura che questo repo ignora per policy — è
 * comparsa su una PR che tocca codice vero, e liquidarla avrebbe insegnato a non
 * leggere più il gate.
 *
 * ⚠️ **Il guadagno vero non è la brevità: è che `canonical` e `og:url` non possono
 * più divergere.** Prima erano due campi che due righe della stessa funzione
 * riempivano con la stessa const, e la guardia sui trenta campioni serviva a
 * sorvegliare che restassero uguali. Ora nascono dalla stessa chiamata, in un
 * posto solo, e la guardia sorveglia una cosa che è vera per costruzione. È la
 * differenza fra un invariante controllato e un invariante impossibile da
 * rompere.
 *
 * ⚠️ **Solo per le rotte STATICHE.** Le pagine guidate da un documento —
 * modello, collezione, articolo, corpo — passano da `risolviSeo` e da
 * `indicizzazione`, perché hanno un `noIndex` che arriva da Sanity e un'immagine
 * propria. Forzarle dentro questa funzione vorrebbe dire darle tre parametri
 * facoltativi e un ramo: due forme diverse che fingono di essere una.
 */
export async function routeMetadata({
  locale,
  href,
  title,
  description,
}: {
  locale: ActiveLocale;
  href: RouteHref;
  /** `Metadata["title"]` e non `string`: la home passa `{ absolute }`, perché porta il marchio da sé. */
  title: Metadata["title"];
  description: string;
}): Promise<Metadata> {
  const canonical = absoluteUrl(locale, href);
  /**
   * ⚠️ **`og:title` va dichiarato, altrimenti Next ci mette il titolo GIÀ passato
   * dal template.** `CLAUDE.md` dice da sempre che `og:title` è il titolo nudo su
   * tutte le rotte — il marchio lo porta `og:site_name`, e ripeterlo lo fa
   * comparire due volte in ogni anteprima social — ma misurando il costruito
   * l'11/09/2026 la regola valeva su **due rotte su nove**: `/blog` serviva «Blog»
   * e `/produzione` «Produzione», perché erano le uniche a dichiarare
   * `openGraph.title` a mano, mentre `/finiture` serviva «Finiture | Fontealta».
   * Non era una regola in vigore: era una regola scritta. La funzione che decide
   * il titolo, `titoloOg`, sta in `open-graph.ts` col suo test.
   */
  const titolo = titoloOg(title);
  return {
    title,
    description,
    alternates: { canonical, languages: localizedUrls(href) },
    openGraph: {
      ...openGraphBase(locale, canonical),
      title: titolo,
      description,
      images: conAltOg(await fallbackOgImages(locale), titolo ?? OG_SITE_NAME, locale),
    },
  };
}

/**
 * La `generateMetadata` di una rotta statica, già pronta da esportare.
 *
 * ⚠️ **Una fabbrica e non nove funzioni, perché nove funzioni IDENTICHE le ha
 * misurate SonarCloud, non il gusto.** Dopo aver estratto `routeMetadata` le
 * pagine restavano uguali per quindici righe — l'attesa dei `params`, il
 * traduttore, la chiamata — e quel blocco superava ancora la soglia dei dieci
 * righe / cento token. Qui la rotta si dichiara in due righe e non c'è più un
 * corpo da ripetere.
 *
 * ⚠️ **`export const generateMetadata = …` è una forma che Next accetta**, non
 * un trucco: il framework cerca l'export con quel nome, non una dichiarazione di
 * funzione. Verificato sul costruito, non dedotto.
 *
 * `marchioNelTitolo` serve alla sola home, che porta il marchio apposta nel
 * proprio titolo e per questo passa `{ absolute }`: è l'unica rotta in cui il
 * template non deve aggiungere niente.
 */
export function staticRouteMetadata({
  namespace,
  href,
  marchioNelTitolo = false,
}: {
  namespace: string;
  href: RouteHref;
  marchioNelTitolo?: boolean;
}) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: ActiveLocale }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace });
    const titolo = t("metaTitle");
    return routeMetadata({
      locale,
      href,
      title: marchioNelTitolo ? { absolute: titolo } : titolo,
      description: t("metaDescription"),
    });
  };
}
