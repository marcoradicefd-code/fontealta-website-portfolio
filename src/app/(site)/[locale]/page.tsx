import { setRequestLocale } from "next-intl/server";

import { FaqSection } from "@/components/faq/faq-section";
import type { ActiveLocale } from "@/i18n/routing";
import { getFaq } from "@/lib/content";
import { staticRouteMetadata } from "@/lib/route-metadata";
import { contentPageId } from "@/sanity/lib/faq-rules";

import { AisiSection } from "./_components/home/aisi-section";
import { FeaturedCollections } from "./_components/home/featured-collections";
import { FinalCta } from "./_components/home/final-cta";
import { HomeHero } from "./_components/home/home-hero";
import { TeamTeaser } from "./_components/home/team-teaser";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

/**
 * La home non aveva `generateMetadata`: era una delle due rotte (con
 * `/collezioni`) che servivano il `title.default` del layout, uguale in IT e in
 * EN, con la description italiana anche su `/en`. Ora ha i suoi, per locale.
 *
 * ⚠️ **Il `title.template` del layout NON si applica qui, e il marchio va
 * scritto nella stringa.** È documentato e misurato: «title.template defined in
 * layout.js will not apply to a title defined in a page.js of the same route
 * segment». La home è la pagina di QUEL layout, non di un segmento figlio,
 * quindi il suo titolo esce verbatim mentre `/collezioni`, che è un segmento
 * sotto, riceve regolarmente «| Fontealta». Visto sull'HTML servito prima di
 * accorgersene: la home era l'unica pagina del sito senza il marchio nel titolo,
 * cioè proprio quella in cui conta di più. `absolute` rende la cosa esplicita e
 * immune a un template futuro.
 */
export const generateMetadata = staticRouteMetadata({
  namespace: "home",
  href: "/",
  marchioNelTitolo: true,
});

export default async function Home({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Il documento fisso della home non ha slug: il webhook manda il solo tipo, `contentPage`.
  const faq = await getFaq(contentPageId("home"), locale, ["contentPage"]);

  return (
    <>
      <HomeHero locale={locale} />
      <FeaturedCollections locale={locale} />
      <AisiSection locale={locale} />
      <TeamTeaser locale={locale} />
      <FaqSection items={faq} locale={locale} adjacentLight="below" />
      <FinalCta locale={locale} />
    </>
  );
}
