import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";

import { Navigation } from "@/components/layout/navigation";
import { Footer } from "@/components/layout/footer";
import { SiteJsonLd } from "@/components/seo/site-json-ld";
import { LenisProvider } from "@/lib/lenis-provider";
import { pickClientMessages } from "@/i18n/client-messages";
import { ACTIVE_LOCALES, type ActiveLocale } from "@/i18n/routing";
import { OG_SITE_NAME, conAltOg, openGraphBase } from "@/lib/open-graph";
import { fallbackOgImages } from "@/lib/og-fallback-image";
import { siteUrl } from "@/lib/seo";
import "../../globals.css";

const satoshi = localFont({
  src: [
    {
      path: "../../fonts/Satoshi-Variable.woff2",
      style: "normal",
    },
    {
      path: "../../fonts/Satoshi-VariableItalic.woff2",
      style: "italic",
    },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

/**
 * ⚠️ **Era un `metadata` costante, ed è diventato `generateMetadata` per una
 * ragione sola: `og:locale`.** Il resto del blocco non dipende dalla lingua, ma
 * `og:locale` sì, e una costante non può leggere il parametro `[locale]` del
 * segmento in cui vive. Convertirlo non cambia niente di ciò che c'era prima:
 * `metadataBase`, `title.default`, `title.template`, `description` e `keywords`
 * escono identici.
 *
 * ⚠️ **L'`openGraph` dichiarato qui è quello che vedono le pagine che NON lo
 * dichiarano**, cioè tredici rotte su sedici. Next fonde i metadata in modo
 * shallow: chi dichiara il proprio `openGraph` cancella questo per intero,
 * `siteName` compreso, e per questo le cinque pagine che hanno un'immagine loro
 * ripartono da `openGraphBase()`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: ActiveLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;

  /**
   * ⚠️ **Da qui il blocco dipende da Sanity, e prima non lo era. Solo per
   * l'immagine.** `defaultSeo.ogImage` è l'anteprima social delle pagine che non
   * ne hanno una propria: 58 su 102, misurate sull'HTML del build. La fetch è la
   * stessa che footer e `SiteJsonLd` fanno nello stesso render, cachata per tag
   * come le altre ventiquattro del sito, e se Sanity non risponde si ricade sul
   * file.
   *
   * ⚠️ **Titolo e description restano costanti, e non è una dimenticanza.** Il
   * piano prevedeva anche quelli da Studio; misurato sui 102 file HTML del
   * build, **nessuna pagina** usa `title.default` o la description del layout,
   * perché dal #162 ogni rotta dichiara i propri. Offrirli in Studio avrebbe
   * significato due campi che non muovono niente.
   *
   * `ogImageScena` e non l'immagine grezza: porta a 1200×630 col ritaglio, che
   * su un'immagine già in quel formato è un ridimensionamento a vuoto e su una
   * caricata storta la salva.
   */
  const ogImmagini = await fallbackOgImages(locale);

  return {
    /**
     * ⚠️ **Sta qui e in nessun altro posto.** Prima era ripetuto in tre
     * `generateMetadata` (`blog`, `blog/[slug]`, `produzione`) e assente ovunque
     * altro, ed è la ragione per cui solo quelle tre rotte emettevano un canonical:
     * senza `metadataBase` un canonical relativo non si risolve. Questo è il layout
     * radice, quello che rende `<html>`, quindi tutte le pagine lo ereditano e i
     * `canonical` e gli `og:image` possono restare path relativi.
     */
    metadataBase: new URL(siteUrl()),
    title: {
      /**
       * ⚠️ **Il titolo di riserva è quello della 404, nella lingua della pagina**
       * (22/10/2026). Nessuna pagina usa `title.default` (misurato, v. sopra): lo vede
       * solo la 404, che era «Fontealta · Our design, your personality», in inglese, in
       * ogni lingua. Un `generateMetadata` nella `not-found.tsx` annidata NON basta: la
       * guida lo garantisce solo per la `not-found` radice e per `global-not-found`, e
       * misurato qui l'HTML aveva il titolo giusto ma nel browser tornava questo.
       */
      default: `${(await getTranslations({ locale, namespace: "errorPages.notFound" }))("metaTitle")} | Fontealta`,
      template: "%s | Fontealta",
    },
    description:
      "Specialisti dell'acciaio. Colonne doccia outdoor. Personalizzazione illimitata. Made in Italy.",
    keywords: [
      "outdoor shower",
      "doccia esterna",
      "stainless steel",
      "acciaio inox",
      "AISI 316",
      "Made in Italy",
      "custom shower",
      "Fontealta",
    ],
    // L'`alt` qui è il marchio: questo blocco lo vede solo chi non dichiara un
    // `openGraph` proprio, cioè la 404, che non ha un titolo da dare.
    openGraph: { ...openGraphBase(locale), images: conAltOg(ogImmagini, OG_SITE_NAME, locale) },
    // `summary_large_image` sta qui e in nessun altro posto: nessuna pagina
    // dichiara un `twitter` proprio, quindi questo vale per tutte. Il giorno che
    // una lo facesse, cancellerebbe anche questa riga.
    twitter: { card: "summary_large_image" },
    /**
     * Le immagini grandi nelle anteprime (Marco, 5/11/2026): Google le mostra in Discover
     * solo con `max-image-preview:large` (https://developers.google.com/search/docs/appearance/google-discover).
     * Next scrive solo questa direttiva, senza `index` né `follow`, quindi in anteprima l'header
     * `X-Robots-Tag: noindex` resta l'unica parola sull'indicizzazione. Le pagine escluse
     * (`/area-riservata`, `/officina`, i documenti `noIndex`) dichiarano un `robots` loro, che
     * sostituisce per intero questo (fusione shallow): restano `noindex, follow` e basta.
     */
    robots: { "max-image-preview": "large" },
  };
}

export function generateStaticParams() {
  return ACTIVE_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!ACTIVE_LOCALES.includes(locale as ActiveLocale)) {
    notFound();
  }
  setRequestLocale(locale);
  /* Al browser va il SOLO sottoinsieme che i componenti client leggono: il dizionario
     intero sono ~38 KB per pagina, di cui 15 di `legale`, che qui non serve a nessuno.
     L'elenco e la guardia che lo tiene onesto stanno in `@/i18n/client-messages`. */
  const messages = pickClientMessages(await getMessages());
  const t = await getTranslations("skip");

  const iubendaSiteId = process.env.IUBENDA_SITE_ID;
  const iubendaCookiePolicyId = process.env.IUBENDA_COOKIE_POLICY_ID;
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  /**
   * ⚠️ **Vercel Web Analytics solo in PRODUZIONE, e la condizione non è ridondante.**
   * La libreria decide la modalità da `NODE_ENV`, e un deploy di anteprima è un build
   * di produzione: senza questa riga le visite alle anteprime finirebbero nelle
   * statistiche. In locale `VERCEL_ENV` non esiste, quindi il componente non si rende
   * nemmeno con `pnpm start`.
   *
   * ⚠️ Nessun cookie e nessun identificatore persistente: è ciò che la cookie policy
   * dichiara, e lo custodisce `tests/regression/cookie-terze-parti.spec.ts`.
   */
  const analyticsEnabled = process.env.VERCEL_ENV === "production";

  return (
    <html lang={locale} className={`${satoshi.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {/* `Organization` + `WebSite`, una volta per pagina. Sta qui e non in
            una pagina perché è il dato del SITO, non di una rotta: ripeterlo
            per pagina vorrebbe dire sedici occasioni di divergere. */}
        <SiteJsonLd locale={locale as ActiveLocale} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LenisProvider>
            <a href="#main-content" className="skip-to-content">
              {t("toContent")}
            </a>
            <Navigation />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
          </LenisProvider>
        </NextIntlClientProvider>

        {plausibleDomain ? (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        ) : null}

        {iubendaSiteId && iubendaCookiePolicyId ? (
          <>
            <Script
              id="iubenda-config"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  var _iub = _iub || [];
                  _iub.csConfiguration = {
                    siteId: ${JSON.stringify(iubendaSiteId)},
                    cookiePolicyId: ${JSON.stringify(iubendaCookiePolicyId)},
                    lang: ${JSON.stringify(locale)},
                    enableFadp: true,
                    enableLgpd: true,
                  };
                `,
              }}
            />
            <Script
              src="//cdn.iubenda.com/cs/iubenda_cs.js"
              strategy="afterInteractive"
              charSet="UTF-8"
              async
            />
          </>
        ) : null}

        {/* Una volta sola, qui: è il layout che rende `<body>` per tutto il sito.
            Lo Studio ha il suo layout e resta fuori. */}
        {analyticsEnabled ? <Analytics /> : null}
      </body>
    </html>
  );
}
