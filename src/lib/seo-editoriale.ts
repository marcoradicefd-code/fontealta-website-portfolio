import type { Metadata } from "next";

import type { ActiveLocale, Locale } from "@/i18n/routing";
import { OG_DEFAULT_IMAGE, type OgImage } from "@/lib/open-graph";

/**
 * La catena che decide title, description, immagine di condivisione e
 * indicizzazione di una pagina, in un posto solo.
 *
 * La regola, per intero: **il campo compilato nella lingua vince; vuoto vuol dire
 * template**. Non c'è ripiego fra lingue, ed è deliberato: un `metaTitle` scritto
 * solo in italiano vale solo per l'italiano, e l'inglese va a template. È la
 * stessa regola del resto del sito, «una lingua è intera o è spenta».
 *
 * ⚠️ **Ha letto due forme per una notte, e non è più necessario.** Fino al
 * 10/09/2026 i dodici post avevano `seo.metaTitle` e `seo.metaDescription` come
 * stringhe italiane, e il risolutore le accettava insieme alla forma per lingua:
 * era l'unico ordine che non rompeva il blog, perché il codice doveva andare in
 * produzione prima che i dati cambiassero forma. Migrati i ventiquattro valori
 * alle 07:01:26Z del 10/09, verificato che non ne resti nessuno in forma stringa
 * su nessun tipo, bozze comprese, il ramo è stato tolto: teneva in piedi un caso
 * che non può più presentarsi, e con sé il concetto di «titolo assoluto».
 */

/** Un campo di testo SEO, per lingua. */
export type TestoSeo = Partial<Record<Locale, string | null>> | null;

export type SeoDocumento = {
  metaTitle?: TestoSeo;
  metaDescription?: TestoSeo;
  noIndex?: boolean | null;
} | null;

/** La stessa forma di `open-graph.ts`, `alt` compreso: la catena lo porta fino alla pagina. */
export type ImmagineOg = OgImage;

export type EsitoSeo = {
  /**
   * Il titolo, **nudo**: nessun « | Fontealta» dentro, perché lo aggiunge
   * `title.template` del layout radice. Chi lo mette in `og:title` lo usa tale e
   * quale, che è la regola del sito: il marchio lo porta `og:site_name`.
   */
  titolo: string;
  description: string;
  immagini: ImmagineOg[];
  noIndex: boolean;
};

type Immagini = {
  /** `seo.ogImage` del documento, già costruita dal chiamante. */
  seo?: ImmagineOg[] | null;
  /** L'immagine propria dell'entità: composizione del prodotto, cover, copertina. */
  entita?: ImmagineOg[] | null;
  /** `siteSettings.defaultSeo.ogImage`, la riserva scelta in Studio. */
  sito?: ImmagineOg[] | null;
};

/** Il testo di un campo nella lingua chiesta, oppure `null` se non c'è. */
function testoPerLingua(valore: TestoSeo | undefined, locale: ActiveLocale): string | null {
  if (valore === null || valore === undefined) return null;
  const t = valore[locale];
  if (typeof t !== "string") return null;
  const pulito = t.trim();
  return pulito.length > 0 ? pulito : null;
}

/**
 * ⚠️ **La prima immagine non nulla vince, e la riserva del sito arriva PRIMA del
 * file.** `defaultSeo.ogImage` è una scelta fatta in Studio; `/og-default.jpg` è
 * il fondo del barile, e resta l'ultimo anello perché una riserva deve esistere
 * sempre, anche quando Sanity non risponde.
 */
function immaginiRisolte(immagini: Immagini | undefined): ImmagineOg[] {
  const catena = [immagini?.seo, immagini?.entita, immagini?.sito];
  for (const candidata of catena) {
    if (candidata && candidata.length > 0) return candidata;
  }
  return [{ ...OG_DEFAULT_IMAGE }];
}

export function risolviSeo({
  seo,
  locale,
  contenutoNellaLingua = true,
  template,
  immagini,
}: {
  seo: SeoDocumento | undefined;
  locale: ActiveLocale;
  /**
   * Il documento ha davvero il contenuto in questa lingua? Per un post è
   * `defined(title[$locale])`, per un modello `defined(name[$locale])`. Chi non
   * lo passa dichiara che la pagina è nella lingua chiesta comunque, il che è
   * vero per collezioni e referenze, dove il titolo è un nome proprio e il resto
   * del testo arriva dai messaggi i18n.
   */
  contenutoNellaLingua?: boolean;
  template: { titolo: string; description: string };
  immagini?: Immagini;
}): EsitoSeo {
  /**
   * ⚠️ **Se il contenuto in questa lingua non c'è, la SEO segue l'italiano.**
   * `coalesce` fa ricadere titolo e testo del documento sull'italiano, quindi la
   * pagina servita **è** italiana: darle una SEO inglese, o peggio un template,
   * significherebbe descrivere in una lingua un contenuto scritto in un'altra.
   *
   * Misurato il 9/09/2026, ed è la ragione per cui questa riga esiste: i 12 post
   * non hanno `title.en` (0 su 12), e senza questa regola le loro pagine inglesi
   * perdevano le description curate a 140-162 caratteri per ricadere sugli
   * excerpt, che vanno da **62 a 242**. Modelli (595 su 595) e corpi (17 su 17)
   * l'inglese ce l'hanno, quindi per loro non cambia niente.
   *
   * Il giorno che un post avrà `title.en`, questa riga smette di scattare per
   * quel post e la sua pagina passa a `seo.en` o al template inglese, da sola.
   */
  const linguaSeo: ActiveLocale = contenutoNellaLingua ? locale : "it";
  const titoloScelto = testoPerLingua(seo?.metaTitle, linguaSeo);
  const descrizioneScelta = testoPerLingua(seo?.metaDescription, linguaSeo);

  return {
    titolo: titoloScelto ?? template.titolo,
    description: descrizioneScelta ?? template.description,
    immagini: immaginiRisolte(immagini),
    // `=== true` e non la verità del valore: il campo non esiste sui documenti
    // non ancora ritoccati, e `undefined` deve valere «indicizzabile».
    noIndex: seo?.noIndex === true,
  };
}

/**
 * Il blocco `alternates` oppure il `robots`, mai tutti e due.
 *
 * ⚠️ **Una pagina esclusa dai motori NON dichiara canonical né hreflang, ed è la
 * forma di `/area-riservata`** (`area-riservata/page.tsx:24`), che è l'unica
 * pagina del sito già fuori dall'indice. Un canonical è un'indicazione su come
 * indicizzare, e metterlo su una pagina che chiede di non essere indicizzata è
 * una contraddizione dichiarata a Google; gli hreflang, che sono reciproci,
 * inviterebbero il motore a raggiungerla dalle altre lingue.
 *
 * `follow: true` e non `noindex, nofollow`: i link in uscita restano legittimi.
 * Non si indicizza la pagina, non si taglia il grafo.
 *
 * Il valore torna come oggetto da spandere, così nel ramo escluso la chiave
 * `alternates` non c'è affatto invece di esserci con dentro `undefined`.
 */
export function indicizzazione(
  noIndex: boolean,
  alternates: Metadata["alternates"],
): Pick<Metadata, "robots"> | Pick<Metadata, "alternates"> {
  return noIndex ? { robots: { index: false, follow: true } } : { alternates };
}
