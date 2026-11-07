import { useLocale, useTranslations } from "next-intl";

import type { ActiveLocale } from "@/i18n/routing";

import { WaterSupplyDrops } from "@/components/markers/water-supply-drops";
import { Link } from "@/i18n/navigation";
import { productLabel } from "@/lib/product-label";
import type { MODEL_DETAIL_QUERY_RESULT } from "@/sanity/types.gen";

import { CENTER_UNDERLINE } from "@/components/ui/center-underline";

import { AlimentationChips } from "./supply-markers";

/**
 * ModelSpecs — Server Component (FASE 4.4.2). Render CONDIZIONALE:
 *  - facts sempre disponibili (tipologia, n° finiture, flags).
 *  Le misure non si mostrano: stanno su Sanity (`specs`) e a video entra solo la principale,
 *  dentro l'alt composto della foto (Marco, 2/11/2026; spec contenuti-per-lingua § B).
 * Nessun contenuto hardcoded: tutto da `model.*`; label UI da namespace `modello`.
 */
export function ModelSpecs({ model }: { model: NonNullable<MODEL_DETAIL_QUERY_RESULT> }) {
  const t = useTranslations("modello");
  const tMacro = useTranslations("productCategories");
  const tSubtype = useTranslations("productSubtypes");
  // Il termine ufficiale del catalogo dipende dalla lingua, e qui la lingua non
  // arriva come prop: `useLocale` è la sua sorgente nei componenti client.
  const locale = useLocale() as ActiveLocale;

  // `bodySlug` presente → il valore diventa un link alla scheda del corpo. Testo,
  // posizione e aspetto a riposo restano identici: cambia solo la cliccabilità.
  const rows: { label: string; value: string; bodySlug?: string }[] = [];
  // Tipologia (FRONT 2): «macro — sottotipo».
  const typeLabel = productLabel(model, { macro: tMacro, subtype: tSubtype }, locale);
  if (typeLabel) rows.push({ label: t("labelType"), value: typeLabel });
  if (model.finishes && model.finishes.length > 0)
    rows.push({ label: t("labelFinishes"), value: String(model.finishes.length) });
  // Corpo incasso (spec cliente Andrea 24/07): riga mostrata SOLO sugli articoli
  // che RICHIEDONO un corpo a incasso venduto a parte — stesso criterio della pill
  // "Richiede corpo incasso" sulle card. Valore = codice del corpo (es. "MR.INC").
  // Gli articoli con includesConcealedBody ma senza required non mostrano nulla.
  // Lo slug può mancare anche col codice presente (un corpo senza slug in Studio):
  // in quel caso la riga resta testo, come prima. Un link a `/corpi-a-incasso/`
  // senza segmento finale porterebbe all'indice, non alla scheda — meglio niente
  // link che un link che va altrove.
  const concealedBodyCode = model.requiredConcealedBody?.code;
  if (concealedBodyCode)
    rows.push({
      label: t("labelConcealedBody"),
      value: concealedBodyCode,
      bodySlug: model.requiredConcealedBody?.slug ?? undefined,
    });
  if (model.isCustomizable) rows.push({ label: t("labelCustomizable"), value: t("yes") });

  const waterLabel =
    model.waterSupply === "hot-cold"
      ? t("waterHotCold")
      : model.waterSupply === "cold"
        ? t("waterCold")
        : null;
  const alimLabels: Record<string, string> = {
    standard: t("alimStandard"),
    "standard-plus": t("alimStandardPlus"),
    cw: t("alimCw"),
    ew: t("alimEw"),
    "4s": t("alim4s"),
  };
  const hasMarkers =
    waterLabel != null || (model.alimentationTypes != null && model.alimentationTypes.length > 0);

  if (rows.length === 0 && !hasMarkers) return null;

  return (
    <section className="fa-section light" style={{ paddingTop: 0 }}>
      <div className="fa-container">
        <h2 className="fa-h3 mb-8">{t("specsTitle")}</h2>
        {/* Markers row + specs dl share ONE 800px box so their column tracks line
            up. Both use grid-cols-4 (= repeat(4, minmax(0,1fr))) at lg: the water
            block spans cols 1-2 (flush with Tipologia), the chips cols 3-4 (flush
            with Corpo a incasso). When markers render, the dl is forced to 4-col
            even with <4 rows so the "column 3" hairline stays put (Block 2b). */}
        <div style={{ maxWidth: "800px" }}>
          {hasMarkers && (
            <div className="mb-8 grid grid-cols-1 gap-x-12 gap-y-3 md:grid-cols-4">
              {waterLabel && (
                <div className="flex items-center md:col-span-2 md:col-start-1">
                  <WaterSupplyDrops value={model.waterSupply} label={waterLabel} />
                </div>
              )}
              <div className="flex md:col-span-2 md:col-start-3">
                <AlimentationChips types={model.alimentationTypes} labels={alimLabels} />
              </div>
            </div>
          )}
          <dl
            className={`grid grid-cols-1 gap-x-12 gap-y-6 ${
              hasMarkers
                ? "md:grid-cols-4"
                : rows.length >= 4
                  ? "sm:grid-cols-2 lg:grid-cols-4"
                  : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
            style={{ margin: 0 }}
          >
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
                  {row.bodySlug ? (
                    <Link
                      href={{
                        pathname: "/collezioni/corpi-a-incasso/[slug]",
                        params: { slug: row.bodySlug },
                      }}
                      className={CENTER_UNDERLINE}
                    >
                      {row.value}
                    </Link>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
