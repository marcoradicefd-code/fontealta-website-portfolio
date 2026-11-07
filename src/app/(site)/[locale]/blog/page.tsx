import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProgettareCta } from "@/components/sections/progettare-cta";
import { type ActiveLocale } from "@/i18n/routing";
import { getCategories, getPosts } from "@/lib/content";
import { LOCALE_INTL } from "@/lib/lingue";
import { readingTimeMinutes } from "@/lib/reading-time";
import { urlFor } from "@/sanity/lib/image";
import { staticRouteMetadata } from "@/lib/route-metadata";

import { BlogListing } from "./_components/blog-listing";
import type { BlogCardVM } from "./_components/post-card";
import { risolviAlt } from "@/lib/alt-composto";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

/** Localized projections are strings at runtime (TypeGen mis-types as M6 array). */
function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function formatDate(iso: string, locale: ActiveLocale): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_INTL[locale], {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export const generateMetadata = staticRouteMetadata({
  namespace: "blog",
  href: "/blog",
});

export default async function BlogListingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "blog" });

  const [posts, categories] = await Promise.all([getPosts(locale), getCategories(locale)]);

  const vms: BlogCardVM[] = posts
    .map((p): BlogCardVM => {
      const title = asText(p.title);
      const cats = (p.categories ?? []).filter(Boolean);
      const categoryIds = cats.map((c) => c?._id).filter((id): id is string => Boolean(id));
      const minutes = readingTimeMinutes(p.body);
      const date = p.publishedAt ? formatDate(p.publishedAt, locale) : "";
      const author = p.author?.name ?? "";
      // ⚠️ La data NON entra più in questa stringa: la card la avvolge in un
      // `<time dateTime>`, quindi deve arrivarle separata. Il resto della riga
      // resta un blob, perché lì non c'è niente da dichiarare a nessuno.
      const meta = [author, t("readingTime", { min: minutes })].filter(Boolean).join(" · ");
      const coverUrl = p.coverImage?.asset ? (urlFor(p.coverImage)?.url() ?? null) : null;
      // L'alt della cover nella lingua (spec contenuti-per-lingua § A): `altI18n`, poi
      // l'italiano con `lang`, poi il titolo.
      const cover = risolviAlt(p.coverImage, locale);
      return {
        id: p._id,
        slug: p.slug ?? "",
        title,
        excerpt: asText(p.excerpt),
        category: asText(cats[0]?.title),
        categoryIds,
        dateIso: p.publishedAt ?? null,
        dateLabel: date,
        meta,
        coverUrl,
        coverAlt: cover.alt || title,
        ...(cover.alt && cover.lang ? { coverAltLang: cover.lang } : {}),
      };
    })
    .filter((v) => v.slug); // difensivo: salta post senza slug

  // Featured: primo con featured:true (posts già publishedAt desc) → fallback
  // al più recente. Garantisce che sia presente tra i vms (abbia slug).
  const featuredCandidate = posts.find((p) => p.featured)?._id ?? posts[0]?._id ?? null;
  const featuredId = vms.some((v) => v.id === featuredCandidate)
    ? featuredCandidate
    : (vms[0]?.id ?? null);

  const categoryVMs = categories
    .map((c) => ({ id: c._id, title: asText(c.title) }))
    .filter((c) => c.title);

  return (
    <>
      {/* HERO — scuro full-bleed, stessa scala-altezza LOCKED delle prime-section
          delle altre pagine (home single source of truth). bg = foto water/steel
          macro (public/blog/hero-bg.jpg) via CSS background-image → evita il
          sidecar AppleDouble exFAT di next/image. */}
      <section
        className="fa-section dark relative flex min-h-[max(560px,75vh)] items-center overflow-hidden sm:min-h-[max(560px,80vh)] lg:min-h-screen"
        style={{
          backgroundImage: "url(/blog/hero-bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,18,21,0.72) 0%, rgba(11,18,21,0.55) 50%, #0b1215 100%)",
            zIndex: 0,
          }}
          aria-hidden
        />
        <div className="fa-container relative w-full" style={{ zIndex: 1 }}>
          <div className="mx-auto max-w-[700px] text-center">
            <h1 className="fa-hero-h1" style={{ color: "var(--fa-text-on-dark)" }}>
              {t("heroTitle")}
            </h1>
            <p
              className="fa-body-lg mx-auto mt-title-text"
              style={{ maxWidth: "52ch", color: "var(--fa-text-on-dark)" }}
            >
              {t("heroSubtitle")}
            </p>
          </div>
        </div>
      </section>

      <BlogListing
        posts={vms}
        featuredId={featuredId}
        categories={categoryVMs}
        labels={{
          all: t("filterAll"),
          readArticle: t("readArticle"),
          prev: t("prev"),
          next: t("next"),
          empty: t("empty"),
        }}
      />

      {/* Chiusura = CTA contatto condivisa. Titolo e sub dal namespace blog: una
          fonte sola per elenco e articolo, e il sub segue la domanda del titolo. */}
      <ProgettareCta title={t("contactH2")} subtitle={t("contactSub")} />
    </>
  );
}
