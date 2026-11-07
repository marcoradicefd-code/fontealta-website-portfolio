import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { getMonogramVariant } from "@/lib/placeholders";
import type { REFERENCE_BY_SLUG_QUERY_RESULT } from "@/sanity/types.gen";

type CollectionsUsed = NonNullable<NonNullable<REFERENCE_BY_SLUG_QUERY_RESULT>["collectionsUsed"]>;

interface Props {
  collections: CollectionsUsed;
}

/**
 * ReferenceCollectionsUsed — Server Component. Riga di card linkate a
 * `/collezioni/[slug]` (spec §D4). La projection `collectionsUsed[]->` ritorna
 * solo `{_id, code, title, slug}` (NO coverImage/articleCount), quindi NON
 * riusa CollectionCard (che richiede la shape overview): card-shell minimale
 * con monogram brand, coerente al pattern CollectionCard. Gated: il caller
 * non monta la sezione se vuota.
 */
export function ReferenceCollectionsUsed({ collections }: Props) {
  const t = useTranslations("referenze");

  return (
    <section className="fa-section light">
      <div className="fa-container">
        <span className="fa-eyebrow">{t("collectionsEyebrow")}</span>
        <h2 className="fa-h3 mt-eyebrow mb-10 text-fa-black">{t("collectionsHeading")}</h2>

        <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => {
            const variant = getMonogramVariant(collection.code ?? "");
            return (
              <Link
                key={collection._id}
                href={{ pathname: "/collezioni/[slug]", params: { slug: collection.slug ?? "" } }}
                className="group block overflow-hidden rounded-lg bg-fa-surface shadow-card transition-[transform,box-shadow] duration-(--dur-standard) ease-out-expo hover:-translate-y-1 hover:shadow-(--shadow-product) focus-visible:ring-2 focus-visible:ring-fa-navy focus-visible:ring-offset-4 focus-visible:ring-offset-fa-white focus-visible:outline-none"
              >
                <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-gradient-to-br from-fa-navy to-fa-navy-light">
                  <Image
                    src={`/brand/fontealta-monogram-${variant}.png`}
                    alt=""
                    width={300}
                    height={300}
                    className="h-auto w-[36%] opacity-(--fa-opacity-subdued) transition-transform duration-(--dur-standard) ease-out-expo group-hover:scale-[1.04]"
                    aria-hidden
                  />
                </div>
                <div className="px-4 pt-4 pb-4">
                  <span className="fa-eyebrow">{t("collectionEyebrowItem")}</span>
                  <h3 className="fa-card-title mt-1 mb-0 text-fa-black">
                    {collection.title ?? collection.code ?? ""}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
