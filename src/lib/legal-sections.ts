import {
  AZIENDA_CAPITALE,
  AZIENDA_CODICE_FISCALE,
  AZIENDA_INDIRIZZO,
  AZIENDA_ISO_9001,
  AZIENDA_PEC,
  AZIENDA_PIVA,
  AZIENDA_RAGIONE_SOCIALE,
  AZIENDA_REA,
} from "@/lib/azienda";

/**
 * Le sezioni della pagina «Menzioni legali», e come si rende il loro testo.
 *
 * ⚠️ **L'ordine e le ancore stanno nel codice, non nei messaggi.** Nei dizionari le
 * sezioni sono un oggetto indicizzato per id (`legale.sezioni.privacy`): se l'id
 * fosse un valore, sarebbe una stringa identica in cinque lingue e la guardia «nessuna
 * lingua ripete l'inglese» di `parita.test.ts` la segnalerebbe su ogni sezione.
 *
 * **La sezione «societa» è la prima** (26/10/2026, dati dalla visura, testi approvati da
 * Matteo), quindi si apre da sola. Nei messaggi ha solo le etichette e le frasi, con
 * segnaposto fra graffe (`{rea}`, `{pec}`…): i valori li mette la pagina da
 * `@/lib/azienda`, la sorgente unica di footer e JSON-LD. Fino al 26/10 la sezione non
 * c'era, perché i dati mancavano e un segnaposto fra quadre sarebbe finito nel sorgente
 * di ogni pagina: `legale.test.ts` rifiuta ancora le parentesi quadre.
 */
export const LEGAL_SECTIONS = ["societa", "termini", "privacy", "cookie", "ai"] as const;

export type LegalSectionId = (typeof LEGAL_SECTIONS)[number];

/** Un blocco di testo: un'unica chiave, che è il suo tipo. */
export type LegalBlock = { h3: string } | { p: string } | { li: string };

export type LegalSegment =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "email"; text: string }
  | { kind: "url"; text: string };

/**
 * Spezza una riga in segmenti: grassetto (`<b>…</b>`), indirizzi email e `www.…`.
 *
 * ⚠️ **Solo questi tre, e solo così.** Il testo è nostro e scritto nei dizionari:
 * non è HTML da interpretare, e un parser generico sarebbe una superficie in più per
 * niente. Email e indirizzi diventano link perché chi legge un'informativa li deve
 * poter usare, non ricopiare.
 */
export function parseLegalInline(input: string): LegalSegment[] {
  const segments: LegalSegment[] = [];
  const parts = input.split(/(<b>[\s\S]*?<\/b>)/g);
  for (const part of parts) {
    if (part === "") continue;
    const bold = /^<b>([\s\S]*)<\/b>$/.exec(part);
    if (bold) {
      segments.push({ kind: "bold", text: bold[1] });
      continue;
    }
    for (const piece of part.split(/([\w.+-]+@[\w-]+(?:\.[\w-]+)+|www\.[\w-]+(?:\.[\w-]+)+)/g)) {
      if (piece === "") continue;
      if (/^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(piece))
        segments.push({ kind: "email", text: piece });
      else if (/^www\.[\w-]+(?:\.[\w-]+)+$/.test(piece))
        segments.push({ kind: "url", text: piece });
      else segments.push({ kind: "text", text: piece });
    }
  }
  return segments;
}

/**
 * Riempie i segnaposto `{chiave}` di un testo della sezione «societa». Una chiave che
 * non c'è resta com'è, con le graffe: `legal-sections.test.ts` controlla che nella
 * sezione resa non ne resti nessuna, in tutte e cinque le lingue.
 */
export function riempiSegnaposto(testo: string, valori: Readonly<Record<string, string>>): string {
  return testo.replace(/\{(\w+)\}/g, (intero, chiave: string) =>
    Object.hasOwn(valori, chiave) ? valori[chiave] : intero,
  );
}

/** La lingua di `Intl` per le date: l'inglese del sito scrive giorno, mese e anno. */
const LOCALE_DATE: Readonly<Record<string, string>> = { en: "en-GB" };

/** Una data ISO (`2027-06-11`) scritta per esteso nella lingua di chi legge. */
export function dataPerEsteso(iso: string, lingua: string): string {
  return new Intl.DateTimeFormat(LOCALE_DATE[lingua] ?? lingua, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * La data italiana con la preposizione articolata: «all’11 giugno 2027», «al 3 giugno
 * 2027», «al 1° giugno 2027». L'elisione la vogliono i giorni che si leggono con una
 * vocale, 8 e 11.
 */
export function dataConArticoloIt(iso: string): string {
  const giorno = Number(iso.slice(8, 10));
  const [, resto] = dataPerEsteso(iso, "it").split(/^\d+ /);
  if (giorno === 1) return `al 1° ${resto}`;
  return `${giorno === 8 || giorno === 11 ? "all’" : "al "}${giorno} ${resto}`;
}

/** I valori dei segnaposto della sezione «societa», tutti da `@/lib/azienda`. */
export function valoriSocieta(lingua: string): Record<string, string> {
  return {
    ragioneSociale: AZIENDA_RAGIONE_SOCIALE,
    sede: AZIENDA_INDIRIZZO.join(", "),
    piva: AZIENDA_PIVA,
    codiceFiscale: AZIENDA_CODICE_FISCALE,
    rea: AZIENDA_REA,
    capitale: AZIENDA_CAPITALE,
    pec: AZIENDA_PEC,
    norma: AZIENDA_ISO_9001.norma,
    numero: AZIENDA_ISO_9001.numero,
    ente: AZIENDA_ISO_9001.ente,
    settore: AZIENDA_ISO_9001.settoreIaf,
    scadenza: dataPerEsteso(AZIENDA_ISO_9001.scadenza, lingua),
    scadenzaArticolata: dataConArticoloIt(AZIENDA_ISO_9001.scadenza),
  };
}
