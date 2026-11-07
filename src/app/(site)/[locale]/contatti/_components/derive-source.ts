/**
 * deriveSource — classifica il `referer` di una submission form nella route di
 * origine (lead attribution). Estratto da `actions.ts`: un modulo `"use server"`
 * può esportare SOLO Server Action async, quindi questo helper sincrono (e
 * unit-testabile) vive qui.
 *
 * Esiti: la source della rotta che ospita il modulo (anche nelle sottopagine), "home"
 * per la radice di ogni lingua, il primo segmento della chiave italiana per una rotta che
 * l'elenco non nomina (4/11/2026), "other" per un percorso che non è una rotta del sito,
 * "unknown" se il referer manca o non si legge.
 */
import { ALL_LOCALES, routing, type Locale } from "@/i18n/routing";
import { stripTrailingSlashes } from "@/lib/trailing-slashes";

/**
 * Le rotte col modulo e la source che Zapier riceve (14/10/2026). ⚠️ I valori sono quelli
 * che lo Zap conosce: per le rotte che c'erano già NON si cambiano. `produzione` è nuova:
 * il modulo c'era dal 27/08, ma i suoi invii arrivavano come «other».
 *
 * I segmenti nelle cinque lingue NON si scrivono qui: si leggono da `routing.pathnames`.
 * Fino al 13/10 c'era un'espressione regolare a mano con i soli prefissi `it|en`, e dal
 * 16/09 (cinque lingue) ogni invio da `/de`, `/fr`, `/es` arrivava come «other». Le chiavi
 * sono tipizzate sulla mappa delle rotte: una rotta rinominata è un errore di typecheck.
 * `modello` è nata il 16/10/2026, col modulo nelle schede: prima la rotta dava «other».
 *
 * Dal 4/11/2026 (Marco, c1b) una rotta che qui non c'è prende da sé il primo segmento della sua
 * chiave italiana (`etichettaDellaChiave`): la stessa regola con cui sono nate le etichette di
 * questo elenco, quindi una pagina nuova col modulo non arriva più come «other». L'elenco resta
 * per le etichette scelte a mano, e le fissa: una chiave rinominata non cambia il valore nel foglio.
 * Lo Zap tratta la source come testo (colonna del foglio e riga della mail): un valore nuovo è innocuo.
 */
export const SOURCE_PER_ROTTA = {
  "/collezioni": "collezioni",
  "/finiture": "finiture",
  "/chi-siamo": "chi-siamo",
  "/blog": "blog",
  "/contatti": "contatti",
  "/produzione": "produzione",
  "/modello/[slug]": "modello",
  "/doccia-da-esterno": "doccia-da-esterno",
} as const satisfies Partial<Record<keyof typeof routing.pathnames, string>>;

/** Il primo segmento della chiave italiana: `/referenze/[slug]` → `referenze`. */
const etichettaDellaChiave = (chiave: string): string => chiave.split("/")[1];

/**
 * La chiave della rotta di cui il percorso è un'istanza ESATTA, in una qualunque delle cinque
 * lingue: segmento per segmento, e un segmento dinamico (`[slug]`) vale qualunque valore non vuoto.
 * Nessun prefisso: `/en/outdoor-shower/x` non è una rotta, e dà `undefined` (quindi «other»).
 */
function chiaveDelPercorso(percorso: string): string | undefined {
  const parti = percorso.split("/");
  const voci = Object.entries(routing.pathnames) as [string, string | Record<string, string>][];
  return voci.find(([, voce]) =>
    (typeof voce === "string" ? [voce] : Object.values(voce)).some((seg) => {
      const modello = seg.split("/");
      return (
        modello.length === parti.length &&
        modello.every((m, i) => (m.startsWith("[") ? parti[i] !== "" : m === parti[i]))
      );
    }),
  )?.[0];
}

/**
 * Il percorso appartiene alla rotta, in una qualunque delle cinque lingue (`routing.ts`)?
 *
 * Una rotta statica vale anche per le sue sottopagine (`/blog` comprende i post). Di una rotta
 * dinamica (`/modello/[slug]`, EN `/model/[slug]`) conta il prefisso prima di `/[`, e vale SOLO con
 * qualcosa dopo: `/modello/b40l` sì, `/modello` nudo no. Senza, il referer di una scheda
 * (`/modello/b40l`) non combaciava mai con `/modello/[slug]` e la source era «other».
 */
function combacia(rotta: keyof typeof SOURCE_PER_ROTTA, percorso: string): boolean {
  const voce: string | Record<string, string> = routing.pathnames[rotta];
  return (typeof voce === "string" ? [voce] : Object.values(voce)).some((seg) => {
    const dinamica = seg.indexOf("/[");
    if (dinamica >= 0) return percorso.startsWith(`${seg.slice(0, dinamica)}/`);
    return percorso === seg || percorso.startsWith(`${seg}/`);
  });
}

export function deriveSource(referer: string | null): string {
  if (!referer) return "unknown";
  let path: string;
  try {
    path = new URL(referer).pathname;
  } catch {
    return "unknown";
  }
  // Via il prefisso della lingua, se c'è (`localePrefix: "as-needed"`: l'italiano non ne ha).
  const [, primo, ...resto] = path.split("/");
  const senzaLingua = (ALL_LOCALES as readonly string[]).includes(primo)
    ? `/${resto.join("/")}`
    : path;
  const percorso = stripTrailingSlashes(senzaLingua) || "/";
  if (percorso === "/") return "home";
  for (const [rotta, source] of Object.entries(SOURCE_PER_ROTTA)) {
    if (combacia(rotta as keyof typeof SOURCE_PER_ROTTA, percorso)) return source;
  }
  const chiave = chiaveDelPercorso(percorso);
  return chiave ? etichettaDellaChiave(chiave) : "other";
}

/**
 * La source, dalla pagina che il modulo dichiara e, se non basta, dal referer (14/10/2026).
 *
 * `pagina` è `usePathname()` di `@/i18n/navigation`: con `pathnames` configurati restituisce la
 * chiave INTERNA della rotta, uguale in tutte le lingue, e sulle rotte dinamiche il modello
 * (`/blog/[slug]`, non lo slug). Vale SOLO se è una chiave di `routing.pathnames`: la lista
 * bianca è la mappa delle rotte, quindi un valore inventato non può scegliere la source.
 * Altrimenti si ripiega sul referer, che può mancare per scelta (`Referrer-Policy: no-referrer`,
 * o la policy predefinita cambiata nelle preferenze del browser).
 */
export function risolviSource(pagina: unknown, referer: string | null): string {
  if (typeof pagina === "string" && Object.hasOwn(routing.pathnames, pagina)) {
    if (pagina === "/") return "home";
    for (const [rotta, source] of Object.entries(SOURCE_PER_ROTTA)) {
      if (pagina === rotta || pagina.startsWith(`${rotta}/`)) return source;
    }
    return etichettaDellaChiave(pagina);
  }
  return deriveSource(referer);
}

const isLocale = (v: unknown): v is Locale => (ALL_LOCALES as readonly unknown[]).includes(v);

/**
 * La lingua da passare ad Andrea, perché sappia in che lingua rispondere (13/10/2026).
 *
 * Vale quella che il modulo manda (`useLocale` nel hook), se è una delle cinque. Altrimenti si
 * ripiega sulla lingua del referer: il primo segmento del percorso se è una lingua, l'italiano
 * se non c'è prefisso (`localePrefix: "as-needed"`). Mai un rifiuto: una lingua sbagliata non
 * deve costare un lead.
 */
export function risolviLingua(dichiarata: unknown, referer: string | null): Locale {
  if (isLocale(dichiarata)) return dichiarata;
  try {
    const primo = new URL(referer ?? "").pathname.split("/")[1];
    return isLocale(primo) ? primo : "it";
  } catch {
    return "it";
  }
}
