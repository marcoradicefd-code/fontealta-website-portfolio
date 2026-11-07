import { ACTIVE_LOCALES, type ActiveLocale, type Locale } from "@/i18n/routing";
import { urlFor } from "@/sanity/lib/image";

/**
 * Open Graph e Twitter: la parte comune a ogni pagina, in un posto solo.
 *
 * ⚠️ **`openGraph` NON si eredita per campi: si sostituisce per intero.** Next
 * fonde i metadata in modo **shallow**, quindi una pagina che dichiara il proprio
 * `openGraph` cancella quello del layout, `siteName` e `og:locale` compresi. È il
 * motivo per cui esiste `openGraphBase()`: ogni pagina che ha un'immagine sua
 * deve ripartire da lì, non aggiungere un pezzo. Le pagine che non dichiarano
 * niente ereditano quello del layout, ed è corretto.
 *
 * ⚠️ **Perché non sta in `seo.ts`**, dove il perimetro metteva la mappa dei
 * locale: `seo.ts` è importato da `next.config.ts` e caricato da Node prima del
 * bundle, dove l'alias `@/` non esiste. Stessa ragione di `src/lib/urls.ts`,
 * provata in A2.1 con un `MODULE_NOT_FOUND`.
 */

/**
 * `og:locale` vuole la forma `lingua_PAESE`, non il codice a due lettere.
 *
 * Copre **tutte** e cinque le lingue di `ALL_LOCALES`, non solo le due attive:
 * la mappa è una tabella di conversione, non un elenco di ciò che è acceso, e il
 * giorno che DE entra in `ACTIVE_LOCALES` non c'è niente da aggiungere qui.
 * `satisfies` lega la copertura al typecheck: una lingua nuova in `ALL_LOCALES`
 * senza la sua riga è un errore di compilazione.
 *
 * `en_GB` e non `en_US`: il mercato è europeo e il copy inglese è in inglese
 * britannico («colour», «made-to-measure»).
 */
export const OG_LOCALE = {
  it: "it_IT",
  en: "en_GB",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
} as const satisfies Record<Locale, string>;

export const OG_SITE_NAME = "Fontealta";

export type OgImage = {
  url: string;
  width: number;
  height: number;
  alt?: string;
  /** L'alt è già nella lingua della pagina (composto): `conAltOg` lo usa in ogni lingua. */
  altNellaLingua?: boolean;
};

/** Mette un alt già nella lingua della pagina su ogni immagine (spec contenuti-per-lingua § A.5). */
export function conAltNellaLingua(immagini: OgImage[], alt: string): OgImage[] {
  const a = alt.trim();
  return a ? immagini.map((img) => ({ ...img, alt: a, altNellaLingua: true })) : immagini;
}

/**
 * La lingua in cui sono scritti gli `alt` delle immagini su Sanity.
 *
 * ⚠️ `imageWithMeta.alt` è una **stringa sola, non localizzata**, e sui dati è
 * italiana ovunque (verificato il 7/10/2026: 595 modelli, 22 collezioni, 17
 * post, tutti in italiano). Su una pagina in un'altra lingua quell'`alt`
 * descriverebbe l'immagine nella lingua sbagliata, quindi lì vale il titolo.
 */
const LINGUA_DEGLI_ALT: Locale = "it";

/** L'`alt` della sorgente Sanity, se c'è e non è vuoto. */
function altDellaSorgente(source: unknown): { alt?: string } {
  const alt = (source as { alt?: string | null } | null)?.alt?.trim();
  return alt ? { alt } : {};
}

/**
 * `og:image:alt` su ogni immagine (decisione di Marco, 7/10/2026): l'`alt`
 * dell'immagine Sanity se c'è ed è nella lingua della pagina, altrimenti il
 * titolo NUDO della pagina, lo stesso di `og:title`. Next ne ricava anche
 * `twitter:image:alt`.
 *
 * ⚠️ Prima di questa funzione `og:image:alt` mancava su tutte le 245 pagine con
 * un'immagine di condivisione: chi legge l'anteprima con uno screen reader
 * sentiva solo «immagine».
 */
export function conAltOg(immagini: OgImage[], titolo: string, locale: ActiveLocale): OgImage[] {
  return immagini.map(({ altNellaLingua, ...img }) => ({
    ...img,
    alt: (altNellaLingua || locale === LINGUA_DEGLI_ALT) && img.alt ? img.alt : titolo,
  }));
}

/**
 * Il titolo NUDO per `og:title`, cioè senza il suffisso del marchio.
 *
 * ⚠️ **La regola è LOCKED dal 10/09/2026 e confermata il 7/10** (`seo-meta`):
 * il marchio lo porta `og:site_name`. Fonte, la guida webmaster di Facebook:
 * «og:title: The title of your article without any branding such as your site
 * name». Una stringa resta com'è (il template del layout non la tocca, perché
 * qui la si dichiara a mano); `{ absolute }` è la home, che porta il marchio
 * apposta nel proprio titolo e lo tiene.
 */
export function titoloOg(title: unknown): string | undefined {
  if (typeof title === "string") return title;
  if (title && typeof title === "object" && "absolute" in title) {
    const absolute = (title as { absolute?: unknown }).absolute;
    return typeof absolute === "string" ? absolute : undefined;
  }
  return undefined;
}

/** L'immagine di riserva, servita da `public/`. 1200×630, il formato che
 *  Facebook, LinkedIn, WhatsApp e X ritagliano senza toccare nulla. */
export const OG_DEFAULT_IMAGE = {
  url: "/og-default.jpg",
  width: 1200,
  height: 630,
} as const;

/**
 * Il fondo delle bande laterali quando una composizione quadrata viene portata a
 * 1200×630. È `--fa-ink` (#0b1215), scritto qui in esadecimale perché la CDN di
 * Sanity vuole un colore, non una custom property.
 *
 * ⚠️ **Un colore fisso, e non la palette dell'immagine.** Sanity espone
 * `metadata.palette.dominant.background`, che sembra la scelta ovvia: su ILLE
 * vale `#4a6a83`, un azzurro medio, e contro una composizione a fondo scuro
 * disegna due barre CHIARE ai lati, cioè una cornice. Con l'inchiostro del brand
 * le bande spariscono nei quattro angoli scuri di ogni composizione. Guardato sui
 * provini, non dedotto.
 */
const OG_BG = "0b1215";

/** Le dimensioni native stanno nel `_ref` dell'asset, che Sanity codifica come
 *  `image-<id>-<larghezza>x<altezza>-<estensione>`. Si leggono da lì e non da
 *  `metadata.dimensions` perché non tutte le proiezioni del progetto proiettano
 *  i metadata: `coverImage` in `COLLECTION_DETAIL_QUERY` è nudo. */
function dimensioniNative(source: unknown): { larghezza: number; altezza: number } | null {
  const ref = (source as { asset?: { _ref?: string } } | null)?.asset?._ref;
  const m = /-(\d+)x(\d+)-[a-z]+$/.exec(ref ?? "");
  return m ? { larghezza: Number(m[1]), altezza: Number(m[2]) } : null;
}

/**
 * L'immagine di un PRODOTTO portata a 1200×630, **intera**.
 *
 * ⚠️ **Il perimetro diceva `fit=crop`, e sulle composizioni prodotto è
 * sbagliato.** Sono quadrate, con l'articolo che riempie il quadro in verticale:
 * un ritaglio 1200×630 restituisce un **tubo senza testa e senza base**. Provato
 * sul CDN e guardato: su Boss B40L usciva una colonna d'acciaio priva di bocca,
 * base e comando, cioè l'immagine che ogni condivisione di scheda avrebbe
 * mostrato.
 *
 * ⚠️ **`fit("fill")` da solo NON basta, e questa è la parte che si scopre solo
 * misurando l'URL servito.** `@sanity/image-url` calcola comunque un `rect` per
 * soddisfare le proporzioni richieste — sull'HTML usciva
 * `rect=0,730,3072,1613`, cioè la fascia centrale — e il `fill` si limitava a
 * riempire quella. La cura è imporre il rettangolo PIENO: `rect(0,0,w,h)`. Solo
 * allora il `fill` letterboxa l'intero quadrato.
 *
 * Se le dimensioni native non si leggono si torna all'immagine di riserva invece
 * di servire un ritaglio: meglio l'immagine del sito che un prodotto decapitato.
 */
export function ogImageProdotto(source: Parameters<typeof urlFor>[0]): OgImage[] {
  const b = urlFor(source);
  const d = dimensioniNative(source);
  if (!b || !d) return [{ ...OG_DEFAULT_IMAGE }];
  const url = b
    .rect(0, 0, d.larghezza, d.altezza)
    .width(1200)
    .height(630)
    .fit("fill")
    .bg(OG_BG)
    .url();
  return url
    ? [{ url, width: 1200, height: 630, ...altDellaSorgente(source) }]
    : [{ ...OG_DEFAULT_IMAGE }];
}

/**
 * L'immagine di una SCENA (la cover di collezione) portata a 1200×630, **col
 * ritaglio**, che qui è la scelta giusta e non una svista.
 *
 * Le cover sono sfondi decorativi in formato ritratto 896×1200: non hanno una
 * testa e una base da preservare, e letterboxarle intere le ridurrebbe a una
 * striscia larga 470 px dentro un riquadro da 1200, cioè quasi tutto fondo. Il
 * ritaglio centrale mostra il motivo a piena larghezza.
 */
export function ogImageScena(source: Parameters<typeof urlFor>[0]): OgImage[] {
  const url = urlFor(source)?.width(1200).height(630).fit("crop").url();
  return url
    ? [{ url, width: 1200, height: 630, ...altDellaSorgente(source) }]
    : [{ ...OG_DEFAULT_IMAGE }];
}

/**
 * L'immagine di condivisione di un documento con l'alt nella lingua della pagina, se l'immagine ha
 * `altI18n` in quella lingua (4/11/2026, `og:image` della pagina d'uso). Senza, resta l'`alt`
 * italiano, che `conAltOg` usa solo in italiano, e nelle altre lingue il titolo.
 */
export function ogImageScenaNellaLingua(
  source:
    | (Parameters<typeof urlFor>[0] & { altI18n?: Partial<Record<string, unknown>> | null })
    | null
    | undefined,
  locale: ActiveLocale,
): OgImage[] {
  const alt = source?.altI18n?.[locale];
  return conAltNellaLingua(ogImageScena(source), typeof alt === "string" ? alt : "");
}

/**
 * La base da cui ogni `openGraph` di pagina deve ripartire.
 *
 * `alternateLocale` elenca le altre lingue **attive**, non tutte e cinque:
 * dichiarare una traduzione che non esiste manda le anteprime social su pagine
 * che non ci sono, esattamente come per gli hreflang.
 *
 * ⚠️ **`og:url` È il canonical, non un secondo indirizzo.** Arriva già risolto
 * dal chiamante, che lo calcola UNA volta con `absoluteUrl(locale, href)` e lo
 * passa sia a `alternates.canonical` sia qui: due chiamate separate alla stessa
 * funzione sarebbero due stringhe libere di divergere il giorno che una `href`
 * cambia. Chi non dichiara un canonical — `/area-riservata`, e ogni documento
 * con `seo.noIndex` — non passa niente e non emette `og:url`: è un solo cancello
 * per «dove questa pagina dice di stare», non due che possono contraddirsi.
 *
 * ⚠️ **`images` sta NELLA BASE, e ci è finito dopo un difetto vero.** Senza,
 * ogni pagina che dichiarava il proprio `openGraph` senza passare un'immagine
 * restava **senza `og:image`**: dichiarandolo aveva già cancellato quello del
 * layout, riserva compresa. Trovato dalla guardia di A2.9 al primo giro, su
 * `/produzione` e `/blog` in tutte e due le lingue — quattro rotte su
 * trentadue, e nessuna di esse guardata a occhio prima. Chi ha un'immagine sua
 * la mette dopo lo spread e sovrascrive questa.
 */
export function openGraphBase(locale: ActiveLocale, canonico?: string | null) {
  return {
    type: "website" as const,
    siteName: OG_SITE_NAME,
    locale: OG_LOCALE[locale],
    alternateLocale: ACTIVE_LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    images: [{ ...OG_DEFAULT_IMAGE }] as OgImage[],
    // Chiave ASSENTE e non stringa vuota quando il canonical non c'è: la stessa
    // regola di `sameAs` e di `description` sull'azienda. Un `og:url` vuoto
    // dichiara un indirizzo, e quell'indirizzo è il nulla.
    ...(canonico ? { url: canonico } : {}),
  };
}
