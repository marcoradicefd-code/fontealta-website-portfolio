import { setRequestLocale } from "next-intl/server";

import { CatalogoSection } from "@/components/sections/catalogo-section";
import type { ActiveLocale } from "@/i18n/routing";
import { AZIENDA_EMAIL, AZIENDA_TELEFONO } from "@/lib/azienda";
import { localBusinessJsonLd, serializzaJsonLd } from "@/lib/json-ld";
import { staticRouteMetadata } from "@/lib/route-metadata";

import { ContattiHero } from "./_components/contatti-hero";
import { ContactSection } from "./_components/contact-section";
import { MapEmbed } from "./_components/map-embed";
import { AreaProTeaser } from "./_components/area-pro-teaser";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

export const generateMetadata = staticRouteMetadata({
  namespace: "contatti",
  href: "/contatti",
});

export default async function ContattiPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  /**
   * `LocalBusiness` sta SOLO qui, e non nel layout come `Organization`.
   *
   * ⚠️ Una sede è il contenuto di questa pagina e di nessun'altra: dichiararla
   * ovunque direbbe a un consumatore che ogni pagina del sito parla di un
   * esercizio, che è falso. Stessa ragione per cui `Article` sta solo sul post.
   *
   * ⚠️ **Le stesse costanti che `ContactSection` mostra** (19/10/2026): fino ad allora
   * il JSON-LD dichiarava telefono ed email mentre il riquadro, che li leggeva da
   * `siteSettings` (vuoto), mostrava la sola ragione sociale. Dato dichiarato e non
   * visibile; lo tiene fermo `tests/regression/sede-contatti.spec.ts`.
   */
  const sede = localBusinessJsonLd({ telefono: AZIENDA_TELEFONO, email: AZIENDA_EMAIL });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializzaJsonLd(sede) }}
      />
      <ContattiHero />
      <ContactSection />
      {/* Dopo modulo e sede, prima della mappa (19/10/2026): i rimandi dei moduli di tutte le
          altre pagine portano qui, a `/contatti#catalogo`. */}
      <CatalogoSection />
      <MapEmbed />
      <AreaProTeaser />
    </>
  );
}
