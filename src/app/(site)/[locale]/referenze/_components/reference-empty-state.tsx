import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * ReferenceEmptyState — Server Component. Blocco centrato mostrato quando
 * `projectReference` ritorna 0 documenti (vincolo bloccante spec §9). NON una
 * griglia vuota, NON un 404. Copy interamente da i18n (namespace `referenze`),
 * nessun dato business hardcoded. CTA → `/contatti`.
 */
export function ReferenceEmptyState() {
  const t = useTranslations("referenze");

  return (
    <section className="fa-section light">
      <div className="fa-container narrow flex flex-col items-center text-center">
        <span className="fa-eyebrow">{t("emptyEyebrow")}</span>
        <h2 className="fa-h2 mt-eyebrow text-fa-black">{t("emptyTitle")}</h2>
        <p className="fa-body-lg mt-heading-intro text-fa-text-secondary" style={{ maxWidth: 560 }}>
          {t("emptyBody")}
        </p>
        <Link
          href="/contatti"
          className="mt-text-action-feature inline-flex min-h-(--btn-height-m) items-center justify-center rounded-pill bg-fa-navy px-8 py-3 text-button font-medium tracking-2 text-fa-text-on-dark uppercase transition-all duration-(--dur-control) hover:bg-fa-navy-light focus-visible:ring-[3px] focus-visible:ring-fa-navy focus-visible:outline-none active:scale-[0.97]"
        >
          {t("emptyCta")}
        </Link>
      </div>
    </section>
  );
}
