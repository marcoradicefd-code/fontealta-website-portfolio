import { useTranslations } from "next-intl";

import { ProgettareCta } from "@/components/sections/progettare-cta";

/**
 * ProduzioneFormSection — adapter produzione per la CTA condivisa.
 *  - title: produzione.formH2 ("Vuoi vedere come lavoriamo?"), copy di pagina;
 *  - subtitle: collezioni.progettareSub, la stessa stringa che usano
 *    /collezioni e /finiture. La fonte dice "sottotitolo identico alle altre
 *    pagine", quindi si RIUSA la chiave invece di duplicarne il testo.
 */
export function ProduzioneFormSection() {
  const t = useTranslations("produzione");
  const tc = useTranslations("collezioni");

  return <ProgettareCta title={t("formH2")} subtitle={tc("progettareSub")} />;
}
