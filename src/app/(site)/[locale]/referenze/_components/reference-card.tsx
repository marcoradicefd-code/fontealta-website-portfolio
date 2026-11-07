import { SanityImage } from "@/components/media/sanity-image";
import { useTranslations } from "next-intl";

import { IntentLink } from "@/components/ui/intent-link";
import { urlFor } from "@/sanity/lib/image";
import type { REFERENCES_OVERVIEW_QUERY_RESULT } from "@/sanity/types.gen";

type Reference = REFERENCES_OVERVIEW_QUERY_RESULT[number];

interface ReferenceCardProps {
  reference: Reference;
}

/**
 * ReferenceCard — Server Component. Estende il pattern shell di CollectionCard
 * (read-only baseline), ma con cover = `coverImage` Sanity invece del
 * monogram-gradient. Meta: architect / location · year. Link a
 * `/referenze/[slug]` (object-form pathnames).
 *
 * Spec: docs/design-specs/referenze.md §A2 / §7.
 * Fallback cover: bg `--fa-card-cover` quando coverImage manca (drafts).
 */
export function ReferenceCard({ reference }: ReferenceCardProps) {
  const t = useTranslations("referenze");
  const { title, slug, architect, location, country, category, year, coverImage } = reference;

  const coverUrl = coverImage ? (urlFor(coverImage)?.width(800).height(1000).url() ?? null) : null;

  // location · year (segmenti opzionali, omessi se assenti)
  const metaParts: string[] = [];
  if (location) metaParts.push(location);
  if (country && !location) metaParts.push(country);
  if (typeof year === "number") metaParts.push(year.toString());

  const categoryLabel = category ? t(`category.${category}`) : null;

  return (
    <IntentLink
      href={{ pathname: "/referenze/[slug]", params: { slug: slug ?? "" } }}
      className="group block overflow-hidden rounded-lg bg-fa-surface shadow-card transition-[transform,box-shadow] duration-(--dur-standard) ease-out-expo hover:-translate-y-1 hover:shadow-(--shadow-product) focus-visible:ring-2 focus-visible:ring-fa-navy focus-visible:ring-offset-4 focus-visible:ring-offset-fa-white focus-visible:outline-none"
    >
      <div
        className="relative aspect-[4/5] overflow-hidden"
        style={{ background: "var(--fa-card-cover)" }}
      >
        {coverUrl ? (
          <SanityImage
            src={coverUrl}
            alt={coverImage?.alt ?? title ?? ""}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-(--dur-standard) ease-out-expo group-hover:scale-[1.04]"
          />
        ) : null}
      </div>
      <div className="px-4 pt-4 pb-4">
        <span className="fa-eyebrow">{categoryLabel ?? t("eyebrowItem")}</span>
        <h3 className="fa-card-title mt-1 mb-0.5 text-fa-black">{title ?? ""}</h3>
        {architect && <p className="fa-body-sm text-fa-text-secondary">{architect}</p>}
        {metaParts.length > 0 && (
          <p className="mt-2 text-micro-2 tracking-1 text-fa-text-tertiary">
            {metaParts.join(" · ")}
          </p>
        )}
      </div>
    </IntentLink>
  );
}
