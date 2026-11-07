import { useTranslations } from "next-intl";

import { ProgettareCta } from "@/components/sections/progettare-cta";

/**
 * ProgettareSection — adapter chi-siamo per la CTA condivisa <ProgettareCta>.
 * Risolve il namespace chiSiamo e delega layout + form al componente:
 *   - title: chiSiamo.formH2 — key SPECIFICA (preserva l'EN "Designing far and wide.").
 *   - subtitle: chiSiamo.formIntro — copy specifico chi-siamo.
 * `id="progettare"`, lo stile e `<ContactForm>` in `<Suspense>` vivono in ProgettareCta.
 */
export function ProgettareSection() {
  const t = useTranslations("chiSiamo");

  return <ProgettareCta title={t("formH2")} subtitle={t("formIntro")} />;
}
