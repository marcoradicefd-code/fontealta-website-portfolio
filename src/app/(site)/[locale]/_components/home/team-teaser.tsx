import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import type { ActiveLocale } from "@/i18n/routing";

interface TeamTeaserProps {
  locale: ActiveLocale;
}

/**
 * Teaser team (dark) — "Alta qualità, / Altamente umano." + CTA storia + foto.
 * Immagine: foto dello stabilimento Fontealta (asset locale WebP ottimizzato,
 * `public/team/stabilimento.webp`). Nessun campo Sanity dedicato (M5 follow-up).
 */
export async function TeamTeaser({ locale }: TeamTeaserProps) {
  const t = await getTranslations({ locale, namespace: "home" });
  // L'alt della foto nella lingua (Marco, 2/11/2026): era italiano, scritto qui, in tutte e cinque.
  const tImmagini = await getTranslations({ locale, namespace: "immagini" });

  return (
    <section
      className="fa-section overflow-hidden"
      style={{ background: "var(--fa-ink)", color: "var(--fa-text-on-dark)" }}
    >
      <div className="fa-container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Testo */}
          <div className="max-w-[480px]">
            <span className="fa-eyebrow on-dark" style={{ color: "var(--fa-text-on-dark)" }}>
              {t("teamEyebrow")}
            </span>
            <h2
              className="m-0 mt-eyebrow text-display-story"
              style={{
                color: "var(--fa-text-on-dark)",
              }}
            >
              {t("teamH2Top")} <br />
              {t("teamH2Bot")}
            </h2>
            <p className="fa-body-lg mt-heading-intro" style={{ color: "var(--fa-text-on-dark)" }}>
              {t("teamIntro")}
            </p>
            {/* Sotto `sm` il bottone si centra, il testo sopra resta a sinistra:
                è l'esempio da cui Marco è partito (set 2026). `text-center` basta
                perché il Button è inline-flex. */}
            <div className="mt-text-action-feature text-center sm:text-left">
              <Button href="/chi-siamo" variant="secondary" dark>
                {t("teamCta")}
              </Button>
            </div>
          </div>

          {/* Foto stabilimento (asset locale WebP) */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
            <Image
              src="/team/stabilimento.webp"
              alt={tImmagini("stabilimento")}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              quality={90}
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
