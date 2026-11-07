import Image from "next/image";

import { SanityImage } from "@/components/media/sanity-image";
import { Link } from "@/i18n/navigation";
import type { ActiveLocale } from "@/i18n/routing";
import { ARTICLES_LABEL, getCollectionPresentation, getMonogramVariant } from "@/lib/placeholders";
import { urlFor } from "@/sanity/lib/image";
import type { COLLECTIONS_OVERVIEW_QUERY_RESULT } from "@/sanity/types.gen";

type Collection = COLLECTIONS_OVERVIEW_QUERY_RESULT[number];

/**
 * FeaturedCollectionCard — variante HOME (solo carousel homepage), distinta da
 * CollectionCard di /collezioni. Card ritratto a due zone: cover (Sanity
 * `coverImage` quando popolata; gradient + monogram placeholder come fallback)
 * sopra, banda scura sotto con "N ARTICOLI / Nome". Bordo sottile.
 */
export function FeaturedCollectionCard({
  collection,
  locale,
  coverAlt,
}: {
  collection: Collection;
  locale: ActiveLocale;
  /**
   * L'alt della cover, gia' localizzato e composto dal server: e' la stessa
   * scelta delle etichette del carosello, e per la stessa ragione — la card
   * finisce dentro un client component come markup gia' reso, e caricare qui un
   * dizionario per una stringa sola sarebbe peso mandato al browser per niente.
   */
  coverAlt: string;
}) {
  const { code, title, slug, articleCount, coverImage } = collection;
  const { gradient } = getCollectionPresentation(code, locale);
  const variant = getMonogramVariant(code ?? "");
  // Niente `.width(800)`: con `SanityImage` la larghezza la mette il loader, una
  // per candidato del srcSet, e sovrascriverebbe comunque questo valore. Lasciarlo
  // scritto direbbe che si serve una 800, che non e' vero.
  const coverUrl = coverImage?.asset ? urlFor(coverImage)?.url() : undefined;

  return (
    <Link
      href={{ pathname: "/collezioni/[slug]", params: { slug: slug ?? "" } }}
      aria-label={title ?? code ?? ""}
      className="group relative flex aspect-[2/3] w-full flex-col overflow-hidden rounded-3xl border-(length:--fa-stroke) border-(--fa-stroke-color) bg-fa-ink shadow-(--shadow-product) focus-visible:ring-2 focus-visible:ring-fa-navy-bright focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {/* Cover: Sanity image quando popolata, else gradient + monogram placeholder */}
      <div
        className="relative flex-1 overflow-hidden"
        style={coverUrl ? undefined : { background: gradient }}
      >
        {coverUrl ? (
          // NIENTE `priority` e niente sfocatura LQIP, ed entrambe sono misure, non
          // dimenticanze. Il carosello sta SOTTO LA PIEGA — `HomeHero` occupa la
          // viewport intera (`lg:min-h-screen`) e in `page.tsx` viene prima — quindi
          // un preload qui competerebbe con l'LCP invece di aiutarlo. E l'HTML
          // servito della home ha ZERO base64: le card sono server e finiscono nel
          // carosello client come markup gia' reso, non come props, quindi i
          // metadata non arrivano al browser e accendere la sfocatura sarebbe peso
          // nuovo. Stessa lettura fatta su CollectionCard, opposta a quella delle
          // card prodotto, dove la base64 c'era gia'.
          /* ⚠️ **L'alt c'e' sulla COVER e su nient'altro, ed e' una scelta.** La
             cover e' contenuto: e' la fotografia con cui la collezione si
             presenta, ed e' l'unica immagine di questa card che un motore o una
             ricerca per immagini possa voler trovare. Il monogramma qui sotto e
             il gradiente restano muti perche' sono decorazione: il monogramma e'
             il fallback che compare quando la foto manca, e descriverlo direbbe
             a chi ascolta «logo Fontealta» al posto di una collezione; il
             gradiente e' uno sfondo CSS e un alt non ce l'ha proprio.
             ⚠️ Il link attorno alla card porta gia' `aria-label` col nome, e per
             uno screen reader vince quello: questo alt serve alle ricerche per
             immagini e ai lettori che non sono persone, non a duplicare
             l'annuncio del link. */
          <SanityImage
            src={coverUrl}
            alt={coverAlt}
            fill
            // 82 come su CollectionCard: e' lo STESSO asset, la cover di collezione,
            // e a 75 i gradienti scuri escono a bande. Con il loader il valore va al
            // CDN di Sanity, che e' l'unico a comprimere: prima non era dichiarato,
            // quindi valeva il default. 82 e' gia' in `images.qualities`.
            quality={82}
            // Le tre soglie sono i TETTI della scala di larghezze del carosello
            // (`featured-carousel.tsx`), misurati sul DOM, non `vw` a occhio: la
            // card ha una larghezza decisa e capped, quindi oltre il tetto della
            // sua banda non cresce. Il vecchio `90vw` a 639px dichiarava 575 per
            // una card di 330, cioè 1,74× di roba chiesta al CDN per niente.
            // I tre valori combaciano coi tre candidati della lista globale
            // (384 · 384 · 384): il tetto alto è 384 e non 400 proprio perché
            // sopra 384 il candidato successivo è 640, cioè 1,6× per nulla.
            sizes="(max-width: 639px) 330px, (max-width: 1023px) 370px, 384px"
            className="object-cover transition-transform duration-(--dur-standard) ease-out-expo group-hover:scale-[1.04]"
          />
        ) : (
          /* Decorativo: `alt=""` PIU' `aria-hidden`, e resta cosi'. E' il
             segnaposto che sostituisce una foto che non c'e'. */
          <Image
            src={`/brand/fontealta-monogram-${variant}.png`}
            alt=""
            width={420}
            height={420}
            aria-hidden
            loading="eager"
            unoptimized
            className="absolute top-1/2 left-1/2 h-auto w-[50%] -translate-x-1/2 -translate-y-1/2 opacity-(--fa-opacity-image) transition-transform duration-(--dur-standard) ease-out-expo group-hover:scale-[1.04]"
          />
        )}
      </div>

      {/* Banda inferiore scura: count + nome */}
      <div className="flex shrink-0 flex-col justify-center px-6 py-6">
        {typeof articleCount === "number" && articleCount > 0 && (
          <span className="text-micro-2 font-medium tracking-5 text-fa-text-on-dark uppercase">
            {articleCount} {ARTICLES_LABEL[locale]}
          </span>
        )}
        <h3 className="mt-2 text-display-4 leading-none font-semibold tracking-tight text-fa-text-on-dark">
          {title ?? code ?? ""}
        </h3>
      </div>
    </Link>
  );
}
