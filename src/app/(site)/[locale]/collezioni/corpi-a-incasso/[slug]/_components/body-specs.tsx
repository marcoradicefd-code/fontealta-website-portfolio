import { useTranslations } from "next-intl";

import { WaterSupplyDrops } from "@/components/markers/water-supply-drops";
import { MACRO_ORDER } from "@/lib/product-category";
import type { CONCEALED_BODY_BY_SLUG_QUERY_RESULT } from "@/sanity/types.gen";

/**
 * BodySpecs — la griglia specifiche del modello, ridotta a ciò che un corpo ha
 * davvero (docs/incassi-design.md §7).
 *
 * VIA: Tipologia (un corpo non ha macro+sottotipo), Finiture (non ne ha), «Corpo
 * incasso» (non richiede sé stesso), Personalizzabile.
 * RESTA: le gocce acqua con label — identiche al modello, stesso componente
 * condiviso — e una riga «Ambiti» che prende il posto della Tipologia.
 */
export function BodySpecs({ body }: { body: NonNullable<CONCEALED_BODY_BY_SLUG_QUERY_RESULT> }) {
  const t = useTranslations("modello");
  const tCorpi = useTranslations("corpiIncasso");
  const tCat = useTranslations("productCategories");

  // Ambiti serviti, ordinati da MACRO_ORDER — stessa scala delle pill sulla card e
  // del filtro sull'indice, così i tre punti non possono divergere d'ordine.
  const macros = MACRO_ORDER.filter((m) => body.servesMacros?.includes(m)).map((m) =>
    tCat.has(m) ? tCat(m) : m,
  );

  const rows: { label: string; value: string }[] = [];
  if (macros.length > 0) rows.push({ label: tCorpi("labelAmbiti"), value: macros.join(" · ") });

  const waterLabel =
    body.waterSupply === "hot-cold"
      ? t("waterHotCold")
      : body.waterSupply === "cold"
        ? t("waterCold")
        : null;

  if (rows.length === 0 && waterLabel == null) return null;

  return (
    <section className="fa-section light" style={{ paddingTop: 0 }}>
      <div className="fa-container">
        <h2 className="fa-h3 mb-8">{t("specsTitle")}</h2>
        <div style={{ maxWidth: "800px" }}>
          {waterLabel && (
            <div className="mb-8">
              <WaterSupplyDrops value={body.waterSupply} label={waterLabel} />
            </div>
          )}
          {rows.length > 0 && (
            <dl className="grid grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="pt-3"
                  style={{
                    borderTop: "var(--fa-stroke-hairline) solid var(--fa-border-light)",
                  }}
                >
                  <dt className="fa-eyebrow mb-2" style={{ color: "var(--fa-text-secondary)" }}>
                    {row.label}
                  </dt>
                  <dd style={{ margin: 0, fontWeight: 500, color: "var(--fa-text-primary)" }}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
