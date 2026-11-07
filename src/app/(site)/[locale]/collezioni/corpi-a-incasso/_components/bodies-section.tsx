"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import { CARD_PRIORITARIE, ModelCard } from "@/components/cards/model-card";
import { FilterBar } from "@/components/filters/filter-bar";
import { FiltriMobile } from "@/components/filters/filtri-mobile";
import { useFiltriUrl } from "@/components/filters/use-filtri-url";
import {
  gruppiVisibili,
  INSIEME_VUOTO,
  type GruppoFiltro,
  type StatoFiltri,
} from "@/lib/filtri-url";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import type { ActiveLocale } from "@/i18n/routing";
import { matchesActiveMacros } from "@/lib/concealed-body-filter";
import { MACRO_ORDER } from "@/lib/product-category";
import type { CONCEALED_BODIES_INDEX_QUERY_RESULT } from "@/sanity/types.gen";
import { SectionHeading } from "@/components/ui/section-heading";

type Body = CONCEALED_BODIES_INDEX_QUERY_RESULT["bodies"][number];

interface Props {
  breadcrumb: { items: BreadcrumbItem[]; ariaLabel: string };
  bodies: Body[];
  locale: ActiveLocale;
}

/**
 * Sezione indice dei corpi a incasso — il gemello di `ModelsSection`, stesso
 * template: risalita, filtri, griglia, `ModelCard`. La diversità di design del
 * cantiere vive nella SCHEDA del singolo corpo, non qui (docs/incassi-design.md §2).
 *
 * Due sole differenze, entrambe dettate dal dato e non dal gusto:
 *  - un solo gruppo di filtri (Ambiente). I corpi non hanno finiture, quindi il
 *    gruppo Finitura non avrebbe nemmeno un'opzione da mostrare;
 *  - il predicato è ad APPARTENENZA D'ARRAY (`matchesActiveMacros`), non a
 *    uguaglianza: un corpo serve N ambienti e compare sotto ognuno.
 */
export function BodiesSection({ bodies, locale, breadcrumb }: Props) {
  const t = useTranslations("dettaglio");
  const tCat = useTranslations("productCategories");
  const tCorpi = useTranslations("corpiIncasso");

  // Pill = le sole macro effettivamente servite da almeno un corpo, ordinate da
  // MACRO_ORDER. Oggi sono tre (Lavabo · Doccia · Vasca); derivarle dal dato invece
  // di cablarle fa comparire da sola la quarta, il giorno che un corpo la servisse.
  const macroOptions = useMemo(() => {
    const present = new Set<string>();
    for (const b of bodies) {
      for (const macro of b.servesMacros ?? []) present.add(macro);
    }
    return MACRO_ORDER.filter((m) => present.has(m)).map((m) => ({
      valore: m as string,
      etichetta: tCat.has(m) ? tCat(m) : m,
    }));
  }, [bodies, tCat]);

  // Un gruppo solo, e la stessa regola delle collezioni: si mostra con ≥ 2
  // opzioni. Lo stato sta nell'URL come là — è lo stesso `ambiente=` — ma il
  // PREDICATO resta quello ad appartenenza d'array: qui cambia la semantica,
  // non la sorgente.
  const gruppi = useMemo<GruppoFiltro[]>(
    () =>
      gruppiVisibili([
        { chiave: "ambiente", etichetta: t("filtroAmbiente"), opzioni: macroOptions },
      ]),
    [macroOptions, t],
  );
  const { stato, attivaOpzione, applica } = useFiltriUrl(gruppi);

  // Predicato in un posto solo, griglia e conteggi. Qui resta quello ad
  // APPARTENENZA D'ARRAY: un corpo serve N ambienti e compare sotto ognuno.
  const filtra = useCallback(
    (s: StatoFiltri): Body[] =>
      bodies.filter((b) => matchesActiveMacros(b, s.ambiente ?? INSIEME_VUOTO)),
    [bodies],
  );

  const filteredBodies = useMemo<Body[]>(() => filtra(stato), [filtra, stato]);
  const conta = useCallback((s: StatoFiltri) => filtra(s).length, [filtra]);

  return (
    <section className="fa-section light overflow-hidden">
      {/* Container LOCALE 1320, identico a ModelsSection (regola "metà-margine"). */}
      <div className="fa-container max-w-[1320px]">
        <Breadcrumb {...breadcrumb} className="mb-8" />

        {/* Perché esiste e perché è invisibile: vedi `SectionHeading`. */}
        <SectionHeading>{tCorpi("statCorpi")}</SectionHeading>

        <FiltriMobile gruppi={gruppi} stato={stato} onApplica={applica} conta={conta} />

        {/* ⚠️ **`<aside>` e non `<div>`, ed è l'`aria-label` a renderlo un landmark.**
            Un `aside` annidato dentro un elemento di sezionamento — qui un
            `<section>` — vale `generic` per le API di accessibilità, **tranne
            quando ha un nome accessibile**: allora torna `complementary` (ARIA in
            HTML). Quindi l'etichetta non è un di più, è la condizione. Serve a chi
            naviga per landmark per saltare ai filtri senza attraversare la griglia,
            e a chi ci arriva dentro per capire dove si trova.

            L'etichetta viene da una chiave che esiste già (`dettaglio.filtriTitolo`,
            la stessa del titolo del bottom sheet): nessuna stringa nuova da
            tradurre, e le due viste si chiamano allo stesso modo perché sono la
            stessa cosa.

            Il box è identico: `aside` e `div` sono entrambi di livello blocco e le
            classi restano quelle. */}
        {gruppi.length > 0 && (
          <aside aria-label={t("filtriTitolo")} className="mb-12 hidden flex-col gap-6 lg:flex">
            {gruppi.map((g) => (
              <FilterBar
                key={g.chiave}
                label={g.etichetta}
                options={g.opzioni}
                active={stato[g.chiave] ?? INSIEME_VUOTO}
                onToggle={(v) => attivaOpzione(g.chiave, v)}
              />
            ))}
          </aside>
        )}

        {filteredBodies.length === 0 ? (
          /* Ramo oggi IRRAGGIUNGIBILE: le pill derivano dai corpi presenti, quindi
             ognuna ha per costruzione almeno un risultato e la composizione è in OR.
             Resta come rete se un giorno il dato cambiasse forma. Riusa la stringa
             condivisa invece di aggiungere una chiave i18n che nessuno vedrebbe. */
          <p className="py-12 text-center text-lg" style={{ color: "var(--fa-text-secondary)" }}>
            {t("filtroNessunRisultato")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredBodies.map((b, i) => (
              <ModelCard key={b._id} model={b} locale={locale} priority={i < CARD_PRIORITARIE} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
