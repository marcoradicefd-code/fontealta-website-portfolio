import { ACTIVE_LOCALES, routing } from "@/i18n/routing";

/**
 * Paesi del modulo di contatto (13/10/2026).
 *
 * Il campo chiede il PAESE e non la nazionalità: ad Andrea servono il mercato e la lingua in cui
 * rispondere, non la cittadinanza (minimizzazione, GDPR art. 5.1.c).
 *
 * ⚠️ I nomi si calcolano sul SERVER e arrivano ai moduli come prop. Il modulo della home è nell'HTML
 * servito: se il browser li ricalcolasse col suo `Intl`, un CLDR diverso (Safari) potrebbe scrivere
 * un Paese o un ordine diverso da Node, e React segnalerebbe un errore di idratazione.
 */

/**
 * I 249 codici ISO 3166-1 alpha-2, copiati da `iso3166.tab` del tz database, allineato a ISO/TC 46
 * N1127 del 29/02/2024 (letto il 13/10/2026). Niente `XK`: chi non trova il proprio Paese, come il
 * Kosovo, sceglie «Altro Paese».
 */
// prettier-ignore
export const CODICI_ISO = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "YE", "YT",
  "ZA", "ZM", "ZW",
] as const;

export type CodiceIso = (typeof CODICI_ISO)[number];

/**
 * «Altro Paese». `ZZ` è un codice ISO «user-assigned», quello che CLDR usa per la regione
 * sconosciuta. L'etichetta viene dai messaggi: `Intl` lo chiama «Regione sconosciuta».
 */
export const ALTRO_PAESE = "ZZ";

/** Tutti i valori che il campo accetta: i codici ISO più `ZZ`. */
export const CODICI_PAESE = [...CODICI_ISO, ALTRO_PAESE] as const;

export type CodicePaese = (typeof CODICI_PAESE)[number];

/**
 * In testa al menu, in quest'ordine (Marco, 13/10/2026): i Paesi delle visite reali di Vercel
 * Analytics fra il 21/09 e il 13/10/2026, esclusi quelli con circa una pagina per visitatore, tipici
 * dei bot.
 */
export const PAESI_IN_TESTA = [
  "IT",
  "DE",
  "FR",
  "ES",
  "GB",
  "CH",
  "US",
  "GR",
] as const satisfies readonly CodiceIso[];

export interface Paese {
  codice: CodiceIso;
  nome: string;
}

export interface ElencoPaesi {
  inTesta: Paese[];
  altri: Paese[];
}

/**
 * Il menu dei Paesi nella lingua della pagina: i Paesi in testa nel loro ordine, poi tutti gli altri
 * in ordine alfabetico, senza ripeterli. Un codice che `Intl` non sa nominare mostra il codice,
 * mai una riga vuota. «Altro Paese» lo aggiunge il modulo, con l'etichetta dei messaggi.
 */
export function elencoPaesi(richiesta: string): ElencoPaesi {
  // Difesa, non la cura (20/10/2026): una lingua che non è fra le attive diventa l'italiano. Dal
  // 14/10 una «lingua» inventata dal primo segmento di un indirizzo (`/apple-touch-icon.png`)
  // arrivava qui, e `Intl.DisplayNames` lanciava un RangeError che diventava un 500. La cura sta
  // in `next.config.ts` (`rewriteDopoIFile`): quei percorsi non arrivano più a `[locale]`.
  const locale = (ACTIVE_LOCALES as readonly string[]).includes(richiesta)
    ? richiesta
    : routing.defaultLocale;
  const nomi = new Intl.DisplayNames([locale], { type: "region", fallback: "code" });
  const paese = (codice: CodiceIso): Paese => ({ codice, nome: nomi.of(codice) || codice });
  const inTesta = PAESI_IN_TESTA.map(paese);
  const ordine = new Intl.Collator(locale);
  const altri = CODICI_ISO.filter((c) => !(PAESI_IN_TESTA as readonly string[]).includes(c))
    .map(paese)
    .sort((a, b) => ordine.compare(a.nome, b.nome));
  return { inTesta, altri };
}
