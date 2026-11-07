import Image from "next/image";
import { useTranslations } from "next-intl";

import { SanityImage } from "@/components/media/sanity-image";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { modelDisplayName } from "@/lib/model-display-name";
import type { ActiveLocale } from "@/i18n/routing";
import { productLabel } from "@/lib/product-label";
import { sentenceCase } from "@/lib/sentence-case";
import { pickLqip, urlFor } from "@/sanity/lib/image";
import type { MODEL_DETAIL_QUERY_RESULT } from "@/sanity/types.gen";

import { FinishSelector } from "./finish-selector";
import type { AltRisolto } from "@/lib/alt-composto";

/**
 * Il riquadro è la colonna `2fr` di `lg:grid-cols-[3fr_2fr]` con `gap-16` dentro
 * `.fa-container` (max 1200): (1200 − 64) × 2/5 = 454,4px da `lg` in su. Sotto,
 * una colonna sola a tutta larghezza.
 */
const FOTO_SIZES = "(max-width: 1023px) calc(100vw - 48px), 455px";

interface Props {
  breadcrumb: { items: BreadcrumbItem[]; ariaLabel: string };
  model: NonNullable<MODEL_DETAIL_QUERY_RESULT>;
  locale: ActiveLocale;
  /** L'alt della foto nella lingua della pagina, risolto dalla pagina (`altProdotto`). */
  fotoAlt: AltRisolto;
}

/**
 * ModelHero — Server Component (FASE 4.4.2). Layout B "text-forward Split-ready"
 * (decisione locked, model-detail.md §3/§5): pannello info chiaro su `--fa-surface`
 * ~60% + riquadro foto ~40%. H1 nome NON-italic (`--text-display-secondary`,
 * informativo, non editoriale). La foto è `primaryImage` da Sanity (ago 2026,
 * 563 modelli su 595): è above-the-fold ed è l'LCP della pagina, quindi `priority`.
 * Dove manca resta il monogramma gray su `--color-fa-card-cover`.
 *
 * `images` ha più di un elemento su 4 modelli soli: qui si usa comunque
 * `primaryImage`. La galleria è un lavoro a parte, da decidere col design.
 * Swatch finiture: `FinishSelector`, pallini `.fa-finish-dot` interattivi dalla 4.4.3.
 */
export function ModelHero({ model, locale, breadcrumb, fotoAlt }: Props) {
  const t = useTranslations("modello");
  // Il testo del bottone sta in `schedaModello`, che resta sul server (v. `page.tsx`).
  const tScheda = useTranslations("schedaModello");
  const tMacro = useTranslations("productCategories");
  const tSubtype = useTranslations("productSubtypes");

  const displayName = modelDisplayName(model.name, locale, model.code);
  const collectionTitle = model.collections?.[0]?.title ?? null;
  const finishCount = model.finishes?.length ?? 0;

  // L'alt arriva risolto dalla pagina: `altI18n`, poi composto, poi l'italiano con `lang`.
  const fotoUrl = model.primaryImage?.asset ? urlFor(model.primaryImage)?.url() : undefined;
  // LQIP: gia' nel payload, e qui vale doppio perche' questa foto e' l'LCP della
  // pagina. Guardia sull'assenza come sulla card: `lqip` e' opzionale.
  const fotoLqip = pickLqip(model.primaryImage)?.lqip ?? undefined;

  // Descrizione plain-text accanto al codice (RITOCCO 3). `description[$locale]`
  // a runtime è l'array di block (quirk M6 → cast); è sempre 1 paragrafo plain
  // text (verificato), flatten dei `children[].text`. Vuota su EN/64-IT → "".
  const descBlocks = model.description as unknown as Array<{
    children?: Array<{ text?: string }> | null;
  } | null> | null;
  const descText = (descBlocks ?? [])
    .flatMap((b) => (b?.children ?? []).map((c) => c?.text ?? ""))
    .join("")
    .trim();

  const metaItems = [
    // FRONT 2: «macro — sottotipo».
    productLabel(model, { macro: tMacro, subtype: tSubtype }, locale),
    // Il casing lo decide `sentenceCase` al render, per lingua: «4 finiture», DE
    // «4 Oberflächen». Abbassarlo anche qui lo toglieva al tedesco.
    finishCount > 0 ? `${finishCount} ${t("finishesTitle")}` : null,
  ].filter((v): v is string => Boolean(v));

  return (
    <section className="fa-section light" style={{ paddingBottom: "var(--fa-space-sheet-bottom)" }}>
      <div className="fa-container">
        {/* Sotto `lg` una colonna: 48 fra il bottone e la foto, un passo più dei 40 sopra il
            bottone, così il bottone chiude il testo e non galleggia fra testo e foto (Marco,
            30/10/2026). Da `lg` le colonne restano a 64. */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[3fr_2fr] lg:gap-16">
          {/* Pannello info (~60%) */}
          <div>
            {/* Breadcrumb sulla fascia navy, nel punto e con il margine che aveva il
                tasto «Indietro». La lista arriva dalla pagina: la costruisce lato
                server insieme a quella che alimenta il JSON-LD, così le due non
                possono divergere. */}
            <Breadcrumb {...breadcrumb} className="mb-8" />

            {collectionTitle && (
              <span className="fa-eyebrow mb-4" style={{ display: "block" }}>
                {collectionTitle}
              </span>
            )}

            <h1 className="fa-h2" style={{ fontStyle: "normal", color: "var(--fa-text-primary)" }}>
              {displayName}
            </h1>

            <div
              className="mt-3"
              style={{
                // Livello 3 (body/value): codice + descrizione in UN UNICO stile —
                // body, weight 500, --fa-text-primary (identico alle spec-value <dd>).
                // Niente mono / letter-spacing / taglia distinta sul codice: rende in
                // L3 puro, uguale alla descrizione (max 4 varianti tipo nell'hero, Block 2b).
                fontWeight: 500,
                color: "var(--fa-text-primary)",
              }}
            >
              <span>{model.code}</span>
              {descText && <span> — {descText}</span>}
            </div>

            {metaItems.length > 0 && (
              <div
                className="fa-eyebrow mt-6 gap-2"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  // Fuso in Livello 2: stile fa-eyebrow (navy 13/500/0.5px), UNICA
                  // eccezione text-transform none + sentence-case a render → hero da
                  // 4 a 3 varianti tipo. Il separatore · eredita il navy (una riga,
                  // uno stile). Casing a RENDER, mai sui dati Sanity.
                  textTransform: "none",
                }}
              >
                {metaItems.map((item, i) => (
                  <span key={item} className="gap-2" style={{ display: "inline-flex" }}>
                    {i > 0 && <span aria-hidden>·</span>}
                    {sentenceCase(item, locale)}
                  </span>
                ))}
              </div>
            )}

            {model.finishes && model.finishes.length > 0 && (
              <FinishSelector
                finishes={model.finishes}
                locale={locale}
                label={t("labelFinishes")}
              />
            )}

            {/* Al modulo in fondo alla scheda (16/10/2026), in fondo alla colonna di testo dopo le
                finiture, a tutta larghezza sotto `sm` (Marco, stesso giorno). Frammento della
                stessa pagina: lo prende il listener del `LenisProvider`, e `#progettare` ha già lo
                `scroll-margin-top` della nav. Senza `?richiesta=`: il menu parte vuoto. Sopra
                (prossimità, Marco, 30/10/2026): sotto `sm`, dove il bottone è a tutta larghezza,
                40, più dei 12 dentro le finiture e dei 32 fra i blocchi, così l'azione non si
                legge come parte del selettore; da `sm` 32, lo stesso stacco fra i blocchi del
                pannello, perché nella colonna il 40 rompeva il ritmo di 24 e 32. */}
            <Button
              href="#progettare"
              variant="primary"
              size="m"
              className="mt-text-action-feature w-full sm:mt-text-action sm:w-auto"
            >
              {tScheda("richiediInformazioni")}
            </Button>
          </div>

          {/* Riquadro foto (~40%). Quadrato con lo sfondo di collezione già dentro
              → `object-cover` combacia al pixel. Monogramma come fallback. */}
          <div
            className="relative flex items-center justify-center overflow-hidden"
            style={{
              aspectRatio: "1 / 1",
              background: "var(--color-fa-card-cover)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            {fotoUrl ? (
              <SanityImage
                src={fotoUrl}
                alt={fotoAlt.alt}
                lang={fotoAlt.lang}
                fill
                sizes={FOTO_SIZES}
                quality={82}
                priority
                placeholder={fotoLqip ? "blur" : undefined}
                blurDataURL={fotoLqip}
                className="object-cover"
              />
            ) : (
              <Image
                src="/brand/fontealta-monogram-gray.png"
                alt=""
                width={400}
                height={400}
                aria-hidden
                className="h-auto w-1/2 opacity-(--fa-opacity-watermark)"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
