/**
 * Il file del corpo di una pagina d'uso (`docs/content/pagine-uso/<lingua>/<code>.md`, spec
 * `seo-pagine-contenuto.md`): lettura, conversione in Portable Text e controlli, **puri**. La rete la
 * fa `contenuti-carica.ts --sezione=pagine-uso`, che passa qui i dati letti da Sanity.
 *
 * Il formato (Marco, grill del 3/11/2026, Q14 e Q15):
 *
 *     ---
 *     code: outdoor-shower
 *     kind: use
 *     lang: it
 *     keyword: doccia da esterno
 *     seo.title: …                       (38-48 caratteri, la keyword all'inizio)
 *     seo.description: …                 (140-155, con la keyword, unica sul sito)
 *     collezioni: club, club-large, …    (solo nel file italiano: le collezioni in evidenza, in ordine)
 *     ---
 *
 *     # L'H1, con la keyword, diverso dal title
 *
 *     L'introduzione, testo semplice: le prime 40-60 parole rispondono e nominano Fontealta.
 *
 *     ## Un H2
 *     Paragrafi, con al più un **grassetto** per sezione e [link interni](/collezioni/club).
 *     - elenchi puntati di un livello
 *     ### Un H3, solo dentro un H2
 *     [[foto: image-<hash>-1520x1013-jpg | alt nella lingua del file]]
 *     [[coppia: image-<hash>-1080x1620-jpg | alt || image-<hash>-1080x1620-jpg | alt]]
 *     Una frase che introduce la tabella:
 *     | Criterio | A | B |
 *     | --- | --- | --- |
 *     | … | … | … |
 *
 * I commenti `<!-- … -->` sono note per chi scrive (dove va una foto e cosa mostra, Q13): si tolgono
 * e non arrivano mai su Sanity. Il segnaposto `TESTO` e un commento con «DA VERIFICARE» fermano il
 * file. Tutto ciò che il formato non prevede è un errore.
 */

import { containsKeyword, words, type FaqProblem } from "../../sanity/lib/faq-rules";
import {
  BODY_WORDS,
  checkUseBody,
  claimsAllStainless,
  mentionsMeasure,
  mentionsUsePrice,
  bodyHeadings,
  bodyText,
  type UseBlock,
} from "../../sanity/lib/pagina-uso-rules";
import { LIMITI, tipografia, type LinguaFile } from "./contenuti-md";
import { contentFingerprint, paragraphToBlock, type ResolveRef } from "./faq-md";

export interface UsePageFile {
  code: string;
  kind: string;
  lang: string;
  keyword: string;
  seoTitle: string;
  seoDescription: string;
  /** Gli slug delle collezioni, solo nel file italiano. */
  collections?: string[];
  title: string;
  intro: string;
  body: UseBlock[];
}

const err = (message: string): FaqProblem => ({ level: "error", message });
const warn = (message: string): FaqProblem => ({ level: "warning", message });

const PLACEHOLDER = /(?<![\p{L}\p{N}])TESTO(?![\p{L}\p{N}])/u;
const TO_CHECK = /da verificare/i;
const ASSET = /^image-[a-f0-9]+-\d+x\d+-[a-z]+$/;
const MARKDOWN_LEFT = /\*\*|\]\(|`/;
/**
 * L'intestazione che il file può avere: le chiavi ammesse, quelle obbligatorie e quella che dà il
 * seme delle `_key`. Il corpo è lo stesso per la pagina d'uso e per l'articolo del blog
 * (`articolo-md.ts`, 5/11/2026): cambia solo questa.
 */
export interface HeadProfile {
  keys: ReadonlySet<string>;
  required: readonly string[];
  /** La chiave il cui valore entra nel seme delle `_key` (`code` della pagina, `slug` del post). */
  seed: string;
}

export const USE_PAGE_HEAD: HeadProfile = {
  keys: new Set(["code", "kind", "lang", "keyword", "seo.title", "seo.description", "collezioni"]),
  required: ["code", "kind", "lang", "keyword", "seo.title", "seo.description"],
  seed: "code",
};

/**
 * Ciò che il formato non prevede dentro una riga di testo (verificatore funzionale del 3/11): un
 * segnaposto di foto a metà riga o scritto male, corsivo e barrato, codice, HTML, URL nudi, immagini
 * markdown. Il grassetto `**…**` e i link `[…](…)` li tratta `paragraphToBlock`.
 */
export function inlineLeftovers(t: string): string[] {
  const out: string[] = [];
  // Le classi escludono anche la parentesi che apre: niente backtracking su tante «[» senza chiusura (Sonar).
  const senzaLink = t.replace(/\[[^[\]]*\]\([^()]*\)/g, "");
  if (/\[\[/.test(t))
    out.push("segnaposto di foto dentro il testo: va da solo sulla sua riga, [[foto: …]]");
  if (/\*/.test(senzaLink.replace(/\*\*[^*]*\*\*/g, ""))) out.push("asterisco: niente corsivo");
  if (/(?<![\p{L}\p{N}])_{1,2}[^_\s][^_]*_{1,2}(?![\p{L}\p{N}])/u.test(t))
    out.push("trattino basso: niente corsivo");
  if (/~~/.test(t)) out.push("niente barrato");
  if (/`/.test(t)) out.push("niente codice");
  if (/<[a-zA-Z/!]/.test(t)) out.push("niente HTML");
  if (/!\[/.test(t)) out.push("niente immagini markdown");
  if (/https?:\/\/|www\./i.test(senzaLink)) out.push("niente URL nel testo");
  return out;
}

/** Ciò che una riga di tabella contiene: le celle, senza i bordi. */
const cells = (line: string) =>
  line
    .trim()
    .replace(/(?:^\|)|(?:(?<!\\)\|$)/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

function image(spec: string, line: number, problems: FaqProblem[]) {
  const [asset = "", ...rest] = spec.split("|").map((x) => x.trim());
  const alt = rest.join("|").trim();
  if (!ASSET.test(asset))
    problems.push(err(`riga ${line}: foto da scegliere, «${asset}» non è un asset di Sanity`));
  return { _type: "useImage", asset: { _type: "reference", _ref: asset }, alt };
}

/**
 * Il file letto e convertito. Gli errori di forma hanno il numero di riga; i controlli del corpo
 * (gerarchia, grassetti, tabella, foto) li fa `checkUseBody`, gli stessi dello Studio.
 */
export function parseUsePageFile(
  source: string,
  resolve: ResolveRef,
  profile: HeadProfile = USE_PAGE_HEAD,
): { file?: UsePageFile; head: Record<string, string>; problems: FaqProblem[] } {
  const problems: FaqProblem[] = [];
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!fm) return { head: {}, problems: [err("manca l'intestazione fra due righe ---")] };
  const head: Record<string, string> = {};
  for (const l of fm[1].split("\n")) {
    const i = l.indexOf(":");
    if (i > 0) head[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  for (const k of profile.required)
    if (!head[k]) problems.push(err(`manca «${k}» nell'intestazione`));
  for (const [k, v] of Object.entries(head)) {
    if (!profile.keys.has(k)) problems.push(err(`intestazione: chiave «${k}» sconosciuta`));
    if (/^["'«“].*["'»”]$/.test(v)) problems.push(err(`intestazione: «${k}» fra virgolette`));
    if (PLACEHOLDER.test(v)) problems.push(err(`intestazione: il segnaposto TESTO in «${k}»`));
    for (const l of inlineLeftovers(v)) problems.push(err(`intestazione, «${k}»: ${l}`));
  }

  // I commenti: note per chi scrive. Si tolgono lasciando le righe, così i numeri restano giusti.
  const offset = fm[0].split("\n").length - 1;
  const rest = text.slice(fm[0].length);
  for (const c of rest.matchAll(/<!--([\s\S]*?)-->/g))
    if (TO_CHECK.test(c[1])) problems.push(err(`«DA VERIFICARE» in un commento: ${c[1].trim()}`));
  // Il segno \uE000 (uso privato, non un carattere di controllo) dice dove stava un commento: lì si chiudono gli spazi doppi che ha lasciato.
  const clean = rest
    .replace(/<!--[\s\S]*?-->/g, (c) => `\uE000${c.replace(/[^\n]/g, "")}`)
    .split("\n")
    .map((l) => (l.includes("\uE000") ? l.replace(/\uE000/g, "").replace(/[ \t]{2,}/g, " ") : l))
    .join("\n");
  if (clean.includes("<!--")) problems.push(err("un commento <!-- non si chiude con -->"));

  const lang = head.lang ?? "";
  const code = head[profile.seed] ?? "";
  let title = "";
  const intro: string[] = [];
  const body: UseBlock[] = [];
  let paragraph: string[] = [];
  let paragraphLine = 0;
  let table: Array<{ line: number; text: string }> = [];
  /** Il box «In sintesi» aperto: la riga `[[in sintesi]]` e le voci `- ` che la seguono. */
  let box: { line: number; items: string[] } | undefined;
  const seed = (n: number) => `${lang}:${code}:${n}`;

  const leftovers = (t: string, n: number) => {
    for (const l of inlineLeftovers(t)) problems.push(err(`riga ${n}: ${l}`));
  };
  const inline = (t: string, n: number, extra: Record<string, unknown> = {}) => {
    leftovers(t, n);
    const { block, problems: p } = paragraphToBlock(t, seed(n), resolve);
    problems.push(...p.map((x) => ({ ...x, message: `riga ${n}: ${x.message}` })));
    body.push({ ...block, ...extra } as UseBlock);
  };
  const closeParagraph = () => {
    if (!paragraph.length) return;
    const t = paragraph.join(" ");
    if (!title) problems.push(err(`riga ${paragraphLine}: testo prima dell'H1`));
    if (!body.length) {
      if (MARKDOWN_LEFT.test(t))
        problems.push(
          err(`riga ${paragraphLine}: l'introduzione è testo semplice, senza grassetto né link`),
        );
      leftovers(t, paragraphLine);
      intro.push(t);
    } else inline(t, paragraphLine);
    paragraph = [];
  };
  const closeTable = () => {
    if (!table.length) return;
    const [h, sep, ...rows] = table;
    if (!sep || !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(sep.text))
      problems.push(err(`riga ${h.line}: la tabella vuole la riga di intestazione e poi | --- |`));
    else if (cells(sep.text).length !== cells(h.text).length)
      problems.push(
        err(`riga ${sep.line}: il separatore ha un numero di colonne diverso dall'intestazione`),
      );
    const all = [h, ...rows].flatMap((r) => cells(r.text));
    if (all.some((c) => MARKDOWN_LEFT.test(c) || inlineLeftovers(c).length))
      problems.push(err(`riga ${h.line}: nelle celle della tabella solo testo semplice`));
    body.push({
      _type: "comparisonTable",
      _key: contentFingerprint(seed(h.line)).slice(0, 12),
      header: cells(h.text),
      rows: rows.map((r) => ({
        _type: "tableRow",
        _key: contentFingerprint(seed(r.line)).slice(0, 12),
        cells: cells(r.text),
      })),
    } as UseBlock);
    table = [];
  };

  const closeBox = () => {
    if (!box) return;
    if (!title) problems.push(err(`riga ${box.line}: il box «In sintesi» va dopo l'H1`));
    body.push({
      _type: "keyPoints",
      _key: contentFingerprint(seed(box.line)).slice(0, 12),
      items: box.items,
    } as UseBlock);
    box = undefined;
  };

  clean.split("\n").forEach((raw, i) => {
    const n = offset + i + 1;
    const line = raw.trimEnd();
    if (box) {
      if (/^[-*] \S/.test(line)) {
        const t = line.slice(2).trim();
        if (MARKDOWN_LEFT.test(t))
          problems.push(err(`riga ${n}: nel box «In sintesi» solo testo semplice`));
        leftovers(t, n);
        box.items.push(t);
        return;
      }
      closeBox();
    }
    if (/^\[\[\s*in sintesi\s*\]\]$/i.test(line.trim())) {
      closeParagraph();
      closeTable();
      if (line.trim() !== "[[in sintesi]]")
        problems.push(err(`riga ${n}: il box si scrive [[in sintesi]], minuscolo e senza spazi`));
      box = { line: n, items: [] };
      return;
    }
    if (line.trim().startsWith("|")) {
      closeParagraph();
      table.push({ line: n, text: line.trim() });
      return;
    }
    closeTable();
    if (!line.trim()) return closeParagraph();
    const heading = /^(#{1,6}) +(\S.*)$/.exec(line);
    const figure = /^\[\[\s*(foto|coppia)\s*:(.*)\]\]$/i.exec(line.trim());
    if (heading) {
      closeParagraph();
      const level = heading[1].length;
      const t = heading[2].trim();
      if (level === 1) {
        if (title || body.length || intro.length)
          problems.push(err(`riga ${n}: un solo H1, in cima`));
        if (MARKDOWN_LEFT.test(t)) problems.push(err(`riga ${n}: l'H1 è testo semplice`));
        leftovers(t, n);
        title = t;
      } else if (level <= 3) {
        if (!title) problems.push(err(`riga ${n}: prima l'H1`));
        inline(t, n, { style: `h${level}` });
      } else problems.push(err(`riga ${n}: titoli fino all'H3`));
    } else if (figure) {
      closeParagraph();
      if (!body.length) problems.push(err(`riga ${n}: niente foto nell'introduzione`));
      const key = contentFingerprint(seed(n)).slice(0, 12);
      const kind = figure[1].toLowerCase();
      if (figure[1] !== kind || /^\[\[\s/.test(line.trim()))
        problems.push(
          err(`riga ${n}: il segnaposto si scrive [[${kind}: …]], minuscolo e senza spazi`),
        );
      if (kind === "foto" && figure[2].includes("||"))
        problems.push(err(`riga ${n}: due foto vanno in [[coppia: …]], non in [[foto: …]]`));
      if (kind === "foto")
        body.push({ _type: "figure", _key: key, image: image(figure[2], n, problems) } as UseBlock);
      else {
        const [a = "", b = ""] = figure[2].split("||");
        body.push({
          _type: "figurePair",
          _key: key,
          left: image(a, n, problems),
          right: image(b, n, problems),
        } as UseBlock);
      }
    } else if (/^\s*#/.test(line)) {
      problems.push(err(`riga ${n}: titolo scritto male («# » e il testo)`));
    } else if (/^\s*=+\s*$/.test(line)) {
      problems.push(err(`riga ${n}: niente titoli sottolineati, si scrive «## »`));
    } else if (/^[-*]$/.test(line.trim())) {
      problems.push(err(`riga ${n}: voce d'elenco vuota`));
    } else if (/^\s+[-*] /.test(line)) {
      problems.push(err(`riga ${n}: elenchi di un livello solo, niente rientri`));
    } else if (/^[-*] /.test(line)) {
      closeParagraph();
      if (!body.length) problems.push(err(`riga ${n}: niente elenchi nell'introduzione`));
      inline(line.slice(2).trim(), n, { listItem: "bullet", level: 1 });
    } else if (/^\s+\d{1,2}[.)] /.test(line)) {
      problems.push(err(`riga ${n}: elenchi di un livello solo, niente rientri`));
    } else if (/^\d{1,2}[.)] /.test(line)) {
      closeParagraph();
      if (!body.length) problems.push(err(`riga ${n}: niente elenchi nell'introduzione`));
      inline(line.replace(/^\d{1,2}[.)] /, "").trim(), n, { listItem: "number", level: 1 });
    } else if (/^\s*\+ /.test(line)) {
      problems.push(err(`riga ${n}: elenchi solo con «- »`));
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      problems.push(err(`riga ${n}: niente righe di separazione`));
    } else if (/^(>|```|!\[|<)/.test(line.trim())) {
      problems.push(err(`riga ${n}: forma non ammessa (citazione, codice, immagine o HTML)`));
    } else {
      if (!paragraph.length) paragraphLine = n;
      paragraph.push(line.trim());
    }
  });
  closeBox();
  closeParagraph();
  closeTable();
  if (!title) problems.push(err("manca l'H1"));
  if (PLACEHOLDER.test(clean)) problems.push(err("il segnaposto TESTO è ancora nel file"));

  const collections = head.collezioni
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const c of new Set(collections?.filter((x, i, a) => a.indexOf(x) !== i)))
    problems.push(err(`collezioni: «${c}» due volte`));
  return {
    head,
    file: {
      code,
      kind: head.kind ?? "",
      lang,
      keyword: head.keyword ?? "",
      seoTitle: head["seo.title"] ?? "",
      seoDescription: head["seo.description"] ?? "",
      collections,
      title,
      intro: intro.join("\n\n"),
      body,
    },
    problems,
  };
}

/** Le parole scritte all'inglese britannico che la pagina d'uso scrive all'americano (Marco, 3/11). */
const BRITISH =
  /\b(colour\w*|centre\w*|metres?|litres?|fibre\w*|grey\w*|aluminium|favour\w*|honour\w*|mould\w*|catalogue\w*|programme\w*|storey\w*|enquir\w*|matt|organis\w*|realis\w*|customis\w*|personalis\w*|minimis\w*|optimis\w*|harbour\w*|neighbour\w*|behaviour\w*|travell\w*|jewellery)\b/iu;

/** La prima parola scritta all'inglese britannico, se c'è: la pagina d'uso inglese è americana. */
export const britishWord = (text: string) => BRITISH.exec(text)?.[0];

/**
 * I controlli della pagina intera, oltre a quelli del corpo (checklist `seo-pagine-contenuto.md`):
 * limiti e keyword di title, description, H1, introduzione e H2; parole del corpo; H2 diversi dalle
 * FAQ; description unica; tipografia; prezzi, misure e «tutto inox» fuori dal corpo; inglese
 * americano; le collezioni solo nel file italiano.
 */
export function checkUsePage(
  file: UsePageFile,
  ctx: {
    /** Le domande delle FAQ della stessa pagina e lingua. */
    faqQuestions: readonly string[];
    /** Le description già sul sito nella stessa lingua, delle altre pagine. */
    otherDescriptions: readonly string[];
    /** Gli slug delle collezioni pubblicate. */
    collectionSlugs: ReadonlySet<string>;
  },
): FaqProblem[] {
  const out: FaqProblem[] = [];
  const lang = file.lang as LinguaFile;
  const kw = file.keyword;
  const fold = (s: string) =>
    s
      .toLocaleLowerCase(lang || "it")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  if (file.kind !== "use") out.push(err(`kind «${file.kind}»: un file di pagina d'uso vuole use`));
  for (const p of checkUseBody(file.body))
    out.push({ level: p.level, message: `corpo: ${p.message}` });

  const [tMin, tMax] = LIMITI.metaTitle;
  const [dMin, dMax] = LIMITI.metaDescription;
  const tn = [...file.seoTitle].length;
  const dn = [...file.seoDescription].length;
  if (file.seoTitle && (tn < tMin || tn > tMax))
    out.push(err(`seo.title di ${tn} caratteri, fuori da ${tMin}-${tMax}`));
  if (file.seoDescription && (dn < dMin || dn > dMax))
    out.push(err(`seo.description di ${dn} caratteri, fuori da ${dMin}-${dMax}`));
  if (kw && file.seoTitle && !fold(file.seoTitle).startsWith(fold(kw)))
    out.push(warn(`seo.title non comincia con la keyword «${kw}»`));
  if (kw && file.seoDescription && !containsKeyword(file.seoDescription, kw))
    out.push(warn(`seo.description senza la keyword «${kw}»`));
  if (ctx.otherDescriptions.some((d) => fold(d) === fold(file.seoDescription)))
    out.push(err("seo.description uguale a quella di un'altra pagina"));
  if (kw && file.title && !containsKeyword(file.title, kw))
    out.push(warn(`H1 senza la keyword «${kw}»`));
  if (file.title && fold(file.title) === fold(file.seoTitle))
    out.push(warn("H1 uguale al seo.title: va diverso"));

  const head = words(file.intro).slice(0, 60).join(" ");
  if (words(file.intro).length < 40)
    out.push(warn(`introduzione di ${words(file.intro).length} parole: le prime 40-60 rispondono`));
  if (kw && !containsKeyword(head, kw)) out.push(warn(`keyword «${kw}» non nelle prime 60 parole`));
  if (!containsKeyword(head, "Fontealta")) out.push(warn("Fontealta non nelle prime 60 parole"));

  if (!file.body.some((b) => b._type === "keyPoints"))
    out.push(warn("manca il box «In sintesi» ([[in sintesi]] dopo l'introduzione)"));
  const h2 = bodyHeadings(file.body, "h2");
  if (h2.length < 4 || h2.length > 6)
    out.push(
      warn(
        `${h2.length} H2 (la struttura ne ha 5: confronto, come scegliere, installazione, idee, errori)`,
      ),
    );
  const links = file.body.flatMap((b) =>
    ((b as { markDefs?: Array<{ _type: string }> }).markDefs ?? []).filter(
      (d) => d._type === "internalLink",
    ),
  ).length;
  if (links < 3 || links > 5) out.push(warn(`${links} link interni in uscita (attesi 3-5)`));
  if (kw && h2.length && !h2.some((h) => containsKeyword(h, kw)))
    out.push(warn(`nessun H2 con la keyword «${kw}»`));
  const faq = new Set(ctx.faqQuestions.map(fold));
  for (const h of [...h2, ...bodyHeadings(file.body, "h3")])
    if (faq.has(fold(h))) out.push(err(`il titolo «${h}» è una domanda delle FAQ`));

  const n = words(`${file.intro}\n\n${bodyText(file.body)}`).length;
  if (n < BODY_WORDS.min || n > BODY_WORDS.max)
    out.push(
      warn(`${n} parole fra introduzione e corpo (attese ${BODY_WORDS.min}-${BODY_WORDS.max})`),
    );

  const all = [file.seoTitle, file.seoDescription, file.title, file.intro, bodyText(file.body)];
  const alts = file.body.flatMap((b) => {
    const x = b as { image?: { alt?: string }; left?: { alt?: string }; right?: { alt?: string } };
    return [x.image?.alt, x.left?.alt, x.right?.alt].filter((a): a is string => Boolean(a));
  });
  const intorno = [file.seoTitle, file.seoDescription, file.title, file.intro, ...alts].join("\n");
  if (mentionsUsePrice(intorno))
    out.push(err("un prezzo fuori dal corpo (title, description, H1, introduzione o alt)"));
  if (mentionsMeasure(intorno))
    out.push(err("una misura fuori dal corpo (title, description, H1, introduzione o alt)"));
  if (claimsAllStainless(intorno))
    out.push(err("«tutto inox» fuori dal corpo (title, description, H1, introduzione o alt)"));
  if (lang === "fr")
    for (const t of [...all, ...alts]) {
      const m = /[\p{L}\p{N}][?;!»]|\p{L}:|«\S/u.exec(t);
      if (m) out.push(err(`tipografia: manca lo spazio non separabile in «${m[0]}»`));
    }
  for (const t of new Set([...all, ...alts].flatMap((x) => tipografia(x, lang))))
    out.push(err(`tipografia: ${t}`));
  if (lang === "en")
    for (const t of [...all, ...alts]) {
      const w = britishWord(t);
      if (w) out.push(warn(`inglese britannico «${w}»: la pagina d'uso è in americano`));
    }

  if (file.collections && lang !== "it")
    out.push(err("collezioni: si scrivono solo nel file italiano"));
  for (const s of file.collections ?? [])
    if (!ctx.collectionSlugs.has(s)) out.push(err(`collezioni: nessuna collezione «${s}»`));
  if (lang === "it" && !file.collections?.length)
    out.push(warn("collezioni: nessuna card a video"));
  return out;
}

/**
 * I campi di una lingua come si scrivono su Sanity, e la loro impronta. Nel file italiano entrano
 * anche le collezioni (gli id, nell'ordine): cambiarle nel file, o riordinarle in Studio, cambia
 * l'impronta come un testo (revisore del 3/11).
 */
export function pageFields(file: UsePageFile, collectionIds?: readonly string[]) {
  const fields = {
    title: file.title,
    intro: file.intro,
    body: file.body,
    seoTitle: file.seoTitle,
    seoDescription: file.seoDescription,
    ...(collectionIds ? { collections: [...collectionIds] } : {}),
  };
  return { fields, hash: contentFingerprint(fields) };
}

/** L'impronta della stessa lingua com'è su Sanity, per sapere se in Studio è cambiata. */
export function liveUseFields(doc: Record<string, unknown> | undefined, lang: string) {
  const get = (o: unknown, k: string) =>
    o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined;
  const refs = get(doc, "collections");
  const fields = {
    title: get(get(doc, "title"), lang),
    intro: get(get(doc, "intro"), lang),
    body: get(get(doc, "body"), lang),
    seoTitle: get(get(get(doc, "seo"), "metaTitle"), lang),
    seoDescription: get(get(get(doc, "seo"), "metaDescription"), lang),
    ...(lang === "it" && Array.isArray(refs)
      ? { collections: refs.map((r) => (r as { _ref?: string })._ref) }
      : {}),
  };
  const empty = [
    fields.title,
    fields.intro,
    fields.body,
    fields.seoTitle,
    fields.seoDescription,
  ].every((v) => v == null);
  return { empty, hash: contentFingerprint(fields) };
}
