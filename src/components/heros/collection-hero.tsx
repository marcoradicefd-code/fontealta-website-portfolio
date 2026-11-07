import { useTranslations } from "next-intl";

import { HeroFade } from "@/components/hero-fade";
import { HeroMediaBg } from "@/components/heros/hero-media-bg";
import type { ActiveLocale } from "@/i18n/routing";
import { taglineForLocale } from "@/lib/tagline";
import { MACRO_ORDER, resolveMacro } from "@/lib/product-category";
import { urlFor } from "@/sanity/lib/image";
import type {
  COLLECTION_DETAIL_QUERY_RESULT,
  CONCEALED_BODIES_INDEX_QUERY_RESULT,
} from "@/sanity/types.gen";

const POSTER_FALLBACK_URL = "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=2000&q=80";

// Il documento collezione dei corpi a incasso porta gli stessi campi hero ma NON
// `models` / `modelsCount` / `finishesCount`: l'indice dei corpi interroga il tipo,
// non le reference alla collection (docs/incassi-design.md §3). I tre campi assenti
// sono letti dietro guardia "in" e il chiamante passa `stats`.
type HeroCollection =
  | NonNullable<COLLECTION_DETAIL_QUERY_RESULT>
  | NonNullable<CONCEALED_BODIES_INDEX_QUERY_RESULT["collection"]>;

interface Props {
  collection: HeroCollection;
  // locale kept for future use when copy varies per language; harmless underscore
  // for now since useTranslations resolves messages from request context.
  locale: ActiveLocale;
  /**
   * Statistiche dell'hero. OMESSA (default) → si derivano dai model della
   * collezione, che è il comportamento delle 21 collezioni esistenti. PASSATA →
   * sostituisce l'intero gruppo: sui corpi le derivazioni darebbero 0 articoli,
   * 0 finiture e «—», cioè tre numeri veri sul dato sbagliato. Meglio nessuna
   * derivazione che una che mente (lezione `heroStat2Value`).
   */
  stats?: { label: string; value: string }[];
}

export function CollectionHero({ collection, locale, stats }: Props) {
  const t = useTranslations("dettaglio");
  const tCat = useTranslations("productCategories");
  const tagline = taglineForLocale(collection.tagline, locale);

  // Sfondo hero: cascata heroImage (foto ORIZZONTALE HD dedicata) → coverImage
  // (ritratto card 896px → upscalata, accettato come fallback temporaneo finché
  // heroImage non è popolato, M15) → placeholder Unsplash.
  const heroBg = collection.heroImage ?? collection.coverImage;
  const posterUrl =
    (heroBg ? urlFor(heroBg)?.width(2400).quality(82).url() : undefined) ?? POSTER_FALLBACK_URL;
  // Stat "Ambiente" (chiave i18n statAmbient invariata): mostra le macro-categorie
  // prodotto presenti nella collezione. FRONT 2: la macro viene da `productMacro`
  // (6 valori) → label productCategories i18n, ord. MACRO_ORDER, join " · ".
  // Stessa fonte del filtro collezione (ModelsSection) → coerenza garantita.
  const presentCategories = new Set<string>();
  for (const m of "models" in collection ? collection.models : []) {
    const macro = resolveMacro(m);
    if (macro) presentCategories.add(macro);
  }
  const ambientText =
    MACRO_ORDER.filter((c) => presentCategories.has(c))
      .map((c) => (tCat.has(c) ? tCat(c) : c))
      .join(" · ") || "—";

  const heroStats = stats ?? [
    {
      label: t("statArticoli"),
      value: ("modelsCount" in collection ? collection.modelsCount : null)?.toString() ?? "0",
    },
    {
      label: t("statFiniture"),
      value: ("finishesCount" in collection ? collection.finishesCount : null)?.toString() ?? "0",
    },
    { label: t("statAmbient"), value: ambientText },
  ];

  return (
    <section
      className="fa-section dark relative flex min-h-[max(560px,75vh)] items-center overflow-hidden sm:min-h-[max(560px,80vh)] lg:min-h-screen"
      style={{
        padding: "var(--fa-space-hero-top) calc(var(--spacing) * 6) var(--fa-space-hero-bottom)",
      }}
    >
      {/* M15 (parziale chiuso): video ripristinato su Cloudflare R2 (niente più
          hotlinking Mixkit). Cascata: heroVideo/heroVideoMp4 R2 → poster coverImage
          Sanity → fallback Unsplash (campi vuoti = stato attuale, zero regressione). */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <HeroMediaBg
          posterSrc={posterUrl}
          videoWebmUrl={collection.heroVideo}
          videoMp4Url={collection.heroVideoMp4}
          priority
        />
      </div>

      {/* Scrim 1: sx → dx 95% → 0% per leggibilità testo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(11,18,21,0.95) 0%, rgba(11,18,21,0.85) 30%, rgba(11,18,21,0.55) 55%, rgba(11,18,21,0.15) 80%, rgba(11,18,21,0) 100%)",
          zIndex: 1,
        }}
      />
      {/* Scrim 2: bottom darken per stats */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, transparent 60%, rgba(11,18,21,0.5) 100%)",
          zIndex: 1,
        }}
      />
      {/* La sfumatura di /finiture verso l'inchiostro (set 2026). ⚠️ Qui la sezione dopo è
          CHIARA (i modelli su crema): la sfumatura arriva all'inchiostro e poi c'è lo stacco. */}
      <HeroFade zIndex={1} />

      <div
        className="fa-container relative w-full"
        style={{
          zIndex: 2,
          maxWidth: 720,
          marginRight: "auto",
          marginLeft: "var(--fa-space-hero-inset)",
        }}
      >
        <span
          className="fa-eyebrow on-dark"
          style={{ color: "var(--fa-text-on-dark)", fontSize: "clamp(11px, 0.85vw, 13px)" }}
        >
          {t("eyebrow")}
        </span>

        {/* H1 Satoshi roman — DEV-1 updated giu 2026 (era italic; NO Cormorant) */}
        <h1 className="fa-hero-h1 mt-eyebrow" style={{ color: "#f6f4f0" }}>
          {collection.title}
        </h1>

        {/* ⚠️ La tagline segue la lingua e NON ripiega sull'italiano: se in questa
            lingua non c'è, il paragrafo non si disegna. È deliberato — vedi
            `src/lib/tagline.ts`. Oggi è vuota su 22 collezioni su 22, quindi
            questo ramo non si accende da nessuna parte. */}
        {tagline && (
          <p
            className="fa-body-lg mt-title-text"
            style={{
              color: "rgba(246,244,240,0.9)",
              maxWidth: "min(540px, 90%)",
            }}
          >
            {tagline}
          </p>
        )}

        {/* Stats statiche — DEV-2 (NO Counter GSAP) */}
        <div
          className="mt-intro-content flex flex-wrap"
          style={{ gap: "var(--fa-space-hero-gap)" }}
        >
          {heroStats.map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-micro-2 tracking-3 uppercase"
        style={{ color: "rgba(246,244,240,0.55)" }}
      >
        {label}
      </div>
      <div
        className="mt-2"
        style={{
          fontSize: "var(--text-card-title)",
          lineHeight: 1.2,
          fontWeight: 600,
          color: "#f6f4f0",
        }}
      >
        {value}
      </div>
    </div>
  );
}
