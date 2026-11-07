import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * AreaProTeaser — sez. 4 (spec §2/§7). Server Component.
 *
 * Teaser visivo "Sei un progettista?" con UN bottone verso la pagina Area
 * Riservata. Erano DUE — Accedi e Registrati — disabilitati con tooltip «Coming
 * soon» finché quella pagina non esisteva. Da settembre 2026 c'è, e due bottoni
 * morti accanto a un link vivo nel nav sarebbero stati un vicolo cieco.
 *
 * ⚠️ Uno solo, e con l'etichetta della DESTINAZIONE: login e registrazione
 * continuano a non esistere, quindi un bottone «Accedi» che porta a una pagina
 * in costruzione prometterebbe una cosa e ne darebbe un'altra. Il login vero è
 * FASE 8, fuori scope (spec §10.6).
 */
export function AreaProTeaser() {
  const t = useTranslations("contatti");
  const tNav = useTranslations("nav");

  return (
    <section className="fa-section dark" style={{ background: "var(--fa-ink)" }}>
      <div className="fa-container narrow" style={{ textAlign: "center" }}>
        <h2 className="fa-h3" style={{ color: "var(--fa-text-on-dark)" }}>
          {t("areaProH2")}
        </h2>
        <p
          className="fa-body-lg mx-auto mt-heading-intro"
          style={{ color: "var(--fa-text-on-dark-secondary)", maxWidth: 520 }}
        >
          {t("areaProText")}
        </p>
        <div className="mt-text-action flex justify-center">
          <Button href="/area-riservata" variant="secondary" dark>
            {tNav("areaPro")}
          </Button>
        </div>
      </div>
    </section>
  );
}
