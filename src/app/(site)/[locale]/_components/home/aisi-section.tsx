import { getTranslations } from "next-intl/server";

import type { ActiveLocale } from "@/i18n/routing";
import { getFinishes } from "@/lib/content";
import { getFinishHex, getFinishImageSrc } from "@/lib/placeholders";
import { urlFor } from "@/sanity/lib/image";

interface AisiSectionProps {
  locale: ActiveLocale;
}

/**
 * Sezione AISI 316 (LIGHT, redesign frame 16.50) — heading + intro + riga di
 * swatch finiture ROTONDI. Lo swatch mostra l'immagine Sanity `finish.swatchImage`
 * (via `urlFor`, caricabile da Studio) se popolata, altrimenti la tinta piatta
 * `getFinishHex(code, colorHex)` (stato attuale, 0/8 → zero regressione).
 * Code + nome sotto ogni swatch (nome da Sanity `finish.name`, M10 reconciliation).
 * Niente eyebrow né stat-grid (rimossi dal frame).
 */
export async function AisiSection({ locale }: AisiSectionProps) {
  const t = await getTranslations({ locale, namespace: "home" });
  const finishes = await getFinishes(locale);

  return (
    <section className="fa-section light overflow-hidden">
      <div className="fa-container">
        <h2
          className="m-0 text-display-story"
          style={{
            color: "var(--fa-text-primary)",
          }}
        >
          {t("aisiH2Top")} <br />
          {t("aisiH2Bot")}
        </h2>
        <p
          className="fa-body-lg mt-heading-intro max-w-[680px]"
          style={{ color: "var(--fa-text-secondary)" }}
        >
          {t("aisiIntro")}
        </p>

        {/* Riga swatch finiture rotondi */}
        <div className="mt-intro-feature flex flex-wrap justify-center gap-x-8 gap-y-10 sm:justify-between">
          {finishes.map((finish) => {
            const label = typeof finish.name === "string" ? finish.name : (finish.code ?? "");
            const swatchUrl = finish.swatchImage
              ? urlFor(finish.swatchImage)?.width(256).url()
              : getFinishImageSrc(finish.code);
            return (
              <div
                key={finish._id}
                className="group flex w-[92px] flex-col items-center text-center"
              >
                <span
                  className="block h-16 w-16 rounded-full shadow-card inset-ring inset-ring-(--fa-border-light) transition-transform duration-(--dur-standard) ease-out-expo group-hover:scale-[1.15]"
                  style={{
                    background: swatchUrl
                      ? `center / cover no-repeat url(${swatchUrl})`
                      : getFinishHex(finish.code, finish.colorHex),
                  }}
                  aria-hidden
                />
                <span
                  className="mt-3 text-button font-semibold tracking-4 uppercase"
                  style={{ color: "var(--fa-text-primary)" }}
                >
                  {finish.code}
                </span>
                <span
                  className="mt-1 text-caption leading-tight font-medium tracking-4 uppercase"
                  style={{ color: "var(--fa-text-primary)" }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
