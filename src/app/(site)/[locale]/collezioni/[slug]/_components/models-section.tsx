"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import { FilterBar } from "@/components/filters/filter-bar";
import { FiltriMobile } from "@/components/filters/filtri-mobile";
import { useFiltriUrl } from "@/components/filters/use-filtri-url";
import {
  gruppiVisibili,
  INSIEME_VUOTO,
  type GruppoFiltro,
  type StatoFiltri,
} from "@/lib/filtri-url";
import { getFinishImageSrc } from "@/lib/placeholders";
import { CARD_PRIORITARIE, ModelCard } from "@/components/cards/model-card";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { composeFinishLabel } from "@/lib/finish-label";
import { MACRO_ORDER, resolveMacro } from "@/lib/product-category";
import type { ActiveLocale } from "@/i18n/routing";
import type { COLLECTION_DETAIL_QUERY_RESULT } from "@/sanity/types.gen";
import { SectionHeading } from "@/components/ui/section-heading";

type Collection = NonNullable<COLLECTION_DETAIL_QUERY_RESULT>;
type Model = Collection["models"][number];

interface Props {
  breadcrumb: { items: BreadcrumbItem[]; ariaLabel: string };
  collection: Collection;
  locale: ActiveLocale;
}

/**
 * Section 2 — filter + grid for COLLECTION detail page (FASE 4.2.4).
 *
 * STATO NELL'URL (chiude M13): `?finitura=MX,BX&ambiente=lavabo,doccia`, unica
 * sorgente condivisa con la barra mobile. Prima erano due `useState`, invisibili
 * a un refresh, a un link condiviso e al tasto indietro.
 * Logica OR: match se (nessuna finitura selezionata OR il modello ha ≥1 finitura
 * attiva) AND (nessuna categoria selezionata OR la macro-categoria del modello —
 * `resolveMacro(m)` — è tra quelle attive). Il 2° gruppo mantiene la label
 * "Ambiente" (i18n `filtroAmbiente`); FRONT 2: le pill derivano da `productMacro`
 * (6 macro).
 *
 */
export function ModelsSection({ collection, locale, breadcrumb }: Props) {
  const t = useTranslations("dettaglio");
  const tCat = useTranslations("productCategories");

  // Pill finitura: etichetta «CODICE-Descrizione» dalla sorgente unica
  // `composeFinishLabel`, la stessa del selettore sulla scheda — richiesta di Andrea
  // del 28/07: «un solo linguaggio ovunque». Prima qui compariva il solo nome, quindi
  // la stessa finitura si chiamava in due modi a due schermate di distanza.
  //
  // ⚠️ L'ORDINE va imposto qui e non basta quello delle query. Le query ordinano
  // l'array di OGNI modello per `finish.order`, ma questa lista è l'UNIONE su tutti i
  // modelli della collezione: senza il sort finale l'ordine sarebbe quello di prima
  // apparizione (la finitura del primo modello che la porta), che col listino non
  // c'entra nulla. `order` è nullable nei tipi → i null in coda, non in testa.
  //
  // ⚠️ La chiave è il CODICE (`MX`), non l'`_id`: da qui finisce nell'URL, e un
  // `_id` di Sanity in un link condiviso è illeggibile e cambia se il documento
  // viene ricreato. Una finitura senza codice non è filtrabile e viene saltata
  // rumorosamente: sparirebbe dai filtri in silenzio.
  const finishOptions = useMemo(() => {
    const map = new Map<string, { label: string; order: number; swatch: string | null }>();
    for (const m of collection.models) {
      if (!m.finishes) continue;
      for (const f of m.finishes) {
        if (!f.code) {
          if (f._id) console.error(`[filtri] finitura senza code: ${f._id} — non filtrabile.`);
          continue;
        }
        if (map.has(f.code)) continue;
        map.set(f.code, {
          label: composeFinishLabel(f, locale) || f.code,
          order: f.order ?? Number.MAX_SAFE_INTEGER,
          swatch: getFinishImageSrc(f.code),
        });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].order - b[1].order)
      .map(([valore, v]) => ({ valore, etichetta: v.label, swatch: v.swatch }));
  }, [collection.models, locale]);

  // Pill del 2° gruppo (label UI "Ambiente") = macro-categorie presenti tra i modelli
  // della collezione via `resolveMacro` (6 macro), ord. MACRO_ORDER.
  const typeOptions = useMemo(() => {
    const present = new Set<string>();
    for (const m of collection.models) {
      const macro = resolveMacro(m);
      if (macro) present.add(macro);
    }
    return MACRO_ORDER.filter((c) => present.has(c)).map((c) => ({
      valore: c as string,
      etichetta: tCat.has(c) ? tCat(c) : c,
    }));
  }, [collection.models, tCat]);

  // I due gruppi, nella forma condivisa fra vista desktop, barra mobile e URL.
  // `gruppiVisibili` toglie quelli con meno di due opzioni: con una sola,
  // selezionarla equivale a non filtrare.
  const gruppi = useMemo<GruppoFiltro[]>(
    () =>
      gruppiVisibili([
        { chiave: "finitura", etichetta: t("filtroFinitura"), opzioni: finishOptions },
        { chiave: "ambiente", etichetta: t("filtroAmbiente"), opzioni: typeOptions },
      ]),
    [finishOptions, typeOptions, t],
  );

  const { stato, attivaOpzione, applica } = useFiltriUrl(gruppi);

  // Il PREDICATO in un posto solo: lo usano la griglia e i conteggi vivi dello
  // sheet. Se lo sheet contasse con una regola sua, il numero sul bottone e le
  // card rese potrebbero divergere — ed è proprio il numero che l'utente usa
  // per decidere se toccare.
  const filtra = useCallback(
    (s: StatoFiltri): Model[] => {
      const fin = s.finitura ?? INSIEME_VUOTO;
      const amb = s.ambiente ?? INSIEME_VUOTO;
      return collection.models.filter((m) => {
        const finishMatch =
          fin.size === 0 || m.finishes?.some((f) => f.code && fin.has(f.code)) === true;
        const macro = resolveMacro(m);
        const typeMatch = amb.size === 0 || (macro != null && amb.has(macro));
        return finishMatch && typeMatch;
      });
    },
    [collection.models],
  );

  const filteredModels = useMemo<Model[]>(() => filtra(stato), [filtra, stato]);
  const conta = useCallback((s: StatoFiltri) => filtra(s).length, [filtra]);

  return (
    <section className="fa-section light overflow-hidden">
      {/* Container LOCALE 1320 (override puntuale, NON `--container-max` globale che
          resta 1200 site-wide): regola "metà-margine" — a 1440 il margine 120px/lato
          → 60 (dimezzato ma presente). Si attiva solo ≥~1368px; sotto il container
          riempie e resta il gutter 24px → mobile/tablet invariati. Vedi
          docs/design-specs/button-system-responsive-plan.md. */}
      <div className="fa-container max-w-[1320px]">
        {/* Breadcrumb sulla fascia navy, nella posizione e con il margine che aveva il
            tasto «Indietro». Sta QUI e non nell'hero per la stessa ragione di allora:
            l'hero è scuro full-bleed e il navy su ink darebbe 1,38:1, mentre questa
            sezione è chiara. Allineato al container locale 1320 come i filtri sotto. */}
        <Breadcrumb {...breadcrumb} className="mb-8" />

        {/* Perché esiste e perché è invisibile: vedi `SectionHeading`. */}
        <SectionHeading>{t("statArticoli")}</SectionHeading>

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

        {filteredModels.length === 0 ? (
          <p className="py-12 text-center text-lg" style={{ color: "var(--fa-text-secondary)" }}>
            {t("filtroNessunRisultato")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredModels.map((m, i) => (
              <ModelCard key={m._id} model={m} locale={locale} priority={i < CARD_PRIORITARIE} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
