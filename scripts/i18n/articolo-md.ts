/**
 * Il file di un articolo del blog (`<cartella>/<lingua>/<slug>.md`, Marco, grill del 5/11/2026,
 * Q13-Q15): lettura, conversione in Portable Text e controlli, **puri**. La rete la fa
 * `contenuti-carica.ts --sezione=post` (`pnpm post:carica`).
 *
 * Il corpo è quello della pagina d'uso (`pagina-uso-md.ts`): H2, H3 dentro un H2, paragrafi, elenchi
 * puntati o numerati, `[[in sintesi]]`, una tabella, `[[foto: image-… | alt]]`, link interni col
 * percorso italiano, commenti tolti. Cambia l'intestazione:
 *
 *     ---
 *     slug: aisi-316-contro-304-parte-1     (il documento: lo slug non cambia)
 *     lang: it
 *     autore: Andrea Farnocchia             (solo controllo: deve essere l'autore del post)
 *     keyword: differenza tra aisi 304 e 316
 *     seo.title: …                          (al più 60 caratteri)
 *     seo.description: …                    (al più 155)
 *     excerpt: …                            (l'estratto della card, al più 160)
 *     sostituisce: …                        (facoltativo, solo nota: il redirect sta nel codice)
 *     copertina.alt: …                      (solo per un post nuovo, in ogni lingua)
 *     copertina: image-…-3840x2160-jpg      (solo per un post nuovo, solo nel file italiano)
 *     categoria: Materia e Acciaio          (idem: il titolo italiano della categoria)
 *     pubblicato: 2026-11-10                (idem: il giorno della pubblicazione, mai nel futuro)
 *     ---
 *
 * L'H1 diventa il titolo del post; i paragrafi prima del primo blocco del corpo sono l'apertura
 * dell'articolo e restano nel corpo, in testa (il post non ha un campo «introduzione»).
 *
 * Un post nuovo (c2, Marco, 5/11/2026): se lo slug non esiste su Sanity, il caricatore lo crea dalle
 * tre chiavi del file italiano e da `copertina.alt` di tutte e cinque le lingue (`checkCreazione`).
 */

import {
  bodyText,
  checkUseBody,
  claimsAllStainless,
  mentionsMeasure,
  mentionsUsePrice,
  type UseBlock,
} from "../../sanity/lib/pagina-uso-rules";
import { routing } from "../../src/i18n/routing";
import { containsKeyword, words, type FaqProblem } from "../../sanity/lib/faq-rules";
import { tipografia, type LinguaFile } from "./contenuti-md";
import { contentFingerprint, paragraphToBlock, type ResolveRef } from "./faq-md";
import { parseUsePageFile, type HeadProfile } from "./pagina-uso-md";

/** Le chiavi che creano un post nuovo: solo nel file italiano (scelte di Marco del 5/11/2026). */
export const CHIAVI_CREAZIONE = ["copertina", "categoria", "pubblicato"] as const;

export const ARTICOLO_HEAD: HeadProfile = {
  keys: new Set([
    "slug",
    "lang",
    "autore",
    "keyword",
    "seo.title",
    "seo.description",
    "excerpt",
    "sostituisce",
    ...CHIAVI_CREAZIONE,
    "copertina.alt",
  ]),
  required: ["slug", "lang", "autore", "keyword", "seo.title", "seo.description", "excerpt"],
  seed: "slug",
};

/** I limiti dei campi del post (Q13): title servito, description, estratto della card. */
export const LIMITI_ARTICOLO = { seoTitle: 60, seoDescription: 155, excerpt: 160 } as const;

export interface ArticoloFile {
  slug: string;
  lang: string;
  autore: string;
  keyword: string;
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  title: string;
  /** Il corpo come si scrive su Sanity: l'apertura in testa, poi il resto. */
  body: UseBlock[];
  /** Il corpo senza l'apertura: è quello che `checkUseBody` controlla (comincia con un H2). */
  corpo: UseBlock[];
  intro: string;
  /** L'alt della copertina in questa lingua: solo per un post nuovo. */
  copertinaAlt?: string;
  /** Le chiavi di creazione scritte nel file (solo quelle presenti). */
  creazione: Partial<Record<(typeof CHIAVI_CREAZIONE)[number], string>>;
}

const err = (message: string): FaqProblem => ({ level: "error", message });
const warn = (message: string): FaqProblem => ({ level: "warning", message });

export function parseArticoloFile(
  source: string,
  resolve: ResolveRef,
): { file?: ArticoloFile; problems: FaqProblem[] } {
  const { file, head, problems } = parseUsePageFile(source, resolve, ARTICOLO_HEAD);
  if (!file) return { problems };
  const apertura = file.intro
    .split("\n\n")
    .filter(Boolean)
    .map((p, i) => {
      const { block, problems: p2 } = paragraphToBlock(
        p,
        `${file.lang}:${file.code}:apertura:${i}`,
        resolve,
      );
      problems.push(...p2);
      return block as UseBlock;
    });
  return {
    file: {
      slug: head.slug ?? "",
      lang: file.lang,
      autore: head.autore ?? "",
      keyword: file.keyword,
      seoTitle: file.seoTitle,
      seoDescription: file.seoDescription,
      excerpt: head.excerpt ?? "",
      title: file.title,
      intro: file.intro,
      corpo: file.body,
      body: [...apertura, ...file.body],
      ...(head["copertina.alt"] ? { copertinaAlt: head["copertina.alt"] } : {}),
      creazione: Object.fromEntries(
        CHIAVI_CREAZIONE.filter((k) => head[k]).map((k) => [k, head[k]]),
      ),
    },
    problems,
  };
}

/** Gli alt delle foto del corpo. */
const alts = (body: readonly UseBlock[]) =>
  body.flatMap((b) => {
    const x = b as { image?: { alt?: string }; left?: { alt?: string }; right?: { alt?: string } };
    return [x.image?.alt, x.left?.alt, x.right?.alt].filter((a): a is string => Boolean(a));
  });

/**
 * I controlli dell'articolo (Q13): il corpo con le regole della pagina d'uso; limiti di title,
 * description ed estratto; keyword nelle prime 100 parole; autore; tipografia; prezzi, misure e
 * «tutto inox» ovunque. L'inglese del blog è britannico, tranne i due post della c2 (pulizia e
 * materiali), in americano per la keyword («faucet»; Marco, 5/11/2026): nessun controllo sulla variante.
 */
export function checkArticolo(
  file: ArticoloFile,
  ctx: {
    /** Il nome dell'autore del post su Sanity. */
    autore?: string;
    /** Le description già sul sito nella stessa lingua, degli altri documenti. */
    otherDescriptions: readonly string[];
  },
): FaqProblem[] {
  const out: FaqProblem[] = [];
  const lang = file.lang as LinguaFile;
  const fold = (s: string) =>
    s
      .toLocaleLowerCase(lang || "it")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  for (const p of checkUseBody(file.corpo))
    out.push({ level: p.level, message: `corpo: ${p.message}` });

  const lunghezze: Array<[string, string, number]> = [
    ["seo.title", file.seoTitle, LIMITI_ARTICOLO.seoTitle],
    ["seo.description", file.seoDescription, LIMITI_ARTICOLO.seoDescription],
    ["excerpt", file.excerpt, LIMITI_ARTICOLO.excerpt],
  ];
  for (const [nome, testo, max] of lunghezze)
    if ([...testo].length > max)
      out.push(err(`${nome} di ${[...testo].length} caratteri, al più ${max}`));
  if (ctx.otherDescriptions.some((d) => fold(d) === fold(file.seoDescription)))
    out.push(err("seo.description uguale a quella di un altro documento"));
  if (ctx.autore !== undefined && fold(ctx.autore) !== fold(file.autore))
    out.push(err(`autore «${file.autore}»: il post è firmato da «${ctx.autore}»`));

  const testo = `${file.intro}\n\n${bodyText(file.corpo)}`;
  if (file.keyword && !containsKeyword(words(testo).slice(0, 100).join(" "), file.keyword))
    out.push(warn(`keyword «${file.keyword}» non nelle prime 100 parole`));
  if (!containsKeyword(words(file.intro).slice(0, 60).join(" "), "Fontealta"))
    out.push(warn("Fontealta non nell'apertura"));

  const tutti = [
    file.title,
    file.seoTitle,
    file.seoDescription,
    file.excerpt,
    file.intro,
    bodyText(file.corpo),
    ...alts(file.corpo),
    ...(file.copertinaAlt ? [file.copertinaAlt] : []),
  ];
  const intero = tutti.join("\n");
  if (mentionsUsePrice(intero)) out.push(err("un prezzo nel testo"));
  if (mentionsMeasure(intero)) out.push(err("una misura nel testo"));
  if (claimsAllStainless(intero)) out.push(err("«tutto inox» nel testo"));
  if (lang === "fr")
    for (const t of tutti) {
      const m = /[\p{L}\p{N}][?;!»]|\p{L}:|«\S/u.exec(t);
      if (m) out.push(err(`tipografia: manca lo spazio non separabile in «${m[0]}»`));
    }
  for (const t of new Set(tutti.flatMap((x) => tipografia(x, lang))))
    out.push(err(`tipografia: ${t}`));
  return out;
}

/** Larghezza e altezza di un asset dal suo id (`image-<hash>-3840x2160-jpg`), o `null`. */
export function dimensioniAsset(id: string): { w: number; h: number } | null {
  const m = /^image-[0-9a-f]+-(\d+)x(\d+)-(?:jpg|jpeg|png|webp)$/.exec(id);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

/** La copertina di un post nuovo (Marco, 5/11/2026): pagina 1120×700, JSON-LD 1200×630, Discover. */
export const COPERTINA = { larghezzaMinima: 1200, rapporto: 16 / 9, tolleranza: 0.01 } as const;

/** Il minimo di `imageWithMeta.alt` nello schema (`Rule.required().min(3)`). */
export const ALT_MINIMO = 3;

/**
 * La copertina di un post nuovo come la vuole lo schema di `post` (6/11/2026, Marco, apertura del
 * revisore del 5/11): `coverImage` è un `imageWithMeta`, con `alt` obbligatorio. Fino alla correzione
 * il caricatore la scriveva `_type: "image"` col solo `altI18n`, e T1 e T2 davano errore in Studio. In
 * `alt` va l'alt italiano, che il sito usa come chiave (`card-image.ts`) e come ripiego; le lingue, it
 * compreso, vanno in `altI18n`, che il sito legge per primo. `scripts/i18n/copertina-schema.test.ts`
 * la confronta con lo schema vero.
 */
export function copertinaNuova(asset: string, altIt: string) {
  return {
    _type: "imageWithMeta",
    asset: { _type: "reference", _ref: asset },
    alt: altIt,
    altI18n: { _type: "localizedStringOptional" },
  };
}

/** `publishedAt` dal giorno del file: mezzogiorno UTC, lo stesso giorno in Italia e negli Stati Uniti. */
export const publishedAtDi = (giorno: string) => `${giorno}T12:00:00Z`;

/**
 * I controlli della creazione di un post nuovo, sui file di tutte le lingue dello stesso slug (scelte
 * di Marco del 5/11/2026): le chiavi di creazione solo nel file italiano; tutte e cinque le lingue
 * nello stesso giro, perché un post creato è subito online; l'alt della copertina in ogni lingua; la
 * copertina orizzontale e larga almeno 1.200 px (avviso se non è 16:9, Google la ritaglia); il giorno
 * di pubblicazione valido e mai nel futuro. Categoria e autore li risolve chi ha il dataset.
 */
export function checkCreazione(
  files: ReadonlyMap<string, ArticoloFile>,
  ctx: { lingue: readonly string[]; oggi: string },
): FaqProblem[] {
  const out: FaqProblem[] = [];
  for (const l of ctx.lingue)
    if (!files.has(l)) out.push(err(`manca il file in ${l} (si crea con tutte le lingue insieme)`));
  for (const [l, f] of files) {
    if (l !== "it" && Object.keys(f.creazione).length)
      out.push(err(`${l}: ${Object.keys(f.creazione).join(", ")} solo nel file italiano`));
    if (!f.copertinaAlt) out.push(err(`${l}: manca «copertina.alt» (serve per creare il post)`));
    else if (l === "it" && [...f.copertinaAlt].length < ALT_MINIMO)
      out.push(
        err(`it: «copertina.alt» di almeno ${ALT_MINIMO} caratteri (è l'alt della copertina)`),
      );
  }
  const it = files.get("it");
  if (!it) return out;
  for (const k of CHIAVI_CREAZIONE)
    if (!it.creazione[k]) out.push(err(`it: manca «${k}» (serve per creare il post)`));

  const copertina = it.creazione.copertina;
  if (copertina) {
    const d = dimensioniAsset(copertina);
    if (!d) out.push(err(`copertina «${copertina}»: non è l'id di un'immagine (image-…-LxA-jpg)`));
    else {
      if (d.w <= d.h) out.push(err(`copertina ${d.w}×${d.h}: deve essere orizzontale`));
      if (d.w < COPERTINA.larghezzaMinima)
        out.push(err(`copertina larga ${d.w} px: almeno ${COPERTINA.larghezzaMinima}`));
      if (d.w > d.h && Math.abs(d.w / d.h - COPERTINA.rapporto) > COPERTINA.tolleranza)
        out.push(warn(`copertina ${d.w}×${d.h}: non è 16:9, Google la ritaglia`));
    }
  }
  const giorno = it.creazione.pubblicato;
  if (giorno) {
    // Un giorno che non esiste (2026-02-30) dà una data diversa, o nessuna: si rilegge e si confronta.
    const t = new Date(publishedAtDi(giorno)).getTime();
    const valido =
      /^\d{4}-\d{2}-\d{2}$/.test(giorno) &&
      !Number.isNaN(t) &&
      new Date(t).toISOString().slice(0, 10) === giorno;
    if (!valido) out.push(err(`pubblicato «${giorno}»: un giorno AAAA-MM-GG`));
    else if (giorno > ctx.oggi)
      out.push(err(`pubblicato ${giorno}: nel futuro (oggi ${ctx.oggi})`));
  }
  return out;
}

/** I campi di una lingua come si scrivono su Sanity, e la loro impronta. */
export function articoloFields(file: ArticoloFile) {
  const fields = {
    title: file.title,
    excerpt: file.excerpt,
    body: file.body,
    seoTitle: file.seoTitle,
    seoDescription: file.seoDescription,
  };
  return { fields, hash: contentFingerprint(fields) };
}

/**
 * Il percorso di un link interno nella lingua della pagina (`/doccia-da-esterno` → `/de/gartendusche`),
 * dalla rotta e dallo slug dell'annotazione: per controllare nel dry-run che risponda 200 (Q12).
 * L'italiano non ha prefisso. È il contrario di `rottaNellaLingua` di `post-link-md.ts`.
 */
export function percorsoNellaLingua(route: string, slug: string | undefined, lang: string): string {
  const nomi = routing.pathnames as Record<string, string | Record<string, string>>;
  const voce = nomi[route];
  const forma = (typeof voce === "string" ? voce : voce?.[lang]) ?? route;
  const resto = forma.replace("[slug]", slug ?? "");
  const prefisso = lang === "it" ? "" : `/${lang}`;
  return resto === "/" ? prefisso || "/" : `${prefisso}${resto}`;
}

/** I link interni del corpo: rotta e documento di ogni annotazione. */
export function linkInterni(body: readonly UseBlock[]): Array<{ route: string; ref?: string }> {
  return body.flatMap((b) =>
    (
      (b as { markDefs?: Array<{ _type: string; route?: string; reference?: { _ref?: string } }> })
        .markDefs ?? []
    )
      .filter((d) => d._type === "internalLink" && typeof d.route === "string")
      .map((d) => ({ route: d.route as string, ref: d.reference?._ref })),
  );
}
