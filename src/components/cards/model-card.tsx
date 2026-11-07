import Image from "next/image";
import { useTranslations } from "next-intl";

import { WaterSupplyDrops } from "@/components/markers/water-supply-drops";
import { SanityImage } from "@/components/media/sanity-image";
import { IntentLink } from "@/components/ui/intent-link";
import type { ActiveLocale } from "@/i18n/routing";
import { pickLqip, urlFor } from "@/sanity/lib/image";
import { modelOverline } from "@/lib/model-overline";
import { getFinishHex, getFinishImageSrc } from "@/lib/placeholders";
import { MACRO_ORDER } from "@/lib/product-category";
import { risolviAlt } from "@/lib/alt-composto";
import { scegliImmagineCard } from "@/lib/card-image";
import { productLabel } from "@/lib/product-label";
import type {
  COLLECTION_DETAIL_QUERY_RESULT,
  CONCEALED_BODIES_INDEX_QUERY_RESULT,
  CONCEALED_BODY_BY_SLUG_QUERY_RESULT,
  MODEL_DETAIL_QUERY_RESULT,
} from "@/sanity/types.gen";

// Union che accomoda ModelsSection (collection detail, FASE 4.2.4) e RelatedModels
// (model detail, FASE 4.4.3). `collections[]` proiettato da Related (non da
// COLLECTION_DETAIL_QUERY) — gated via `"in"` guard. Entrambi proiettano `slug`
// (→ wrap <Link>, M9).
type CollectionDetailModel = NonNullable<COLLECTION_DETAIL_QUERY_RESULT>["models"][number];
// `autoRelatedByCollection` (alias auto, array non-null) — shape identica al campo
// manuale `relatedModels`; usato come tipo card perché non-nullable (il manuale è
// `Array | null`). RelatedModels passa item di questa stessa shape per entrambi i rami.
type RelatedModel = NonNullable<MODEL_DETAIL_QUERY_RESULT>["autoRelatedByCollection"][number];
// Cantiere INCASSI: quarto membro della union. La card si ESTENDE, non si fotocopia
// (regola di progetto: un componente che serve con una variante guadagna un ramo, non
// un gemello). Il discriminante è la SHAPE DEL DATO (`"servesMacros" in model`), non
// una prop `variant`: una prop sarebbe una seconda fonte di verità libera di
// contraddire il dato — `variant="model"` su un corpo darebbe un link rotto senza che
// il compilatore fiati. Con la guardia strutturale quel disallineamento è impossibile.
type ConcealedBodyCard = CONCEALED_BODIES_INDEX_QUERY_RESULT["bodies"][number];
// «Usato da» della scheda corpo. Fino al 31/08/2026 la sua projection era IDENTICA
// a quella di COLLECTION_DETAIL_QUERY.models e riusava quel tipo; da quando la
// collection-detail proietta anche `gallery` le due divergono, ed è voluto: lì c'è
// una collezione di pagina con cui scegliere lo sfondo, qui no. Quindi ha un posto
// suo nella union invece di ricevere una galleria che non saprebbe come usare.
type UsedByModel = NonNullable<CONCEALED_BODY_BY_SLUG_QUERY_RESULT>["usedBy"][number];
type ModelData = CollectionDetailModel | RelatedModel | ConcealedBodyCard | UsedByModel;

/**
 * `sizes` della cover: la larghezza REALE della card nelle tre griglie che usano
 * questo componente — tutte `grid-cols-1 sm:2 md:3 lg:4 xl:5` con `gap-6` (24px),
 * dentro una `.fa-container` con `px-6` di sezione.
 *
 * Non `100vw / 50vw / 33vw`: quei valori ignorano padding e gap, e a 390 chiedono
 * 390 invece di 342 — sopra i 384 del srcSet, quindi next/image sale a 640 e si
 * porta a casa un file quasi doppio per niente. Con la larghezza vera scende a
 * 384. Misurate sul DOM, non dedotte: 342 · 284 · 224 · 226 · 245.
 *
 * Da 1368px in su la card è ferma a (1320 − 96) / 5 = 244,8px perché il
 * contenitore di quelle sezioni è tappato a 1320 (`fa-container max-w-[1320px]`).
 * `used-by.tsx` usa invece la `.fa-container` di default (1200) e sta a 220,8:
 * 245 la sovrastima dell'11%, che non cambia il candidato scelto (256 in
 * entrambi i casi).
 */
const COVER_SIZES = [
  // ⚠️ Sotto 640 le card sono DUE per riga dal 21/09/2026: la larghezza utile è
  // il viewport meno i 48 del contenitore e i 12 del gap, diviso due — 165px a
  // 390. Con il vecchio `calc(100vw - 48px)` il browser avrebbe scaricato il
  // candidato per 342, cioè il doppio dei pixel necessari su ogni card.
  "(max-width: 639px) calc((100vw - 60px) / 2)",
  "(max-width: 767px) calc((100vw - 72px) / 2)",
  "(max-width: 1023px) calc((100vw - 96px) / 3)",
  "(max-width: 1279px) calc((100vw - 120px) / 4)",
  "245px",
].join(", ");

/**
 * Quante card partono SENZA lazy loading. Cinque = una riga piena a `xl`
 * (`xl:grid-cols-5`, la piu' larga delle tre griglie che usano questa card).
 * Sotto quel breakpoint le colonne sono meno e una parte di queste cinque cade
 * sotto la piega: non costa niente, sono comunque le prime che si incontrano
 * scorrendo. Sopra le cinque non si sale — il lazy sulle altre e' cio' che evita
 * 53 richieste in parallelo, che peggiorerebbero le prime invece di aiutarle.
 */
export const CARD_PRIORITARIE = 5;

interface Props {
  model: ModelData;
  locale: ActiveLocale;
  /**
   * Toglie il lazy loading a QUESTA card. Le griglie lo mettono sulle prime
   * cinque, cioe' una riga a `xl`: sopra la piega il lazy le fa aspettare
   * l'IntersectionObserver prima ancora di mettersi in coda, e sono proprio
   * quelle che si vedono comparire a scatti. Il resto resta lazy: 53 richieste
   * in parallelo peggiorerebbero, non migliorerebbero.
   */
  priority?: boolean;
}

/**
 * ModelCard — Server Component, presentational.
 *
 * M9 CHIUSO (FASE 4.4.3): wrap in `<Link>` next-intl object-form →
 * `/modello/[slug]` (IT) / `/model/[slug]` (EN). Hover-lift reintrodotto ora che
 * il click target è reale. Tutte le sorgenti union proiettano `slug`.
 *
 * Cantiere INCASSI: quattro ramificazioni per il corpo a incasso, tutte gated su
 * `isBody` — pill da `servesMacros` invece che da `productLabel`, finiture assenti,
 * destinazione del Link, e la SORGENTE DELLA COVER: `image` sul corpo,
 * `primaryImage` sul modello. La cover è diventata un ramo ad agosto 2026, quando
 * le foto sono arrivate su Sanity: prima era il monogramma su ogni ramo perché non
 * c'era nient'altro da mostrare.
 *
 * TITOLO A DUE RIGHE (lug 2026, richiesta Alma): riga 1 = linea di prodotto, riga 2 =
 * codice, ognuna troncata a UNA riga. Prima il titolo era il campo `name` di Sanity,
 * che è già «linea + codice» concatenato: andava a capo da solo sui codici lunghi,
 * quindi la stessa griglia mescolava card da due e da tre righe (misurato su Yacht:
 * 18 card a due righe, 12 a tre). Il codice compariva anche DUE volte, nella riga mono
 * sopra e dentro il titolo: la riga mono non è stata rimossa, è diventata la riga 2.
 *
 * La riga 1 si ricava togliendo da `name` il codice come SUFFISSO ESATTO
 * (`modelOverline`), non spezzando sul primo spazio — «Boss Wide» resta intero.
 * `collectionTitle` dalle query resta come rete quando il nome non finisce col codice.
 */
export function ModelCard({ model, locale, priority = false }: Props) {
  const tMacro = useTranslations("productCategories");
  const tSubtype = useTranslations("productSubtypes");
  const tDetail = useTranslations("dettaglio");
  const tWater = useTranslations("modello");

  // Ramo corpo a incasso. Tutto ciò che segue è gated su questo booleano: i tre
  // contesti modello esistenti devono rendere markup INVARIATO (verifica byte-diff).
  const isBody = "servesMacros" in model;

  // Cover: stessa guardia strutturale del resto. Niente `.width()` fisso —
  // next/image genera il srcSet dalla sorgente e sceglie in base a `sizes`.
  // L'`alt` viene dall'immagine: è testo scritto apposta su Sanity (obbligatorio
  // sullo schema), non si inventa e non si azzera.
  // Ramo COLLECTION-DETAIL soltanto: lì c'è una collezione di pagina, quindi si
  // può scegliere la composizione con lo sfondo giusto. La guardia è strutturale
  // (`"gallery" in model`) come tutte le altre di questo file — correlati e
  // «usato da» non hanno una collezione univoca e restano sulla primary, ed è la
  // scelta corretta lì, non un ripiego.
  const coverImage = isBody
    ? model.image
    : "gallery" in model
      ? scegliImmagineCard({
          primary: model.primaryImage,
          gallery: model.gallery,
          collectionTitle: model.collectionTitle,
          collectionTitles: model.collectionTitles,
          id: model._id,
        })
      : model.primaryImage;
  const coverUrl = coverImage?.asset ? urlFor(coverImage)?.url() : undefined;
  // L'alt nella lingua della pagina (spec contenuti-per-lingua § A): `altI18n` scritto in
  // Studio, poi la frase composta sul server (`altComposto`, da `conAltComposto`), poi l'alt
  // italiano salvato, che fuori dall'italiano esce con `lang="it"`.
  const composto =
    "altComposto" in model && typeof model.altComposto === "string" ? model.altComposto : null;
  const { alt: coverAlt, lang: coverLang } = risolviAlt(coverImage, locale, composto);
  // Miniatura sfocata: viaggia GIA' dentro il payload (`metadata.lqip`, 30 KB sui
  // 53 prodotti di Boss) e fino a qui non la leggeva nessuno. Usandola il riquadro
  // non e' mai vuoto: mostra una versione sfocata di QUELLA foto e va a fuoco
  // quando arriva. Il tempo di caricamento non cambia, cambia cosa si vede intanto.
  const coverLqip = pickLqip(coverImage)?.lqip ?? undefined;

  // `name` non è proiettato sui corpi → guardia "in". Sui 17 documenti sarebbe
  // comunque un doppione del `code` (docs/incassi-design.md §7): il titolo di un
  // corpo È il suo codice.
  const nameObj = "name" in model ? model.name : null;
  const displayName = nameObj?.[locale] ?? nameObj?.it ?? model.code ?? "";

  // Pill tipologia (FRONT 2): «macro — sottotipo». Entrambe le sorgenti modello della
  // union proiettano i campi nuovi → nessuna guardia "in". Un corpo non ha tipologia:
  // non è un articolo, è la parte che ne regge uno.
  const typeLabel = isBody
    ? null
    : productLabel(model, { macro: tMacro, subtype: tSubtype }, locale);

  // Pill AMBITO del corpo, una per macro servita, ordinate da MACRO_ORDER — la stessa
  // scala del filtro sopra la griglia, così le pill della card e quelle del filtro non
  // possono divergere d'ordine. Un corpo multi-ambiente ne mostra più d'una.
  const macroLabels =
    isBody && model.servesMacros
      ? MACRO_ORDER.filter((m) => model.servesMacros?.includes(m)).map((m) =>
          tMacro.has(m) ? tMacro(m) : m,
        )
      : [];

  // Riga 1 del titolo. Prima fonte: il nome senza il suffisso `code` — così la card
  // dice la LINEA DI PRODOTTO che il nome dichiara («Classy C40.YCWS.M» dentro Yacht
  // resta «Classy»), che è l'informazione che distingue le card fra loro. Rete di
  // sicurezza: `collectionTitle`, campo strutturato proiettato da tutte e tre le
  // sorgenti MODELLO — un corpo a incasso non ce l'ha, non essendo referenziato da
  // nessuna collezione, da cui la guardia "in". Regole in `modelOverline`.
  const collectionTitle = "collectionTitle" in model ? (model.collectionTitle ?? null) : null;
  const overline = modelOverline(displayName, model.code, collectionTitle);

  // Riga 2. `code` è la sola cosa che distingue due card della stessa collezione:
  // per questo resta lui il titolo grande, mentre la collezione fa da soprattitolo.
  // Fallback su displayName per non lasciare la card muta se il codice mancasse.
  const codeLine = model.code ?? displayName;

  // Gocce acqua (Block 2): proiettate solo da COLLECTION_DETAIL_QUERY.models, assenti
  // sul ramo dormiente RelatedModel → guard "in" (come requiredConcealedBody sotto).
  // Icon-only sulla card (la label testuale vive sulla scheda); ordine blu→corallo
  // (freddo→caldo) dal componente condiviso, coerente col listino stampato.
  const waterSupply = "waterSupply" in model ? model.waterSupply : null;
  const showDrops = waterSupply === "cold" || waterSupply === "hot-cold";

  const slug = model.slug ?? "";
  // Destinazione: la scheda corpo vive sotto la cartella statica dei corpi, non su
  // /modello/[slug]. Entrambe le voci sono nella mappa `pathnames` (whitelist:
  // ciò che non è mappato dà 404).
  const href = isBody
    ? ({ pathname: "/collezioni/corpi-a-incasso/[slug]", params: { slug } } as const)
    : ({ pathname: "/modello/[slug]", params: { slug } } as const);

  return (
    <IntentLink
      href={href}
      aria-label={displayName}
      className="group block rounded-lg focus-visible:ring-2 focus-visible:ring-(--fa-navy) focus-visible:ring-offset-4 focus-visible:outline-none"
    >
      <div className="flex flex-col overflow-hidden rounded-lg bg-fa-surface shadow-card transition-[transform,box-shadow] duration-(--dur-standard) group-hover:-translate-y-1 group-hover:shadow-(--shadow-product)">
        {/* Cover 1:1. La foto è quadrata e ha lo sfondo di collezione già composto
            dentro, quindi `object-cover` combacia al pixel: niente `object-contain`,
            niente padding, niente sfondo dietro.
            Il monogramma NON è stato rimosso, è diventato il fallback: 32 modelli
            su 595 non hanno ancora la foto (i 30 yacht, `S60V.HF.ME`, `Spring
            W10.HB`) e devono continuare a leggersi. */}
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{ aspectRatio: "1 / 1", background: "var(--color-fa-card-cover)" }}
        >
          {coverUrl ? (
            <SanityImage
              src={coverUrl}
              alt={coverAlt}
              lang={coverLang}
              fill
              sizes={COVER_SIZES}
              quality={82}
              priority={priority}
              // Guardia obbligatoria: `lqip` e' opzionale nello schema
              // (`lqip?: string`). `placeholder="blur"` con `blurDataURL` vuoto fa
              // esplodere il render, e passare `undefined` a entrambe equivale a
              // non scriverle. Il ramo senza foto non arriva qui: ha il monogramma.
              placeholder={coverLqip ? "blur" : undefined}
              blurDataURL={coverLqip}
              className="object-cover"
            />
          ) : (
            <Image
              src="/brand/fontealta-monogram-gray.png"
              alt=""
              width={300}
              height={300}
              aria-hidden
              className="h-auto w-1/2 opacity-(--fa-opacity-watermark)"
            />
          )}
        </div>

        <div className="px-4 pt-4 pb-4">
          <div className="flex items-start gap-2">
            {/* Titolo a due righe. Le due righe stanno DENTRO `min-w-0 flex-1`, non una
                fuori e una dentro: così condividono la stessa larghezza utile e la
                stessa base di troncamento, e le gocce restano a destra di entrambe.
                `min-w-0` è ciò che permette a `truncate` di funzionare in flex — senza,
                il figlio non scende sotto la sua larghezza di contenuto e il testo
                sborda invece di ellissarsi. */}
            <div className="min-w-0 flex-1">
              {/* Riga 1 — linea di prodotto (o collezione, come rete). Assente sui corpi
                  a incasso, che non appartengono a nessuna collezione: una riga sola. */}
              {overline && (
                <div
                  className="truncate text-micro-1 tracking-4 uppercase"
                  style={{ color: "var(--fa-text-tertiary)" }}
                >
                  {overline}
                </div>
              )}

              {/* Riga 2 — codice, troncato e mai mandato a capo: è il vincolo che rende
                  l'altezza uguale su tutte le card. Niente altezza cablata, l'altezza
                  resta derivata dalle due righe (dottrina PR #73/#76). */}
              {/* 15px sotto `sm`, dove la card è larga 165 invece di 245: la
                  riduzione proporzionale darebbe 11,4, che su un codice prodotto
                  è troppo poco per leggerlo a colpo d'occhio. Il troncamento
                  resta la regola di sempre — è ciò che tiene uguali le altezze —
                  e a 133px di testo utile i codici del catalogo ci stanno: il più
                  lungo misurato è `B60V.HF.ME`. */}
              <h4 className="m-0 mt-1 truncate text-body-1 font-semibold tracking-tight sm:text-body-4">
                {codeLine}
              </h4>
            </div>

            {showDrops && (
              <span
                role="img"
                aria-label={
                  waterSupply === "hot-cold" ? tWater("waterHotCold") : tWater("waterCold")
                }
                className="mt-0.5 shrink-0"
              >
                <WaterSupplyDrops value={waterSupply} />
              </span>
            )}
          </div>

          {/* ⚠️ Le pill di tassonomia NON si rendono sotto `sm` (21/09/2026), come
              le etichette macro della card collezione: è la stessa informazione e
              la stessa ragione. A 165px di card il testo utile è 133, e «Doccia —
              Colonna» ci va a capo due volte: misurato, con le pill la card sta a
              un rapporto di 0,408 contro lo 0,561 di desktop, cioè diventa molto
              più alta che larga invece di essere la card di desktop rimpicciolita.
              Restano foto, codice e finiture, che sono ciò con cui si sceglie. */}
          <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
            {typeLabel && <span className="fa-tag">{typeLabel}</span>}
            {macroLabels.map((label) => (
              <span key={label} className="fa-tag">
                {label}
              </span>
            ))}
          </div>

          {"requiredConcealedBody" in model && model.requiredConcealedBody && (
            <div className="mt-2 hidden flex-wrap gap-2 sm:flex">
              <span className="fa-tag">{tDetail("tagRichiedeCorpoIncasso")}</span>
            </div>
          )}

          {/* I corpi non hanno finiture — il campo non è nemmeno proiettato, quindi
              guardia "in" e non solo un controllo di lunghezza. */}
          {"finishes" in model && model.finishes && model.finishes.length > 0 && (
            // Eccezione voluta alla griglia da 4 px: tre pallini da 26 più «+N» in 133 px stanno
            // solo col gap a 10 (rule `catalogo`, 21/09/2026).
            // eslint-disable-next-line better-tailwindcss/no-restricted-classes
            <div className="fa-finiture-card mt-3 flex flex-wrap items-center gap-2.5 sm:mt-5">
              {model.finishes.map((f) => {
                const finishName = f.name;
                const tooltip = finishName?.[locale] ?? finishName?.it ?? f.code ?? "";
                const swatch = getFinishImageSrc(f.code);
                return (
                  <span
                    key={f._id}
                    className="fa-finish-dot"
                    style={{
                      background: swatch
                        ? `center / cover no-repeat url(${swatch})`
                        : getFinishHex(f.code, f.colorHex),
                    }}
                    title={tooltip}
                  />
                );
              })}
              {/* ⚠️ «+N» SOLO sotto `sm`, dove la card è larga 165 e il testo
                  utile 133: col pallino a 26px e il gap a 10 ce ne stanno TRE
                  (3×26 + 2×10 = 98; il quarto porterebbe a 134, cioè un pixel
                  oltre). I pallini dal quarto in poi li nasconde il CSS, non un
                  ramo in JS: così il markup del server è lo stesso a ogni
                  larghezza e da `sm` in su tornano tutti senza un secondo
                  render. Il numero si scrive qui perché qui si conosce.
                  ⚠️ `aria-hidden`: il conteggio è un'abbreviazione visiva, e chi
                  ascolta ha già l'elenco completo dei pallini, che restano nel
                  DOM col loro `title`. */}
              {model.finishes.length > 3 && (
                <span aria-hidden className="fa-finiture-resto sm:hidden">
                  +{model.finishes.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </IntentLink>
  );
}
