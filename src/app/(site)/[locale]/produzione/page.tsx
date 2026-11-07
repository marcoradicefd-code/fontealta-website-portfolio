import { setRequestLocale } from "next-intl/server";

import { type ActiveLocale } from "@/i18n/routing";
import { staticRouteMetadata } from "@/lib/route-metadata";

import { ChiusuraSection } from "./_components/chiusura-section";
import { FasiSection } from "./_components/fasi-section";
import { ProduzioneFormSection } from "./_components/produzione-form-section";
import { ProduzioneHero } from "./_components/produzione-hero";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

export const generateMetadata = staticRouteMetadata({
  namespace: "produzione",
  href: "/produzione",
});

export default async function ProduzionePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <ProduzioneHero locale={locale} />
      <FasiSection locale={locale} />
      <ChiusuraSection locale={locale} />
      <ProduzioneFormSection />
    </>
  );
}
