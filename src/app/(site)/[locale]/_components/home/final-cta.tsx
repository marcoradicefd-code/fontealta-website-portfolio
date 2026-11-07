import { getTranslations } from "next-intl/server";

import type { ActiveLocale } from "@/i18n/routing";
import { elencoPaesi } from "@/lib/paesi";

import { FinalCtaForm } from "./final-cta-form";

interface FinalCtaProps {
  locale: ActiveLocale;
}

/**
 * Sezione finale (light, frame 17.28) — heading "Raccontaci il progetto."
 * + sottotitolo + form contatti inline (FinalCtaForm). Riusa schema Zod +
 * Server Action (webhook Zapier DRY-RUN) di /contatti.
 *
 * Il sottotitolo (home.ctaIntro) e' l'equivalente del `subtitle` che le altre
 * cinque pagine passano a ProgettareCta: stessa misura (520px), ma centrato
 * sotto l'H2 e in colore su chiaro, perche' questa sezione e' light.
 */
export async function FinalCta({ locale }: FinalCtaProps) {
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <section id="progettare" className="fa-section light overflow-hidden">
      <div className="fa-container">
        <h2
          className="m-0 text-center"
          style={{
            fontSize: "var(--text-heading-2)",
            lineHeight: 1.08,
            letterSpacing: "-0.5px",
            fontWeight: 600,
          }}
        >
          {t("ctaH2")}
        </h2>
        <p
          className="fa-body-lg mx-auto mt-heading-intro max-w-[520px] text-center"
          style={{ color: "var(--fa-text-secondary)" }}
        >
          {t("ctaIntro")}
        </p>
        <FinalCtaForm paesi={elencoPaesi(locale)} />
      </div>
    </section>
  );
}
