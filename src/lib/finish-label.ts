import type { ActiveLocale, Locale } from "@/i18n/routing";

/**
 * Etichetta di una finitura: «CODICE-Descrizione» (es. «MX-Lucido Supermirror»).
 *
 * Spec cliente 24/07, estesa il 29/07 ai filtri su richiesta di Andrea: «un solo
 * linguaggio ovunque». Prima il formato viveva inline nel selettore della scheda e le
 * pill dei filtri mostravano il solo nome, quindi la stessa finitura si chiamava in due
 * modi a due schermate di distanza.
 *
 * Il codice è SEMPRE maiuscolo e il prefisso si applica DOPO ogni trasformazione. La
 * descrizione arriva VERBATIM da Sanity (M10: `finish.name` è autoritativo) — nessun
 * `sentenceCase`: i nomi finitura sono nomi propri di prodotto, non heading, quindi
 * deroga motivata alla regola no-Title-Case del design system.
 *
 * ⚠️ `.trim()` su entrambi i pezzi: i campi Sanity sono compilati a mano incollando da
 * Excel/listino, e uno spazio iniziale invisibile spezzerebbe il formato in
 * «AB- PVD Nero Spazzolato». È già occorso su AB (it/en) e MB (it).
 *
 * Degrado: senza descrizione resta il solo codice, senza codice resta la sola
 * descrizione — mai un trattino orfano in testa o in coda.
 */
export function composeFinishLabel(
  finish: { code?: string | null; name?: unknown },
  locale: ActiveLocale,
): string {
  // `name` è `localizedString` e il tipo generato non si restringe da solo (M6).
  const name = finish.name as Partial<Record<Locale, string>> | null | undefined;
  const code = finish.code?.trim().toUpperCase() ?? "";
  const description = (name?.[locale] ?? name?.it ?? "").trim();
  return [code, description].filter(Boolean).join("-");
}
