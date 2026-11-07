import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { SanityImage } from "@/components/media/sanity-image";
import { IntentLink } from "@/components/ui/intent-link";
import type { ActiveLocale } from "@/i18n/routing";
import { ARTICLES_LABEL, getCollectionPresentation, getMonogramVariant } from "@/lib/placeholders";
import { MACRO_ORDER } from "@/lib/product-category";
import { urlFor } from "@/sanity/lib/image";
import type { COLLECTIONS_OVERVIEW_QUERY_RESULT } from "@/sanity/types.gen";

type Collection = COLLECTIONS_OVERVIEW_QUERY_RESULT[number];

/**
 * `sizes` di default = layout della griglia /collezioni
 * (`grid-cols-1 sm:2 lg:3 xl:4`, container max 1200): 1-col 100vw · 2-col 50vw ·
 * 3-col 33vw · 4-col 25vw. La sezione «Collezioni affini» (griglia 3-col, card
 * più larga) passa un `sizes` proprio → srcSet corretto in entrambi i contesti.
 */
// ⚠️ Sotto 640 le card sono DUE per riga dal 21/09/2026, quindi la prima banda
// non è più `100vw`: è il viewport meno i 48 del contenitore e i 12 del gap,
// diviso due (165px a 390). Un `sizes` che dichiara il doppio della larghezza
// vera fa scaricare il candidato sbagliato su ogni card della griglia.
const DEFAULT_SIZES =
  "(max-width: 639px) calc((100vw - 60px) / 2), (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw";

interface CollectionCardProps {
  collection: Collection;
  locale?: ActiveLocale;
  /**
   * Variante della banda inferiore:
   *  - `"default"` (/collezioni overview): nome UPPERCASE + categorie macro
   *    (Lavabo / Doccia / Vasca …) impilate.
   *  - `"featured"` (sezione «Collezioni affini», pagina modello): banda in stile
   *    HOME (FeaturedCollectionCard) — eyebrow «N articoli» sopra il titolo grande
   *    in sentence-case, NESSUNA label categoria.
   *
   * In entrambi i casi il box cover 3/4 crop-free resta identico. Default:
   * `"default"`. La home ha una card propria (FeaturedCollectionCard), non usa
   * questa variante.
   */
  variant?: "default" | "featured";
  /**
   * `sizes` di next/image: deve descrivere la larghezza REALE della card nel
   * layout del chiamante, così next/image sceglie il candidato srcSet giusto
   * (niente upscaling). Default: griglia /collezioni. Le affinità passano il loro.
   */
  sizes?: string;
}

/**
 * CollectionCard — card verticale a due zone come la HOME (FeaturedCollectionCard),
 * in griglia piatta (niente coverflow 3D). Cover (gradient + monogram placeholder,
 * → Sanity coverImage quando popolata, M5) sopra; banda scura sotto. Due varianti
 * (`variant`): `default` (/collezioni) = nome UPPERCASE + categorie macro impilate
 * come nel design `Collezioni.png`; `featured` (affini) = banda stile HOME con
 * eyebrow «N articoli» + titolo grande sentence-case.
 */
export async function CollectionCard({
  collection,
  locale: propLocale,
  variant = "default",
  sizes = DEFAULT_SIZES,
}: CollectionCardProps) {
  const locale = propLocale ?? ((await getLocale()) as ActiveLocale);
  const { code, title, slug, coverImage, productMacros, articleCount } = collection;
  const { gradient } = getCollectionPresentation(code, locale);
  const monogram = getMonogramVariant(code ?? "");
  const isFeatured = variant === "featured";

  /**
   * L'alt della cover: «Collezione X» / «X collection», dalla STESSA chiave che
   * usa la card della home (`home.featuredCardAlt`). Riusarla invece di
   * aggiungerne una nuova non è pigrizia: sono la stessa frase per la stessa
   * immagine su due card diverse, e due chiavi finirebbero per essere tradotte in
   * due modi. ⚠️ La chiave vive nel namespace `home` per ragioni storiche — ci è
   * nata con il carosello — ma NON è specifica della home: chi la ritocca lì la
   * sta ritoccando anche qui.
   */
  const tHome = await getTranslations({ locale, namespace: "home" });
  const coverAlt = tHome("featuredCardAlt", { nome: title ?? code ?? "" });

  // Macro-categorie della collezione, ordinate via la sorgente condivisa
  // `MACRO_ORDER` (la stessa del filtro ModelsSection e dell'hero collezione).
  // La variante `featured` (affini) mostra invece un count + titolo, niente label
  // → derivazione saltata.
  let labels: readonly string[] = [];
  if (!isFeatured) {
    const tCat = await getTranslations({ locale, namespace: "productCategories" });
    // FRONT 2: qui il dato è già aggregato in query (array di macro dei modelli che
    // referenziano la collezione), non per-modello → non si usa `resolveMacro`.
    // Il `filter(Boolean)` regge il caso che il tipo dichiara e i dati oggi non hanno:
    // `array::unique(...productMacro)` inietta un null per ogni modello che non ha il
    // campo, quindi la proiezione è `Array<macro | null>`. Sui 595 attuali il campo c'è
    // ovunque ed è `required` in Studio, ma una scrittura diretta può ancora crearne uno
    // senza — e un null qui diventerebbe una label vuota nella banda della card.
    const present = new Set<string>(
      (productMacros ?? []).filter((m): m is NonNullable<typeof m> => Boolean(m)),
    );
    labels = MACRO_ORDER.filter((c) => present.has(c)).map((c) => tCat(c));
  }

  // Niente `.width()` fisso: next/image genera il srcSet dalla sorgente full-res
  // e sceglie il candidato in base a `sizes`. `quality={82}` limita la doppia
  // compressione sui gradienti scuri, e con `SanityImage` ora la riceve il CDN di
  // Sanity — che e' l'unico a comprimere. Prima l'82 andava all'URL sorgente e
  // Vercel ri-comprimeva a 75 il risultato: la qualita' scelta veniva pagata e
  // buttata, lo stesso doppio giro documentato sull'hero.
  const coverUrl = coverImage?.asset ? urlFor(coverImage)?.url() : undefined;
  // NIENTE sfocatura LQIP qui, ed e' una differenza voluta rispetto a ModelCard.
  // Su /collezioni/[slug] la base64 viaggia GIA' nel payload — `ModelsSection` e'
  // un client component e riceve i modelli come props — quindi usarla non costa
  // trasferimento, e infatti quei 30 KB si pagavano senza prenderne il beneficio.
  // Qui no: misurato sull'HTML servito, /collezioni ha ZERO base64. Le card sono
  // server e nessun confine client porta i metadata al browser. Accendere la
  // sfocatura le farebbe comparire due volte — nello `style` e nelle props del
  // client component — e la pagina passa da 198 a 278 KB, il 40% in piu' su una
  // pagina d'ingresso, per 21 riquadri che con il CDN di Sanity arrivano comunque
  // in ~0,3 s. Il fondo resta il gradiente di collezione, che non e' un buco
  // grigio. Se un giorno lo si vuole, il numero da rimettere sul tavolo e' +67 KB.

  // Banda inferiore. NON ha più altezza fissa: `min-h-[9rem]` è un pavimento, non
  // una misura. Con `h-[9rem]` il blocco reggeva fino a 3 label macro; la quarta
  // (Bidet, FRONT 2) porta il contenuto a 108,6px e la `padding-bottom` dichiarata
  // a 24 veniva schiacciata a 11,4 — misurato sul DOM, non dedotto.
  //
  // ⚠️  `grow` qui, `h-full` sul <Link> e `auto-rows-fr` sulla griglia di
  // `collezioni/page.tsx` sono UNA COSA SOLA: insieme rendono tutte le card della
  // pagina alte uguali, con l'altezza DERIVATA dalla card più piena invece che
  // cablata. Togliendo `auto-rows-fr` di là, di qua le card tornano a due altezze
  // diverse e niente segnala il perché.
  //
  // Blocco testo ancorato in ALTO (nessun `justify-*`: il default `flex-start`
  // basta). Il flusso di lettura è titolo → etichette, compatto, e il gap fra i due
  // è quello TIPOGRAFICO dell'`mt-3` — 12px su ogni card, indipendente da quante
  // etichette ci sono. Lo spazio che avanza sta in fondo alla banda, e varia: una
  // card a una sola etichetta ha più aria sotto di una a quattro. È voluto.
  //
  // ⚠️ Qui c'è stato un `justify-between` (29/07) che ancorava l'ultima etichetta
  // al fondo per allineare due bordi invece di uno. Sulla carta tornava; in
  // produzione no, perché rendeva ELASTICO il gap titolo→etichette: 12px sulle card
  // piene, 66,8 su quelle con una sola etichetta, che si leggeva come un titolo
  // staccato dal suo contenuto. Rimosso su verdetto di Marco. Se qualcuno pensa di
  // rimetterlo, il prezzo è quel numero.
  //
  // La variante `featured` (affini) usa la banda compatta centrata della HOME
  // (count + title). Stringhe complete (niente interpolazione a metà classe, che
  // prettier-tailwind maciulla).
  // ⚠️ SOTTO `sm` il pavimento `min-h-[9rem]` NON c'è, e il padding è 16 invece
  // di 24: a due colonne la card è larga 165px, e 144px di banda minima più 48
  // di padding la renderebbero più alta che larga due volte, cioè l'opposto del
  // rapporto di desktop che questa griglia deve riprodurre (misurato a 1440:
  // card 285×535, rapporto 0,533). Il pavimento serve a pareggiare le card su
  // una riga da quattro, e a due colonne quel lavoro lo fa `auto-rows-fr`.
  const bandClass = isFeatured
    ? "flex shrink-0 flex-col justify-center px-4 py-4 sm:px-6 sm:py-6"
    : "flex shrink-0 grow flex-col px-4 py-4 sm:min-h-[9rem] sm:px-6 sm:py-6";

  return (
    <IntentLink
      href={{ pathname: "/collezioni/[slug]", params: { slug: slug ?? "" } }}
      aria-label={title ?? code ?? ""}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border-(length:--fa-stroke) border-(--fa-stroke-color) bg-fa-ink shadow-card transition-[transform,box-shadow] duration-(--dur-standard) ease-out-expo hover:-translate-y-1 hover:shadow-(--shadow-product) focus-visible:ring-2 focus-visible:ring-fa-navy-bright focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {/* Cover: box a rapporto fisso 3/4 = rapporto della sorgente (896×1200) →
          object-cover NON croppa (audit collection-cover-crop). Sanity image
          quando popolata (M5), else gradient + monogram placeholder.
          ⚠️ IL 3/4 VALE ORA A TUTTE LE LARGHEZZE (21/09/2026, decisione di Marco).
          Sotto `sm` c'era un 4/3 che ritagliava la cover: era la V1 del set 2026,
          nata quando la card stava DA SOLA su una riga e a 3/4 occupava il 72%
          dello schermo. Con due card per riga quel problema non esiste più — la
          card è larga 165px — e il ritaglio non serve: una sola proporzione, su
          tutti gli schermi, è anche ciò che rende la griglia di mobile il
          catalogo di desktop rimpicciolito. */}
      <div
        className="relative aspect-[3/4] w-full overflow-hidden"
        style={coverUrl ? undefined : { background: gradient }}
      >
        {coverUrl ? (
          /* ⚠️ **L'alt sta sulla COVER e su nient'altro, come sulla card della
             home.** La cover è contenuto: è la fotografia con cui la collezione
             si presenta, ed è l'unica immagine di questa card che una ricerca per
             immagini possa voler trovare. Il monogramma qui sotto resta muto
             perché è il SEGNAPOSTO che compare quando la foto manca, e
             descriverlo direbbe «logo Fontealta» al posto di una collezione; il
             gradiente è uno sfondo CSS e un alt non ce l'ha proprio.
             ⚠️ Il link attorno alla card porta già `aria-label` col nome, e per
             uno screen reader vince quello: questo alt serve alle ricerche per
             immagini e ai lettori che non sono persone, non a raddoppiare
             l'annuncio del link. */
          <SanityImage
            src={coverUrl}
            alt={coverAlt}
            fill
            sizes={sizes}
            quality={82}
            className="object-cover transition-transform duration-(--dur-standard) ease-out-expo group-hover:scale-[1.04]"
          />
        ) : (
          <Image
            src={`/brand/fontealta-monogram-${monogram}.png`}
            alt=""
            width={420}
            height={420}
            unoptimized
            aria-hidden
            className="absolute top-1/2 left-1/2 h-auto w-[44%] -translate-x-1/2 -translate-y-1/2 opacity-(--fa-opacity-image) transition-transform duration-(--dur-standard) ease-out-expo group-hover:scale-[1.04]"
          />
        )}
      </div>

      {/* Banda inferiore scura. `featured` (affini): stile HOME — eyebrow «N articoli»
          + titolo grande sentence-case. `default` (/collezioni): nome UPPERCASE +
          categorie impilate. (bandClass sopra.) */}
      <div className={bandClass}>
        {isFeatured ? (
          <>
            {typeof articleCount === "number" && articleCount > 0 && (
              <span className="text-micro-1 font-medium tracking-5 text-fa-text-on-dark uppercase sm:text-micro-2">
                {articleCount} {ARTICLES_LABEL[locale]}
              </span>
            )}
            {/* La taglia sotto `sm` è la riduzione PROPORZIONALE della card: a
                1440 il titolo è 30,4px su una card larga 384 (il 7,9%), e su una
                card da 165 lo stesso 7,9% fa 13 — alzato a 17, che è la taglia
                più piccola a cui un nome di collezione resta un titolo e non una
                didascalia. */}
            <h3 className="mt-2 text-body-4 leading-none font-semibold tracking-tight text-fa-text-on-dark sm:text-display-4">
              {title ?? code ?? ""}
            </h3>
          </>
        ) : (
          <>
            {/* 15px sotto `sm`: a 1440 il titolo è 25,6px su una card da 285 (il
                9,0%), e il 9,0% di 165 fa 14,8. Il nome va a capo — «Corpi a
                incasso» sta su due righe — e NON si tronca: un troncamento qui
                nasconderebbe proprio la parola che distingue una collezione. */}
            <h3 className="m-0 text-body-1 leading-tight font-semibold tracking-tight text-fa-text-on-dark uppercase sm:text-display-2 sm:leading-none">
              {title ?? code ?? ""}
            </h3>
            {/* ⚠️ Le etichette macro NON si rendono sotto `sm` (21/09/2026). A due
                colonne la banda ha ~90px per stare nel rapporto di desktop, e
                quattro righe da 13px ne chiedono 60 da sole: la card diventerebbe
                molto più alta che larga, cioè un'altra forma. Le stesse etichette
                restano sulla pagina della collezione, a un tocco di distanza.
                `hidden sm:block` e non un ramo in JS: il markup del server resta
                uno solo per tutte le larghezze. */}
            {labels.length > 0 && (
              <div className="mt-3 hidden space-y-0.5 sm:block">
                {labels.map((label) => (
                  <p key={label} className="text-caption-1 leading-tight text-fa-text-on-dark">
                    {label}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </IntentLink>
  );
}
