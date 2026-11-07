import Image from "next/image";
import { useTranslations } from "next-intl";

import { HeroFade } from "@/components/hero-fade";

/**
 * ContattiHero — Server Component, presentational.
 *
 * Layout centrato (design Marco "Contatti.jpg"): eyebrow + H1 dritto bold
 * (.fa-h1, NON italic — spec §10.8) + sottotitolo, tutto centrato.
 *
 * Asset: foto reale porto di Viareggio (megayacht), webp ottimizzato a piena
 * qualità. `unoptimized` per servire il file as-is — evita il bug next/image
 * che su exFAT serve il sidecar AppleDouble `._*` (vedi CLAUDE.md) e niente
 * doppia compressione. Hero height = scala home (decisione hero-height locked).
 *
 * Scrim WCAG: l'immagine sorgente è chiara (cielo coperto + riflessi acqua) →
 * il testo bianco richiede un fondino scuro forte. Composito = base uniforme +
 * radiale center-weighted (più scuro dietro il blocco testo) → contrasto
 * verificato AA su H1 e sottotitolo, preservando dettaglio ai bordi.
 */
const HERO_IMAGE = "/contatti/hero-porto-viareggio.webp";

export function ContattiHero() {
  const t = useTranslations("contatti");

  return (
    <section
      className="fa-section dark relative flex min-h-[max(560px,75vh)] items-center justify-center overflow-hidden sm:min-h-[max(560px,80vh)] lg:min-h-screen"
      style={{
        padding:
          "var(--fa-space-hero-top-contact) calc(var(--spacing) * 6) var(--fa-space-hero-bottom)",
      }}
    >
      <Image
        src={HERO_IMAGE}
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
        aria-hidden
        className="object-cover object-center"
        style={{ zIndex: 0 }}
      />

      {/* Fondino WCAG: base uniforme + radiale center-weighted sul blocco testo.
          Tarato empiricamente (sample pixel screenshot): porta il pixel di
          sfondo più chiaro sotto al testo abbastanza in basso da garantire
          AA su eyebrow/H1/sottotitolo, lasciando l'immagine leggibile ai bordi. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 125% 70% at 50% 50%, rgba(11,18,21,0.60) 0%, rgba(11,18,21,0.48) 42%, rgba(11,18,21,0.28) 72%, rgba(11,18,21,0.08) 100%)",
          zIndex: 1,
        }}
      />
      <div className="absolute inset-0" style={{ background: "rgba(11,18,21,0.55)", zIndex: 1 }} />
      {/* La sfumatura di /finiture verso l'inchiostro della sezione dopo (set 2026). */}
      <HeroFade zIndex={1} />

      <div
        className="fa-container relative mx-auto flex w-full flex-col items-center text-center"
        style={{ zIndex: 2, maxWidth: 820 }}
      >
        <span className="fa-eyebrow on-dark" style={{ color: "rgba(246, 244, 240, 0.82)" }}>
          {t("heroEyebrow")}
        </span>

        <h1 className="fa-hero-h1 mt-eyebrow" style={{ color: "var(--fa-text-on-dark)" }}>
          {t("heroH1")}
        </h1>

        <p
          className="fa-body-lg mt-title-text"
          style={{ color: "var(--fa-text-on-dark)", maxWidth: 560 }}
        >
          {t("heroSub")}
        </p>
      </div>
    </section>
  );
}
