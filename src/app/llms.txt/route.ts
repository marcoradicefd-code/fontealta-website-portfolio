import {
  AZIENDA_EMAIL,
  AZIENDA_INDIRIZZO,
  AZIENDA_NOME,
  AZIENDA_PIVA,
  AZIENDA_RAGIONE_SOCIALE,
  AZIENDA_TELEFONO,
} from "@/lib/azienda";
import { isUsePageCode, titoloNellaLingua, USE_PAGE_ROUTES } from "@/lib/pagina-uso";
import { absoluteUrl } from "@/lib/urls";
import { ACTIVE_LOCALES, type ActiveLocale, type Locale } from "@/i18n/routing";
import { LOCALE_INTL, nomeLingua } from "@/lib/lingue";
import { taglineForLocale, type Tagline } from "@/lib/tagline";
import { client } from "@/sanity/lib/client";
import { LLMS_TXT_QUERY } from "@/sanity/lib/queries";

/**
 * `/llms.txt`: la mappa del sito scritta per un lettore automatico.
 *
 * ⚠️ **Non è un file SEO e non va confuso con la sitemap.** Google Search lo
 * ignora; serve a chi costruisce una risposta a partire dal sito, e la differenza
 * si vede nel contenuto: qui non ci sono `lastmod` né priorità, ci sono **titoli
 * e una riga che dice cos'è ciascuna cosa**. Per questo non entra in sitemap e
 * `robots.ts` non lo dichiara: dichiararlo sarebbe dire a Google di indicizzare
 * un elenco di link che ha già.
 *
 * ⚠️ **Dinamica come `/sitemap.xml`, e per la stessa ragione già pagata a caro
 * prezzo il 9/09.** Una rotta di file servita dal bordo si aggiorna al deploy e
 * non al publish: quattro configurazioni e cinque misure per stabilirlo. Qui la
 * cura si applica subito invece di riscoprirla: `force-dynamic`, `client.fetch`
 * diretto con `cache: "no-store"` e `useCdn: false`.
 *
 * ⚠️ **Nessuna misura e nessun prezzo**, per decisione di Marco: né sul sito né
 * nei dati strutturati, quindi nemmeno qui.
 */
export const dynamic = "force-dynamic";

/**
 * I messaggi di una lingua, caricati come fa `src/i18n/request.ts`.
 *
 * ⚠️ **Import dinamico e non statico**, perché il file deve seguire
 * `ACTIVE_LOCALES` e non un elenco scritto qui: il giorno che il tedesco si
 * accende, la sua sezione compare da sola, senza toccare questa rotta. È lo
 * stesso principio di `availableLanguage` nel JSON-LD e di `localizedUrls`.
 */
async function messaggi(locale: ActiveLocale) {
  return (await import(`../../messages/${locale}.json`)).default as {
    home: { metaDescription: string };
    nav: Record<string, string>;
  };
}

/** Le pagine ferme, con la chiave del loro nome nel dizionario `nav`. */
const STATICHE = [
  { href: "/collezioni", nav: "collezioni" },
  { href: "/produzione", nav: "produzione" },
  { href: "/finiture", nav: "finiture" },
  { href: "/chi-siamo", nav: "chiSiamo" },
  { href: "/contatti", nav: "contatti" },
  { href: "/blog", nav: "blog" },
  { href: "/menzioni-legali", nav: "menzioniLegali" },
] as const;

/**
 * Le due parole che nei messaggi non ci sono: il titolo della sezione delle
 * pagine e la preposizione dell'autore.
 *
 * ⚠️ **`Record<Locale, …>`: tutte e cinque le lingue, anche quelle spente.** Prima era
 * `Record<ActiveLocale, …>`, e accendere una lingua senza le sue due parole era un errore di
 * typecheck; ma con le lingue spente la tabella non poteva nemmeno contenerle, e l'accensione
 * diventava una PR di più file invece di una riga. Adesso sono già tutte qui, e il typecheck
 * vuole comunque ogni lingua. Le altre intestazioni vengono dai messaggi (`nav.collezioni`,
 * `nav.blog`) e seguono la lingua da sé.
 */
const DIZIONARIO: Record<Locale, { pagine: string; di: string }> = {
  it: { pagine: "Pagine", di: "di" },
  en: { pagine: "Pages", di: "by" },
  de: { pagine: "Seiten", di: "von" },
  fr: { pagine: "Pages", di: "par" },
  es: { pagine: "Páginas", di: "de" },
};

/** L'intestazione del blocco lingue, che per forza è multilingue. */
const TITOLO_LINGUE = "Lingue · Languages";

type Lingua = ActiveLocale;

function riga(titolo: string, url: string, coda?: string | null) {
  return coda ? `- [${titolo}](${url}): ${coda}` : `- [${titolo}](${url})`;
}

function data(iso: string | null, lingua: Lingua) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(LOCALE_INTL[lingua], { dateStyle: "long" }).format(
      new Date(iso),
    );
  } catch {
    return null;
  }
}

type Dati = {
  collections: Array<{ title: string | null; slug: string | null; tagline: Tagline }>;
  posts: Array<{
    titolo: Partial<Record<Locale, string | null>> | null;
    slug: string | null;
    publishedAt: string | null;
    autore: string | null;
  }>;
  /** Le pagine d'uso (c1b): il titolo intero, per sapere in quali lingue esistono. */
  usePages?: Array<{ code: string | null; titoli: unknown }>;
};

async function sezione(lingua: Lingua, dati: Dati): Promise<string> {
  const d = DIZIONARIO[lingua];
  const m = await messaggi(lingua);
  const righe: string[] = [`> ${m.home.metaDescription}`, ""];

  righe.push(`## ${m.nav.collezioni}`);
  for (const c of dati.collections) {
    if (!c.slug || !c.title) continue;
    righe.push(
      riga(
        c.title,
        absoluteUrl(lingua, { pathname: "/collezioni/[slug]", params: { slug: c.slug } }),
        // La coda è la tagline DI QUESTA lingua: il file ha una sezione per
        // lingua, e prenderne una sola servirebbe italiano dentro la sezione
        // inglese.
        taglineForLocale(c.tagline, lingua),
      ),
    );
  }
  righe.push("");

  righe.push(`## ${d.pagine}`);
  for (const s of STATICHE) {
    righe.push(riga(m.nav[s.nav] ?? s.nav, absoluteUrl(lingua, s.href)));
  }
  // Le pagine d'uso, col titolo della lingua e solo dove c'è (spec § 5): una lingua senza
  // titolo dà 404, e qui non si offre.
  for (const p of dati.usePages ?? []) {
    const titolo = titoloNellaLingua(p.titoli, lingua);
    if (isUsePageCode(p.code) && titolo)
      righe.push(riga(titolo, absoluteUrl(lingua, USE_PAGE_ROUTES[p.code])));
  }
  righe.push("");

  righe.push(`## ${m.nav.blog}`);
  for (const p of dati.posts) {
    if (!p.slug) continue;
    // Il titolo della lingua, poi l'italiano, poi l'inglese: per italiano e inglese è il
    // `coalesce` che la query faceva prima. ⚠️ Prima la query dava solo `titoloIt` e
    // `titoloEn`, e ogni lingua che non fosse l'italiano prendeva l'INGLESE: acceso il
    // tedesco, la sezione tedesca avrebbe elencato i post coi titoli inglesi.
    const titolo = p.titolo?.[lingua] ?? p.titolo?.it ?? p.titolo?.en;
    if (!titolo) continue;
    const coda = [data(p.publishedAt, lingua), p.autore ? `${d.di} ${p.autore}` : null]
      .filter(Boolean)
      .join(" · ");
    righe.push(
      riga(
        titolo,
        absoluteUrl(lingua, { pathname: "/blog/[slug]", params: { slug: p.slug } }),
        coda,
      ),
    );
  }

  return righe.join("\n");
}

export async function GET() {
  const dati = await client.fetch<Dati>(
    LLMS_TXT_QUERY,
    {},
    {
      // Mai una bozza in un file pubblico: pubblicherebbe l'URL di una pagina che
      // i visitatori non vedono. Stessa scelta della sitemap.
      perspective: "published",
      stega: false,
      useCdn: false,
      cache: "no-store",
    },
  );

  // Nessun `??` che inventa: se la fetch non torna, le liste sono vuote e restano
  // le pagine ferme. Un file parziale è meglio di una rotta in errore, ma resta
  // visibile, perché il conteggio crolla.
  const sicuri: Dati = {
    collections: dati?.collections ?? [],
    posts: dati?.posts ?? [],
    usePages: dati?.usePages ?? [],
  };

  /**
   * ⚠️ **Una sezione per lingua ATTIVA, non due scritte a mano.** Le sezioni si
   * costruiscono iterando `ACTIVE_LOCALES`, e lo stesso vale per il blocco delle
   * lingue in coda: il giorno che il tedesco si accende, il file cresce da solo.
   * L'ordine è quello di `ACTIVE_LOCALES`, cioè l'italiano per primo.
   */
  const sezioni: string[] = [];
  for (const lingua of ACTIVE_LOCALES) {
    if (sezioni.length > 0) sezioni.push("", "---", "");
    sezioni.push(await sezione(lingua, sicuri));
  }

  // L'etichetta di ogni lingua è il suo nome NELLA LINGUA STESSA, presa dai suoi
  // messaggi: «Italiano» dall'italiano, «English» dall'inglese. È come le
  // scriverebbe chi quella lingua la parla, ed è quello che serve a chi sceglie.
  const lingue: string[] = [];
  for (const lingua of ACTIVE_LOCALES) {
    const m = await messaggi(lingua);
    lingue.push(
      `- ${m.nav[`lingua_${lingua}`] ?? nomeLingua(lingua)}: ${absoluteUrl(lingua, "/")}`,
    );
  }

  const corpo = [
    `# ${AZIENDA_NOME}`,
    "",
    ...sezioni,
    "",
    `## ${TITOLO_LINGUE}`,
    ...lingue,
    "",
    "## Contatti · Contact",
    `- ${AZIENDA_RAGIONE_SOCIALE}`,
    `- ${AZIENDA_INDIRIZZO.join(", ")}`,
    `- ${AZIENDA_TELEFONO}`,
    `- ${AZIENDA_EMAIL}`,
    `- P.IVA ${AZIENDA_PIVA}`,
    "",
  ].join("\n");

  return new Response(corpo, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Nessuna cache, coerente con `force-dynamic`: il file segue i publish.
      "Cache-Control": "no-store",
    },
  });
}
