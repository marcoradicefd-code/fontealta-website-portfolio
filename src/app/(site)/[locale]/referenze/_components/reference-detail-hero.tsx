import { SanityImage } from "@/components/media/sanity-image";
import { useTranslations } from "next-intl";

import { urlFor } from "@/sanity/lib/image";
import type { REFERENCE_BY_SLUG_QUERY_RESULT } from "@/sanity/types.gen";

interface Props {
  reference: NonNullable<REFERENCE_BY_SLUG_QUERY_RESULT>;
}

/**
 * ReferenceDetailHero — Server Component, presentational. Pattern overlay del
 * teaser "Villa · Origo ORSO": coverImage full-bleed + scrim, eyebrow category,
 * H1 title italic, meta riga (architect · location · country · year).
 *
 * Spec: docs/design-specs/referenze.md §D1. Cover required a schema ma può
 * mancare nei drafts → fallback surface scura + bg `--fa-card-cover`.
 */
export function ReferenceDetailHero({ reference }: Props) {
  const t = useTranslations("referenze");
  const { title, architect, location, country, category, year, coverImage } = reference;

  const coverUrl = coverImage ? (urlFor(coverImage)?.width(2000).height(1400).url() ?? null) : null;

  const metaParts: string[] = [];
  if (architect) metaParts.push(architect);
  if (location) metaParts.push(location);
  if (country) metaParts.push(country);
  if (typeof year === "number") metaParts.push(year.toString());

  const categoryLabel = category ? t(`category.${category}`) : null;

  return (
    <section
      className="fa-section dark relative flex min-h-[max(560px,75vh)] items-end overflow-hidden sm:min-h-[max(560px,80vh)] lg:min-h-screen"
      style={{
        padding:
          "var(--fa-space-hero-top) calc(var(--spacing) * 6) var(--fa-space-hero-bottom-detail)",
      }}
    >
      {coverUrl ? (
        <SanityImage
          src={coverUrl}
          alt={coverImage?.alt ?? title ?? ""}
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ zIndex: 0 }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: "var(--fa-card-cover)", zIndex: 0 }}
          aria-hidden
        />
      )}

      {/* Scrim sx → dx per leggibilità */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(11,18,21,0.92) 0%, rgba(11,18,21,0.78) 30%, rgba(11,18,21,0.4) 60%, rgba(11,18,21,0.05) 100%)",
          zIndex: 1,
        }}
        aria-hidden
      />
      {/* Scrim bottom darken per meta */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, transparent 50%, rgba(11,18,21,0.75) 100%)",
          zIndex: 1,
        }}
        aria-hidden
      />

      <div
        className="fa-container relative w-full"
        style={{
          zIndex: 2,
          maxWidth: 760,
          marginRight: "auto",
          marginLeft: "var(--fa-space-hero-inset)",
        }}
      >
        {categoryLabel && (
          <span
            className="fa-eyebrow on-dark"
            style={{ color: "var(--fa-text-on-dark)", fontSize: "clamp(11px, 0.85vw, 13px)" }}
          >
            {categoryLabel}
          </span>
        )}

        {/* H1 Satoshi italic — ridotto rispetto archive per non sovrastare la foto */}
        <h1
          className="m-0 mt-eyebrow"
          style={{
            color: "var(--fa-text-on-dark)",
            fontStyle: "italic",
            fontSize: "var(--text-display-hero)",
            fontWeight: 500,
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
          }}
        >
          {title ?? ""}
        </h1>

        {metaParts.length > 0 && (
          <p
            className="mt-title-text-hero mb-0 text-micro-4 tracking-4 uppercase"
            style={{ color: "rgba(246,244,240,0.7)" }}
          >
            {metaParts.join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}
