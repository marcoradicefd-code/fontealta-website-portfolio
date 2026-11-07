import { getTranslations, setRequestLocale } from "next-intl/server";

import { FaqSection } from "@/components/faq/faq-section";
import { HeroFade } from "@/components/hero-fade";
import { HeroScrim } from "@/components/hero-scrim";
import { ProgettareCta } from "@/components/sections/progettare-cta";
import type { ActiveLocale } from "@/i18n/routing";
import { getFaq, getFinishes } from "@/lib/content";
import { staticRouteMetadata } from "@/lib/route-metadata";
import { contentPageId } from "@/sanity/lib/faq-rules";

import { FinishCard } from "./_components/finish-card";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

export const generateMetadata = staticRouteMetadata({
  namespace: "finiture",
  href: "/finiture",
});

// Enum `finish.category` → chiave i18n. Le 4 categorie Sanity sono
// natural / mirror / painted / pvd (vedi sanity/schemas/documents/finish.ts).
const CATEGORY_KEYS = ["natural", "mirror", "painted", "pvd"] as const;

export default async function FiniturePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "finiture" });
  // Il SOTTOTITOLO della CTA resta quello di /collezioni (deliberatamente
  // condiviso); il TITOLO ha invece una chiave propria, finiture.progettareH2,
  // perche' la domanda che pone e' specifica di questa pagina.
  const tc = await getTranslations({ locale, namespace: "collezioni" });
  const finishes = await getFinishes(locale);
  // Il documento fisso non ha slug: il webhook manda il solo tipo, `contentPage`.
  const faq = await getFaq(contentPageId("finishes"), locale, ["contentPage"]);

  // Label categoria localizzate pre-risolte (la FinishCard resta presentational,
  // senza hook i18n). Fallback al value enum grezzo se chiave assente.
  const categoryLabels = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [key, t(`category.${key}`)]),
  ) as Record<(typeof CATEGORY_KEYS)[number], string>;

  return (
    <>
      {/* HERO — redesign giu 2026 (Figma): immagine di sfondo + scrim WCAG AA,
          contenuto centrato. Sfondo via CSS background-image (asset locale WebP,
          niente next/image optimizer → evita il sidecar AppleDouble su exFAT). */}
      <section
        className="fa-section dark relative flex min-h-[max(560px,75vh)] items-center overflow-hidden sm:min-h-[max(560px,80vh)] lg:min-h-screen"
        style={{
          backgroundImage: "url(/finiture/hero-bg.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Scrim di lettura: il componente condiviso, variante `centrato` a passo
            −1 — un passo sotto /produzione, e uno sopra il minimo che regge la
            soglia su questa foto. Prima erano due fermi su `rgba(10,10,9)`, il
            nero vecchio, mentre ogni altro hero del sito compone su `--fa-ink`:
            era M28. */}
        <HeroScrim variante="centrato" passi={-1} />
        {/* Sfumatura in fondo verso l'inchiostro della griglia: nata qui, ora condivisa. */}
        <HeroFade />
        <div className="fa-container relative w-full" style={{ zIndex: 1 }}>
          <div className="mx-auto max-w-[680px] text-center">
            {/* Eyebrow on-dark = bianco caldo PIENO (LOCK giu 2026), identico a
                quello di /collezioni. L'alpha .75 di prima era l'ultimo rimasto
                dei tre di questo hero, ed era anche il valore piu' basso
                misurato sulla pagina. */}
            <span className="fa-eyebrow on-dark" style={{ color: "var(--fa-text-on-dark)" }}>
              {t("heroEyebrow")}
            </span>
            <h1 className="fa-hero-h1 mt-eyebrow" style={{ color: "var(--fa-text-on-dark)" }}>
              {t("heroTitle")}
            </h1>
            {/* Sottotitolo al bianco PIENO del testo su scuro (--fa-text-on-dark, #f6f4f0):
                l'alpha .82 lo lasciava sotto soglia sui punti chiari della foto.
                La riga decorativa sotto e' stata RIMOSSA, non nascosta. */}
            <p
              className="fa-body-lg mx-auto mt-title-text"
              style={{ maxWidth: "46ch", color: "var(--fa-text-on-dark)" }}
            >
              {t("heroSubtitle")}
            </p>
          </div>
        </div>
      </section>

      {/* GRIGLIA swatch 2×4 — tema dark (anthracite). 4 col desktop / 2 tablet / 1 mobile. */}
      <section className="fa-section dark">
        <div className="fa-container">
          {finishes.length === 0 ? (
            <p className="fa-body-lg" style={{ color: "rgba(246,244,240,0.7)" }}>
              {t("emptyState")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {finishes.map((finish) => {
                const categoryLabel = finish.category
                  ? (categoryLabels[finish.category] ?? finish.category)
                  : "";
                return (
                  <FinishCard
                    key={finish._id}
                    finish={finish}
                    locale={locale}
                    categoryLabel={categoryLabel}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* FAQ della pagina (Marco, 5/11/2026): come la home, dal documento fisso `contentPage-finishes`;
          chiara fra la griglia e la CTA, che sono scure, quindi con le sue due imbottiture. */}
      <FaqSection items={faq} locale={locale} />

      {/* CTA condivisa: titolo dal namespace finiture, sottotitolo da collezioni */}
      <ProgettareCta title={t("progettareH2")} subtitle={tc("progettareSub")} />
    </>
  );
}
