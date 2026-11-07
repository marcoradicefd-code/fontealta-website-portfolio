import { getTranslations, setRequestLocale } from "next-intl/server";

import type { ActiveLocale } from "@/i18n/routing";
import { staticRouteMetadata } from "@/lib/route-metadata";

import { ChiSiamoHero } from "./_components/chi-siamo-hero";
import { StoriaSection } from "./_components/storia-section";
import { SezioneTesto } from "./_components/sezione-testo";
import { ProgettareSection } from "./_components/progettare-section";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

export const generateMetadata = staticRouteMetadata({
  namespace: "chiSiamo",
  href: "/chi-siamo",
});

export default async function ChiSiamoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "chiSiamo" });

  return (
    <>
      <ChiSiamoHero locale={locale} />
      <StoriaSection />
      <SezioneTesto titolo={t("s2H2")} paragrafi={[t("s2P1"), t("s2P2"), t("s2P3"), t("s2P4")]} />
      <SezioneTesto titolo={t("s3H2")} paragrafi={[t("s3P1"), t("s3P2"), t("s3P3")]} />
      <SezioneTesto
        titolo={t("s4H2")}
        paragrafi={[t("s4P1"), t("s4P2"), t("s4P3"), t("s4P4"), t("s4P5")]}
      />
      <SezioneTesto titolo={t("s5H2")} paragrafi={[t("s5P1"), t("s5P2"), t("s5P3"), t("s5P4")]} />
      <ProgettareSection />
    </>
  );
}
