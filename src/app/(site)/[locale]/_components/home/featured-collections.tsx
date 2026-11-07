import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import type { ActiveLocale } from "@/i18n/routing";
import { getCollections, getFeaturedCollections } from "@/lib/content";
import { FeaturedCarousel } from "./featured-carousel";
import { FeaturedCollectionCard } from "./featured-collection-card";
interface FeaturedCollectionsProps {
  locale: ActiveLocale;
}

/**
 * Featured collections — coverflow carousel (FeaturedCarousel/Swiper). Riusa
 * FeaturedCollectionCard, card HOME distinta da CollectionCard di /collezioni
 * (quest'ultima NON è usata qui — vedi featured-collection-card.tsx).
 *
 * FALLBACK featured (LOCKED): se 0 collezioni featured → prime 6 per order (getCollections).
 * FEATURED_COLLECTIONS_QUERY_RESULT e COLLECTIONS_OVERVIEW_QUERY_RESULT sono
 * strutturalmente identici → entrambi compatibili con FeaturedCollectionCard.
 */
export async function FeaturedCollections({ locale }: FeaturedCollectionsProps) {
  const t = await getTranslations({ locale, namespace: "home" });

  const featured = await getFeaturedCollections(locale);
  const items = featured.length ? featured : (await getCollections(locale)).slice(0, 6);

  return (
    <section
      className="fa-section overflow-hidden"
      style={{ background: "var(--fa-ink)", color: "var(--fa-text-on-dark)" }}
    >
      <div className="fa-container">
        <Reveal className="mb-16 max-w-[700px]">
          <span className="fa-eyebrow on-dark" style={{ color: "var(--fa-text-on-dark)" }}>
            {t("featuredEyebrow")}
          </span>
          <h2
            className="m-0 mt-eyebrow text-fa-white"
            style={{
              fontSize: "var(--text-heading-2)",
              lineHeight: 1.08,
              letterSpacing: "-0.5px",
              fontWeight: 600,
            }}
          >
            {t("featuredH2")}
          </h2>
          <p
            className="fa-body-lg mt-heading-intro max-w-[680px]"
            style={{ color: "var(--fa-text-on-dark)" }}
          >
            {t("featuredIntro")}
          </p>
        </Reveal>

        <Reveal delay={120}>
          {/* Le etichette arrivano come prop dal server: il carosello è un
              client component e caricarci next-intl dentro significherebbe
              mandare al browser un dizionario per tre stringhe. */}
          <FeaturedCarousel
            labels={{
              prev: t("featuredPrev"),
              next: t("featuredNext"),
              // ⚠️ `t()` con il suo argomento, una volta per collezione. Prima
              // era `t("featuredGoTo")` secco su una stringa ICU che dichiara
              // `{n}`: next-intl non ha niente da sostituire e in sviluppo
              // risponde `FORMATTING_ERROR`. Il nome della collezione è già
              // qui, e come etichetta batte un numero d'ordine.
              goTo: items.map((c) => t("featuredGoTo", { n: c.title ?? "" })),
            }}
          >
            {items.map((collection) => (
              <FeaturedCollectionCard
                key={collection._id}
                collection={collection}
                locale={locale}
                coverAlt={t("featuredCardAlt", { nome: collection.title ?? "" })}
              />
            ))}
          </FeaturedCarousel>
        </Reveal>

        <Reveal delay={240} className="mt-14 flex justify-center">
          <Button href="/collezioni" variant="secondary" dark size="xl">
            {t("featuredCta")}
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
