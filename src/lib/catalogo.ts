import type { Locale } from "@/i18n/routing";

/**
 * Il catalogo in PDF (PR del catalogo, 19/10/2026).
 *
 * Un solo PDF per tutte le lingue (Q5 del grill del 16/10), con un link fisso e pubblico (Q4):
 * niente firma, niente scadenza, niente allegato. Il nome è senza anno apposta, così il file più
 * leggero o l'edizione nuova si caricano sullo stesso URL. Lo usano l'email di Brevo e il link
 * «Scarica subito il PDF» dopo l'invio, quindi il client lo importa: qui niente di segreto.
 */
export const CATALOGO_URL = "https://media.fontealta.it/catalogo/fontealta-catalogo.pdf";

/**
 * In che lingua arriva l’email del catalogo e in quale lista della
 * newsletter si entra: la decide il PAESE, non la pagina (Q6, Marco). IT → italiano; DE, CH e AT →
 * tedesco; FR → francese; ES → spagnolo; ogni altro Paese, `ZZ` («Altro Paese») compreso, →
 * inglese. Le lingue restano cinque. Svizzera francofona e italiani in Germania sono casi accettati.
 * ⚠️ AT è tedesco dal 19/10/2026 (PR della newsletter, decisione di Marco): con la #268 era inglese,
 * e l'email del catalogo all'Austria cambia lingua con lui, perché la funzione è una sola.
 */
const LINGUA_DEL_PAESE: Partial<Record<string, Locale>> = {
  IT: "it",
  DE: "de",
  CH: "de",
  AT: "de",
  FR: "fr",
  ES: "es",
};

export function linguaDaPaese(paese: string): Locale {
  return LINGUA_DEL_PAESE[paese] ?? "en";
}

/** I template transazionali di Brevo per l'email del catalogo, uno per lingua (Q20). */
export const TEMPLATE_CATALOGO = {
  it: 97,
  en: 98,
  de: 99,
  fr: 100,
  es: 101,
} as const satisfies Record<Locale, number>;
