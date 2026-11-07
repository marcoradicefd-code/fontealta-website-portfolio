import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Il <title> della 404 è il `title.default` del layout, nella lingua della pagina
// (22/10/2026): vedi il commento lì.

/**
 * 404 brandizzato, localizzato. Reso DENTRO il layout `[locale]` (nav + footer +
 * font + `NextIntlClientProvider`): la `setRequestLocale(locale)` del layout imposta
 * il locale → `getTranslations` risolve IT/EN. Innescato da `notFound()` (le 4 route
 * `[slug]`) e dal catch-all `[...rest]` per ogni path locale sconosciuto.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("errorPages.notFound");

  return (
    <section className="fa-section dark flex min-h-[max(520px,70vh)] items-center">
      <div className="fa-container narrow text-center">
        {/* eyebrow on-dark = warm white (decisione LOCKED). La classe globale
            `.fa-eyebrow.on-dark` è navy-bright (drift vs la decisione) → override
            inline come gli altri hero scuri. */}
        <p className="fa-eyebrow on-dark" style={{ color: "var(--fa-text-on-dark)" }}>
          {t("eyebrow")}
        </p>
        <h1 className="fa-h2 mt-eyebrow" style={{ color: "var(--fa-text-on-dark)" }}>
          {t("title")}
        </h1>
        <p
          className="fa-body-lg mx-auto mt-title-text max-w-[52ch]"
          style={{ color: "var(--fa-text-on-dark)" }}
        >
          {t("body")}
        </p>
        <div className="mt-text-action-feature flex flex-col items-center gap-5">
          <Button href="/collezioni" variant="secondary" dark size="l">
            {t("ctaPrimary")}
          </Button>
          {/* Bersaglio a 44 col `::before` (set 2026): il testo è alto 20, e
              crescere la scatola sposterebbe tutta la pagina. */}
          <Link
            href="/"
            className="relative text-caption-1 font-medium tracking-link uppercase underline-offset-4 before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] hover:underline"
            style={{ color: "var(--fa-text-on-dark)" }}
          >
            {t("ctaSecondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
