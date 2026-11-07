import type { ActiveLocale, Locale } from "@/i18n/routing";

/**
 * La tagline di una collezione nella lingua chiesta, **senza ripiego**.
 *
 * ⚠️ **Nessun `coalesce` sull'italiano, ed è il punto di tutta la modifica.**
 * La tagline fa tre cose insieme: diventa la `description` della pagina,
 * compare a video come paragrafo dell'hero, ed entra in `llms.txt`. Finché il
 * campo era una stringa sola, compilarlo avrebbe portato **italiano sulle 22
 * pagine inglesi** in tutti e tre i posti, ed è la ragione per cui è rimasto
 * vuoto su 22 collezioni su 22. Un ripiego lo rimetterebbe esattamente lì.
 *
 * È la stessa regola che `risolviSeo` applica ai campi SEO: campo compilato
 * nella lingua vince, vuoto vuol dire che in quella lingua non c'è — e chi sta
 * a valle torna al testo automatico, o non disegna il paragrafo.
 *
 * ⚠️ **Non è `modelDisplayName`**, che invece ripiega sull'italiano e poi sul
 * codice: lì il ripiego è giusto, perché una scheda senza titolo non esiste. Qui
 * la tagline è un ornamento del titolo, e la sua assenza è una forma valida
 * della pagina. Due catene diverse per due cose diverse, ed è deliberato.
 */
export type Tagline = Partial<Record<Locale, string | null>> | null | undefined;

export function taglineForLocale(tagline: Tagline, locale: ActiveLocale): string | null {
  if (!tagline) return null;
  const testo = tagline[locale];
  if (typeof testo !== "string") return null;
  // Gli spazi soli sono il modo tipico in cui un campo «vuoto» non è vuoto:
  // qualcuno apre Studio, batte invio e salva. A valle varrebbe come compilato e
  // disegnerebbe un paragrafo alto una riga senza niente dentro.
  const pulito = testo.trim();
  return pulito === "" ? null : pulito;
}
