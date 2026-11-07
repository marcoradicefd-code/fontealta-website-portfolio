import { setRequestLocale } from "next-intl/server";

import { getReferences } from "@/lib/content";
import type { ActiveLocale } from "@/i18n/routing";
import { staticRouteMetadata } from "@/lib/route-metadata";

import { ReferenceArchiveHero } from "./_components/reference-archive-hero";
import { ReferenceCard } from "./_components/reference-card";
import { ReferenceEmptyState } from "./_components/reference-empty-state";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

export const generateMetadata = staticRouteMetadata({
  namespace: "referenze",
  href: "/referenze",
});

export default async function ReferenzeArchivePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const references = await getReferences(locale);

  return (
    <>
      <ReferenceArchiveHero />

      {references.length === 0 ? (
        <ReferenceEmptyState />
      ) : (
        <section className="fa-section light">
          <div className="fa-container">
            <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {references.map((reference) => (
                <ReferenceCard key={reference._id} reference={reference} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
