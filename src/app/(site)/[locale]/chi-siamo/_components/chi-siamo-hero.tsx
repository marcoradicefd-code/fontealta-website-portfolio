import { getTranslations } from "next-intl/server";

import { HeroFade } from "@/components/hero-fade";
import { HeroScrim } from "@/components/hero-scrim";
import { HeroMediaBg } from "@/components/heros/hero-media-bg";
import type { ActiveLocale } from "@/i18n/routing";
import { getSiteSettings } from "@/lib/content";
import { urlFor } from "@/sanity/lib/image";

/**
 * ChiSiamoHero — hero full-bleed dark con VIDEO di sfondo + testo CENTRATO bianco
 * (design riferimento Marco, giu 2026). Pattern speculare alla home (R2-via-Sanity):
 *
 *  - poster: Sanity `chiSiamoHeroPoster` (urlFor) → fallback locale committato;
 *  - video:  Sanity `chiSiamoHeroVideoUrl`/`…Mp4Url` (R2). Se ENTRAMBI vuoti →
 *            null/null → HeroMediaBg mostra il solo poster. NESSUN fallback video
 *            locale (i file `public/video/chi-siamo-hero.*` sono gitignorati →
 *            puntarli darebbe 404 in produzione). L'URL R2 in Sanity sovrascrive
 *            il locale e diventa la sorgente in prod (M5, Andrea).
 *
 * Riusa HeroMediaBg: base scura → video (webm AV1 → mp4 H.264) → poster still
 * (reduced-motion / nessun video). Scala d'altezza hero LOCKED. Niente eyebrow.
 */
interface ChiSiamoHeroProps {
  locale: ActiveLocale;
}

// Poster fallback locale finché `siteSettings.chiSiamoHeroPoster` non è popolato (M5).
const HERO_POSTER_FALLBACK = "/chi-siamo/hero-poster.webp";

export async function ChiSiamoHero({ locale }: ChiSiamoHeroProps) {
  const t = await getTranslations({ locale, namespace: "chiSiamo" });
  const settings = await getSiteSettings(locale);

  // Poster: immagine Sanity nativa (pipeline WebP/AVIF) se popolata, altrimenti fallback.
  const poster = settings?.chiSiamoHeroPoster;
  const posterSrc =
    (poster ? urlFor(poster)?.width(2400).quality(82).url() : undefined) ?? HERO_POSTER_FALLBACK;

  // Video: SOLO Sanity (R2). Vuoto → null/null → poster-only (prod-safe).
  const videoWebmUrl = settings?.chiSiamoHeroVideoUrl ?? null;
  const videoMp4Url = settings?.chiSiamoHeroVideoMp4Url ?? null;

  return (
    <section className="relative flex min-h-[max(560px,75vh)] items-center justify-center overflow-hidden bg-fa-ink text-fa-white sm:min-h-[max(560px,80vh)] lg:min-h-screen">
      {/* Sfondo video + scrim per leggibilità del testo centrato */}
      <div className="absolute inset-0 overflow-hidden">
        <HeroMediaBg
          posterSrc={posterSrc}
          videoWebmUrl={videoWebmUrl}
          videoMp4Url={videoMp4Url}
          priority
        />
        {/* Ultimo hero a tenersi uno scrim inline, e l'unico rimasto sotto il
            4,5:1 (era M29). Ora usa il componente condiviso: `centrato` e' la
            forma giusta, il testo sta al centro. */}
        <HeroScrim variante="centrato" />
        {/* La sfumatura di /finiture verso l'inchiostro della sezione dopo (set 2026). */}
        <HeroFade />
      </div>

      {/* Contenuto centrato, testo bianco.

          ⛔ Qui c'era `textShadow: 0 1px 18px` sul CONTENITORE (22/09/2026,
          PR B2), ereditata da titolo e paragrafo. Su **Safari vero** quei 18 px
          di sfocatura non vengono applicati e il titolo esce col rilievo, cioè
          una copia scura delle lettere spostata e coi bordi netti; il banco non
          lo riproduce (v. il commento gemello in `produzione-hero.tsx`, che
          porta anche la verifica sui livelli compositi e la controprova della
          sonda). L'ombra resta sul SOLO paragrafo, che ne ha bisogno perché
          sotto ha un video che cambia fotogramma, nella forma di casa
          `0 1px 2px`. */}
      {/* `z-36`: il testo SOPRA lo scrim della barra (35, fisso, alto 320 px sotto `xl`) e
          sotto il pannello del menu (40). Stessa ragione di `home-hero.tsx` (22/10/2026). */}
      <div className="fa-container relative z-36 w-full px-6 pt-20 pb-12 text-center">
        <h1 className="fa-hero-h1 mx-auto max-w-[15ch]" style={{ color: "var(--fa-text-on-dark)" }}>
          {t("heroH1")}
        </h1>
        <p
          className="fa-body-lg mx-auto mt-title-text"
          style={{
            color: "var(--fa-text-on-dark)",
            maxWidth: 600,
            textShadow: "var(--fa-text-shadow-photo)",
          }}
        >
          {t("heroSub")}
        </p>
      </div>
    </section>
  );
}
