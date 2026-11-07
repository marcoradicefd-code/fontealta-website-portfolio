/**
 * Quale immagine mostra la card di un modello dentro una pagina di collezione.
 *
 * IL FATTO. 12 modelli su 595 stanno in più collezioni, e per ognuno esiste su
 * Sanity una composizione PER COLLEZIONE, con lo sfondo di quella collezione: la
 * prima è la `primaryImage`, le altre 23 stanno nella galleria `images`. La card
 * mostrava sempre la primary, quindi 23 posizioni uscivano con lo sfondo di
 * un'altra collezione — su /collezioni/classy WX30.SK con lo sfondo Skinny.
 *
 * LA CHIAVE È LA CODA DELL'ALT, non la posizione. Ogni immagine di galleria porta
 * la sua collezione in fondo all'alt: «… , collezione Boss Wide».
 *
 * ⛔ NIENTE `match` di GROQ. `match` ragiona per TOKEN: sulla pagina Boss il
 * pattern «collezione Boss» combacerebbe anche con «collezione Boss Wide», e la
 * card di Boss prenderebbe lo sfondo di Boss Wide. Stessa trappola per Club e
 * Club Large. Il confronto dev'essere esatto SULLA CODA, e in TypeScript.
 *
 * ⚠️ VIRGOLA, non trattino. Fino al 31/08/2026 gli alt di galleria usavano l'em
 * dash; sono stati bonificati con lo stesso one-shot delle altre due famiglie.
 * Costruire il matcher sul trattino avrebbe significato appoggiarsi a un difetto
 * di dati vietato dalla regola tipografica del progetto.
 *
 * ⚠️ CASE-INSENSITIVE. Il documento ILLE ha `title` «ILLE» e gli alt dicono
 * «Ille». Oggi ILLE compare solo come primary e non in galleria, quindi il
 * fallback mostrerebbe comunque l'immagine giusta — ma la difesa costa nulla e
 * il giorno che ILLE entra in una galleria non fallisce in silenzio.
 */

/** La parte di immagine che serve alla SCELTA. Volutamente minima: la funzione
 *  non sa nulla di Sanity, e i test non hanno bisogno di un asset finto. */
export interface ImmagineConAlt {
  alt?: string | null;
}

export interface ArgomentiScelta<T extends ImmagineConAlt> {
  /** L'immagine principale del modello: è anche il fallback. */
  primary: T | null | undefined;
  /** Le composizioni per le collezioni successive alla prima. `null` sui mono. */
  gallery: readonly T[] | null | undefined;
  /** La collezione della PAGINA, non `collections[0]`. */
  collectionTitle: string | null | undefined;
  /** Titoli delle collezioni nell'ordine del documento, per la controprova. */
  collectionTitles?: readonly (string | null)[] | null;
  /** Solo per il messaggio di avviso. */
  id?: string;
}

const coda = (titolo: string) => `, collezione ${titolo}`.trim().toLowerCase();
const combacia = (alt: string | null | undefined, titolo: string) =>
  (alt ?? "").trim().toLowerCase().endsWith(coda(titolo));

/** In produzione non si stampa nulla: l'avviso serve a chi sviluppa e a chi carica. */
function avvisa(messaggio: string) {
  if (process.env.NODE_ENV !== "production") console.warn(`[card-image] ${messaggio}`);
}

export function scegliImmagineCard<T extends ImmagineConAlt>({
  primary,
  gallery,
  collectionTitle,
  collectionTitles,
  id,
}: ArgomentiScelta<T>): T | null | undefined {
  // Mono-collezione, o pagina senza titolo: non c'è niente da scegliere.
  if (!collectionTitle?.trim() || !gallery?.length) return primary;

  const i = gallery.findIndex((img) => combacia(img?.alt, collectionTitle));
  if (i === -1) {
    // Non è un errore fatale: la primary è comunque un'immagine giusta del
    // prodotto, solo con lo sfondo di un'altra collezione. Ma va detto, perché
    // significa che una coda d'alt non combacia più con un `title`.
    avvisa(
      `nessuna immagine di galleria per «${collectionTitle}»${id ? ` su ${id}` : ""}: uso la primary`,
    );
    return primary;
  }

  // CONTROPROVA POSIZIONALE, non chiave: images[i] corrisponde a collections[i+1]
  // (verificato 23 su 23 sul dato vivo il 31/08/2026). Non la si usa per scegliere
  // — l'ordine di `collections` è modificabile da Studio e cambierebbe le
  // immagini sotto i piedi — ma se coda e posizione smettono di concordare è il
  // segnale che qualcosa a monte si è mosso, e conviene saperlo subito.
  const attesa = collectionTitles?.[i + 1];
  if (attesa && attesa.trim().toLowerCase() !== collectionTitle.trim().toLowerCase()) {
    avvisa(
      `coda dell'alt e posizione discordi${id ? ` su ${id}` : ""}: la pagina è «${collectionTitle}», ` +
        `collections[${i + 1}] è «${attesa}». Uso la coda dell'alt.`,
    );
  }

  return gallery[i];
}
