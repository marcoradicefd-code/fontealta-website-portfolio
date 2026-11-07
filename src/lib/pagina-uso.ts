import { ACTIVE_LOCALES, type ActiveLocale } from "@/i18n/routing";

/**
 * Le pagine d'uso (spec `docs/specs/seo-pagine-contenuto.md`, c1b): le regole pure del cancello,
 * usate dalla pagina, dalla sitemap e da `llms.txt`, così le tre non possono dire cose diverse.
 *
 * ⚠️ **Una lingua esiste solo se ha il titolo** (spec § 5): senza, la pagina dà 404, esce da
 * sitemap e `llms.txt`, e nessun'altra lingua la nomina negli hreflang. Nessun ripiego fra lingue:
 * una pagina d'uso non serve l'italiano sotto un indirizzo inglese.
 */

/** La rotta di ogni pagina d'uso, per codice. Una pagina nuova (c2) aggiunge la sua riga. */
export const USE_PAGE_ROUTES = { "outdoor-shower": "/doccia-da-esterno" } as const;
export type UsePageCode = keyof typeof USE_PAGE_ROUTES;

export const isUsePageCode = (code: unknown): code is UsePageCode =>
  typeof code === "string" && Object.hasOwn(USE_PAGE_ROUTES, code);

/** Le lingue attive in cui la pagina ha il titolo, nell'ordine di `ACTIVE_LOCALES`. */
export function lingueConTitolo(titoli: unknown): ActiveLocale[] {
  if (!titoli || typeof titoli !== "object") return [];
  const t = titoli as Partial<Record<string, unknown>>;
  return ACTIVE_LOCALES.filter((l) => typeof t[l] === "string" && (t[l] as string).trim() !== "");
}

/** Il titolo nella lingua, o `null`: il cancello della pagina. */
export function titoloNellaLingua(titoli: unknown, locale: ActiveLocale): string | null {
  if (!lingueConTitolo(titoli).includes(locale)) return null;
  return ((titoli as Record<string, string>)[locale] ?? "").trim();
}

/**
 * L'ordine delle card di una pagina d'uso (Marco, 4/11/2026): prima le collezioni in evidenza,
 * nell'ordine del campo; poi le altre, nell'ordine in cui arrivano (quello del catalogo, `order`,
 * dalla query). Un id in evidenza che non è fra le collezioni (un riferimento rotto, una bozza) si
 * salta; una collezione con lo slug vuoto non diventa una card.
 */
export function ordinaCard<T extends { _id: string; slug?: string | null }>(
  collezioni: readonly T[],
  inEvidenza: readonly (string | null | undefined)[] | null | undefined,
): T[] {
  const conSlug = collezioni.filter((c) => c.slug);
  const perId = new Map(conSlug.map((c) => [c._id, c]));
  const prima = [...new Set(inEvidenza ?? [])].flatMap((id) => {
    const c = id ? perId.get(id) : undefined;
    return c ? [c] : [];
  });
  const scelte = new Set(prima.map((c) => c._id));
  return [...prima, ...conSlug.filter((c) => !scelte.has(c._id))];
}
