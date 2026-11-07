/**
 * I file delle FAQ (`docs/content/faq/<lingua>/<code>.md`, spec FAQ § 11): lettura, conversione in
 * Portable Text e controlli, **puri**. La rete la fanno `faq-carica.ts` e `faq-doppie.ts`, che
 * passano qui i documenti letti da Sanity.
 *
 * Il formato: in testa `code`, `kind` e `lang` fra due righe `---`; poi per ogni domanda un `##`
 * col testo, una riga `keyword:`, se serve una riga `approfondisci: <percorso> | <testo>` (dal
 * 4/11/2026) e la risposta, in paragrafi. `**…**` è il grassetto,
 * `[testo](/modello/b40l)` un link interno con la rotta italiana di `routing.pathnames`, un URL
 * assoluto un link esterno. I commenti `<!-- … -->` sono note per chi scrive: si tolgono prima di
 * contare e di convertire, e non arrivano mai su Sanity; uno con «DA VERIFICARE» ferma la sua
 * domanda (Marco, 30/10).
 */

import { createHash } from "node:crypto";

import {
  blocksToText,
  checkAnswer,
  checkDeepDiveLabel,
  duplicateKey,
  FAQ_LINK_ROUTES,
  FAQ_MAX_ITEMS,
  matchLinkRoute,
  words,
  type FaqBlock,
  type FaqLinkRoute,
  type FaqProblem,
} from "../../sanity/lib/faq-rules";
import { deepEqual } from "./publish";

export interface FaqFile {
  code: string;
  kind: string;
  lang: string;
  items: Array<{
    question: string;
    keyword?: string;
    paragraphs: string[];
    /** Le righe `approfondisci:`, col solo valore: al più una (si controlla in `buildFaqFile`). */
    approfondisci: string[];
    /** I commenti della domanda, tolti dal testo. */
    notes: string[];
  }>;
}

/** Il segno che ferma una domanda, nel testo o in un commento. */
const TO_CHECK = /DA VERIFICARE/;

/**
 * Il segnaposto degli scheletri da riempire (seconda ondata, 2/11/2026), in maiuscolo e come
 * parola intera: «la risposta» in un testo vero non lo è. Nei commenti non conta, perché il testo
 * controllato è quello visibile.
 */
const PLACEHOLDER = /(?<![\p{L}\p{N}])RISPOSTA(?![\p{L}\p{N}])/u;

/**
 * Sotto queste parole visibili la risposta è vuota o tagliata, e il file non si carica (Marco,
 * 2/11/2026). Fra questo minimo e quello editoriale di `ANSWER_WORDS` resta un avviso.
 */
export const ANSWER_MIN_LOADABLE = 40;

/** Il file letto. Un formato sbagliato è un errore col numero di riga, non un'eccezione. */
export function parseFaqFile(source: string): { file?: FaqFile; errors: string[] } {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const errors: string[] = [];
  if (lines[0] !== "---") return { errors: ["manca l'intestazione fra due righe ---"] };
  const end = lines.indexOf("---", 1);
  if (end < 0) return { errors: ["l'intestazione non si chiude con ---"] };
  const head = Object.fromEntries(
    lines.slice(1, end).map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  for (const k of ["code", "kind", "lang"])
    if (!head[k]) errors.push(`manca «${k}» nell'intestazione`);

  const items: FaqFile["items"] = [];
  let current: FaqFile["items"][number] | undefined;
  let paragraph: string[] = [];
  let comment: string[] | undefined;
  const closeParagraph = () => {
    if (current && paragraph.length) current.paragraphs.push(paragraph.join(" "));
    paragraph = [];
  };
  lines.slice(end + 1).forEach((raw, i) => {
    const n = end + 2 + i;
    // I commenti, anche su più righe: il testo intorno resta, una riga di solo commento sparisce
    // senza chiudere il paragrafo.
    let line = "";
    let rest = raw;
    while (rest) {
      if (comment) {
        const close = rest.indexOf("-->");
        comment.push(close < 0 ? rest : rest.slice(0, close));
        if (close < 0) break;
        const note = comment.join(" ").trim();
        if (current) current.notes.push(note);
        else if (TO_CHECK.test(note))
          errors.push(`riga ${n}: «DA VERIFICARE» prima della prima domanda`);
        comment = undefined;
        rest = rest.slice(close + 3);
      } else {
        const open = rest.indexOf("<!--");
        if (open < 0) {
          line += rest;
          break;
        }
        line += rest.slice(0, open);
        comment = [];
        rest = rest.slice(open + 4);
      }
    }
    if (raw.trim() && !line.trim()) return;
    // Lo spazio lasciato da un commento in mezzo alla riga; [ \t] e non \s, che toglierebbe U+00A0.
    if (line !== raw) line = line.replace(/[ \t]{2,}/g, " ");
    if (line.startsWith("## ")) {
      closeParagraph();
      current = { question: line.slice(3).trim(), paragraphs: [], approfondisci: [], notes: [] };
      items.push(current);
    } else if (!current) {
      if (line.trim()) errors.push(`riga ${n}: testo prima della prima domanda`);
    } else if (/^keyword:/i.test(line) && current.paragraphs.length === 0 && !paragraph.length) {
      current.keyword = line.slice(line.indexOf(":") + 1).trim();
    } else if (
      /^approfondisci:/i.test(line) &&
      current.paragraphs.length === 0 &&
      !paragraph.length
    ) {
      // Solo i due campi della spec: una risposta che comincia con «Yes: …» resta una risposta.
      current.approfondisci.push(line.slice(line.indexOf(":") + 1).trim());
    } else if (line.trim() === "") {
      closeParagraph();
    } else {
      paragraph.push(line.trim());
    }
  });
  closeParagraph();
  if (comment) errors.push("un commento <!-- non si chiude con -->");
  if (items.length === 0) errors.push("nessuna domanda");
  return { file: { code: head.code, kind: head.kind, lang: head.lang, items }, errors };
}

/** Un id di documento per rotta e slug, se esiste su Sanity. */
export type ResolveRef = (type: string, slug: string) => string | undefined;

const key = (seed: string) => createHash("sha256").update(seed).digest("hex").slice(0, 12);

/**
 * Un paragrafo diventa un blocco: testo, grassetto, link. Le chiavi nascono dal contenuto, così un
 * secondo giro sullo stesso file dà lo stesso documento.
 */
export function paragraphToBlock(
  text: string,
  seed: string,
  resolve: ResolveRef,
): { block: FaqBlock & { _key: string; style: string }; problems: FaqProblem[] } {
  const problems: FaqProblem[] = [];
  const children: Array<{ _type: "span"; _key: string; text: string; marks: string[] }> = [];
  const markDefs: Array<Record<string, unknown> & { _key: string; _type: string }> = [];
  const push = (t: string, marks: string[]) => {
    if (t)
      children.push({ _type: "span", _key: key(`${seed}:s${children.length}`), text: t, marks });
  };
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    push(text.slice(last, m.index), []);
    last = m.index + m[0].length;
    if (m[1] !== undefined) {
      push(m[1], ["strong"]);
      continue;
    }
    const [, , label, href] = m;
    const defKey = key(`${seed}:m${markDefs.length}`);
    if (/^https?:\/\//.test(href)) {
      markDefs.push({ _key: defKey, _type: "link", href });
    } else {
      const hit = matchLinkRoute(href);
      if (!hit) {
        problems.push({
          level: "error",
          message: `link «${href}»: percorso non riconosciuto dai pathnames`,
        });
        push(label, []);
        continue;
      }
      const type = FAQ_LINK_ROUTES[hit.route];
      const ref = type && hit.slug ? resolve(type, hit.slug) : undefined;
      if (type && !ref)
        problems.push({
          level: "error",
          message: `link «${href}»: nessun ${type} con slug «${hit.slug}»`,
        });
      markDefs.push({
        _key: defKey,
        _type: "internalLink",
        route: hit.route,
        ...(ref ? { reference: { _type: "reference", _ref: ref } } : {}),
      });
    }
    // Il grassetto dentro il testo di un link resta grassetto.
    const bold = /^\*\*(.+)\*\*$/.exec(label);
    push(bold ? bold[1] : label, bold ? [defKey, "strong"] : [defKey]);
  }
  push(text.slice(last), []);
  if (/\*\*|\]\(/.test(children.map((c) => c.text).join("")))
    problems.push({
      level: "error",
      message: "markdown rimasto nel testo (un ** o un link non chiuso)",
    });
  return {
    block: { _type: "block", _key: key(`${seed}:b`), style: "normal", children, markDefs },
    problems,
  };
}

/** Un valore senza `_key` né `loadedHash`, con le chiavi degli oggetti in ordine, a ogni livello. */
const strip = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(strip)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v)
            .filter(([k]) => k !== "_key" && k !== "loadedHash")
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([k, x]) => [k, strip(x)]),
        )
      : v;

const sha256 = (v: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(strip(v)))
    .digest("hex");

/** L'impronta di un valore qualunque, senza le chiavi e con gli oggetti in ordine (pagine d'uso, c1a). */
export const contentFingerprint = (v: unknown): string => sha256(v);

/**
 * L'impronta di una domanda: testo, keyword e risposta, senza le chiavi. È quella salvata su Sanity
 * in `loadedHash`, e dice se in Studio qualcuno ha cambiato una domanda dopo il caricamento.
 * ⚠️ Dipende ancora dalle chiavi dei link (i `marks` le citano): per il confronto coi file c'è
 * `textHash`. Questa non si cambia, o le domande già su Sanity sembrerebbero tutte cambiate in Studio.
 */
export function contentHash(item: {
  question: string;
  keyword?: string;
  answer?: unknown;
  deepDive?: unknown;
}): string {
  // `deepDive` (4/11/2026) entra solo se c'è: `JSON.stringify` salta le chiavi `undefined`, quindi
  // l'impronta delle domande senza «Approfondisci», già su Sanity, non cambia.
  return sha256({
    question: item.question,
    keyword: item.keyword ?? null,
    answer: item.answer,
    deepDive: item.deepDive ?? undefined,
  });
}

/**
 * L'impronta del TESTO di una domanda, per `faq:verifica` (2/11/2026). Le chiavi dei markDefs nascono
 * dalla posizione della domanda (il seme `lingua:code:indice`) e i `marks` dei pezzi di testo le
 * citano: con `contentHash` la stessa domanda spostata risultava «diversa». Qui ogni riferimento a un
 * link si sostituisce col contenuto del link (`href`, oppure rotta e referenza), così l'impronta
 * cambia col testo, coi link e coi grassetti, e non con la posizione. I decoratori (`strong`) restano.
 */
export function textHash(item: {
  question: string;
  keyword?: string;
  answer?: unknown;
  deepDive?: unknown;
}): string {
  const answer = Array.isArray(item.answer)
    ? item.answer.map((block: { markDefs?: unknown; children?: unknown }) => {
        const defs = Array.isArray(block?.markDefs)
          ? (block.markDefs as Array<{ _key?: string }>)
          : [];
        const link = new Map(defs.map((d) => [d._key, `link:${JSON.stringify(strip(d))}`]));
        const children = Array.isArray(block?.children)
          ? (block.children as Array<{ marks?: unknown }>).map((c) => ({
              ...c,
              marks: Array.isArray(c.marks)
                ? (c.marks as string[]).map((m) => link.get(m) ?? m)
                : c.marks,
            }))
          : block?.children;
        return { ...block, markDefs: defs.map(strip), children };
      })
    : item.answer;
  return sha256({
    question: item.question,
    keyword: item.keyword ?? null,
    answer,
    deepDive: item.deepDive ?? undefined,
  });
}

/** «Approfondisci» com'è su Sanity: la rotta, il documento se la rotta ha uno slug, il testo. */
export interface DeepDive {
  route: FaqLinkRoute;
  reference?: { _type: "reference"; _ref: string };
  label: string;
}

export interface BuiltItem {
  _type: "faqItem";
  _key: string;
  question: string;
  keyword?: string;
  answer: FaqBlock[];
  deepDive?: DeepDive;
  loadedHash: string;
}

/**
 * La riga `approfondisci: <percorso> | <testo>` (Marco, 4/11/2026): il percorso italiano come nei
 * link del testo, il testo descrittivo nella lingua del file. `self` è la pagina della FAQ:
 * «Approfondisci» non ci punta. Una pagina già linkata nel testo della stessa risposta è un avviso.
 */
export function buildDeepDive(
  lines: readonly string[],
  ctx: {
    lang: string;
    resolve: ResolveRef;
    answer: readonly FaqBlock[];
    self?: { route: FaqLinkRoute; ref?: string } | null;
  },
): { deepDive?: DeepDive; problems: FaqProblem[] } {
  if (lines.length === 0) return { problems: [] };
  if (lines.length > 1)
    return {
      problems: [{ level: "error", message: `${lines.length} righe «approfondisci:», al più una` }],
    };
  const sep = lines[0].indexOf("|");
  const path = (sep < 0 ? lines[0] : lines[0].slice(0, sep)).trim();
  const label = sep < 0 ? "" : lines[0].slice(sep + 1).trim();
  const problems = checkDeepDiveLabel(label, ctx.lang);
  const hit = matchLinkRoute(path);
  if (!hit)
    return {
      problems: [
        ...problems,
        { level: "error", message: `«Approfondisci» «${path}»: percorso non riconosciuto` },
      ],
    };
  const type = FAQ_LINK_ROUTES[hit.route];
  const ref = type && hit.slug ? ctx.resolve(type, hit.slug) : undefined;
  if (type && !ref)
    problems.push({
      level: "error",
      message: `«Approfondisci» «${path}»: nessun ${type} con slug «${hit.slug}»`,
    });
  if (ctx.self && ctx.self.route === hit.route && ctx.self.ref === ref)
    problems.push({ level: "error", message: "«Approfondisci» punta alla pagina stessa" });
  const giaNelTesto = ctx.answer.some((b) =>
    (b.markDefs ?? []).some((d) => {
      const m = d as { _type: string; route?: string; reference?: { _ref?: string } };
      return m._type === "internalLink" && m.route === hit.route && m.reference?._ref === ref;
    }),
  );
  if (giaNelTesto)
    problems.push({
      level: "warning",
      message: `«Approfondisci» «${path}»: la stessa pagina è già linkata nel testo`,
    });
  return {
    deepDive: {
      route: hit.route,
      ...(ref ? { reference: { _type: "reference" as const, _ref: ref } } : {}),
      label,
    },
    problems,
  };
}

export interface FileReport {
  /** `blocked`: la domanda non si scrive (un «DA VERIFICARE»); le altre del file passano. */
  items: Array<{ question: string; words: number; blocked: boolean; problems: FaqProblem[] }>;
  problems: FaqProblem[];
  built: BuiltItem[];
}

/** Il file convertito e controllato: gli elementi da scrivere e i problemi, domanda per domanda. */
export function buildFaqFile(
  file: FaqFile,
  names: readonly string[],
  resolve: ResolveRef,
  /** La pagina della FAQ, per il controllo di «Approfondisci» verso sé stessa. */
  self?: { route: FaqLinkRoute; ref?: string } | null,
): FileReport {
  const problems: FaqProblem[] = [];
  if (file.items.length > FAQ_MAX_ITEMS)
    problems.push({
      level: "error",
      message: `${file.items.length} domande, al massimo ${FAQ_MAX_ITEMS}`,
    });
  const built: BuiltItem[] = [];
  const items = file.items.map((it, qi) => {
    const seed = `${file.lang}:${file.code}:${qi}`;
    const blocks = it.paragraphs.map((p, bi) => paragraphToBlock(p, `${seed}:${bi}`, resolve));
    const answer = blocks.map((b) => b.block);
    const dd = buildDeepDive(it.approfondisci, { lang: file.lang, resolve, answer, self });
    const itemProblems = [
      ...blocks.flatMap((b) => b.problems),
      ...dd.problems,
      ...checkAnswer({ question: it.question, keyword: it.keyword, answer }, names),
    ];
    if (!it.keyword) itemProblems.push({ level: "warning", message: "manca la riga keyword:" });
    // Errori e non avvisi: un segnaposto o una risposta monca non devono arrivare su Sanity.
    const text = blocksToText(answer);
    const count = words(text).length;
    if (PLACEHOLDER.test(text))
      itemProblems.push({ level: "error", message: "il segnaposto RISPOSTA è ancora nel testo" });
    if (count < ANSWER_MIN_LOADABLE)
      itemProblems.push({
        level: "error",
        message: `${count} parole: sotto le ${ANSWER_MIN_LOADABLE} la risposta è vuota o tagliata`,
      });
    const checks = [...it.notes, ...it.paragraphs].filter((t) => TO_CHECK.test(t));
    for (const c of checks)
      itemProblems.push({ level: "error", message: `${c}: la domanda non si carica` });
    const blocked = checks.length > 0;
    const item = {
      question: it.question,
      keyword: it.keyword,
      answer,
      ...(dd.deepDive ? { deepDive: dd.deepDive } : {}),
    };
    if (!blocked)
      built.push({
        _type: "faqItem",
        _key: key(`${seed}:q`),
        ...item,
        loadedHash: contentHash(item),
      });
    return {
      question: it.question,
      words: count,
      blocked,
      problems: itemProblems,
    };
  });
  return { items, problems, built };
}

/** Le domande di una pagina per il confronto dei doppioni: `page` è l'id del documento. */
export interface DupPage {
  label: string;
  page: string;
  /** Il titolo della collezione: le domande che lo nominano non si confrontano fra pagine. */
  own?: string;
  questions: readonly string[];
}

/**
 * Le domande generiche uguali in una stessa lingua, fra pagine **diverse**: chi le ha, a coppie.
 * Il file di una pagina e la stessa pagina su Sanity non si confrontano fra loro.
 */
export function crossDuplicates(
  pages: readonly DupPage[],
  names: readonly string[],
): Array<{ question: string; first: string; second: string }> {
  const seen = new Map<string, DupPage>();
  const out: Array<{ question: string; first: string; second: string }> = [];
  for (const page of pages) {
    for (const q of page.questions) {
      const { scope, key: k } = duplicateKey(q, page.own, names);
      if (scope === "page") continue;
      const first = seen.get(k);
      if (!first) seen.set(k, page);
      else if (first.page !== page.page)
        out.push({ question: q, first: first.label, second: page.label });
    }
  }
  return out;
}

/**
 * Le pagine da confrontare in un giro (Marco, 30/10): le FAQ già su Sanity si tolgono **solo** per
 * le pagine che il giro scrive in quella lingua, perché il file le sostituisce. Tutte le altre
 * restano, comprese quelle delle pagine che il giro salta (bozza, errore, pagina d'uso, già uguali).
 */
export function pagesForRun(
  onSanity: readonly DupPage[],
  files: readonly DupPage[],
  written: ReadonlySet<string>,
): DupPage[] {
  return [...onSanity.filter((p) => !written.has(p.page)), ...files];
}

/** Che fare di una pagina con `--execute`: la scrittura, o perché si salta. */
export type FaqWrite =
  | { action: "create"; doc: Record<string, unknown> & { _id: string; _type: string } }
  | { action: "patch"; id: string; rev: string; before: unknown; hasFaq: boolean }
  | { action: "skip"; reason: string };

/**
 * La decisione su una pagina, **pura** (spec § 11). Le pagine d'uso si scrivono come le principali
 * dalla c1a (3/11/2026). Si scrive sul pubblicato il solo
 * `faq.<lingua>`, come il publish per campi, e mai dove c'è una bozza o una versione: chi la
 * pubblicasse dopo porterebbe via le FAQ. Un file con un errore non si scrive; le domande
 * bloccate da «DA VERIFICARE» sono già fuori da `built`.
 */
export function decideFaqWrite(args: {
  kind: string;
  code: string;
  lang: string;
  id?: string;
  /** `faq` è `null` quando il campo manca: la proiezione GROQ non lo omette. */
  target?: { _id: string; _rev: string; faq?: Record<string, unknown> | null };
  hasDraft: boolean;
  errors: number;
  built: readonly BuiltItem[];
}): FaqWrite {
  if (args.errors > 0) return { action: "skip", reason: `${args.errors} errori nel file` };
  if (args.built.length === 0) return { action: "skip", reason: "nessuna domanda da scrivere" };
  if (args.hasDraft)
    return { action: "skip", reason: "bozza o versione presente: si pubblica prima quella" };
  if (!args.target) {
    // Le pagine principali e quelle d'uso nascono col loro id fisso; una collezione no.
    if ((args.kind !== "main" && args.kind !== "use") || !args.id)
      return { action: "skip", reason: "pagina assente" };
    return {
      action: "create",
      doc: {
        _id: args.id,
        _type: "contentPage",
        code: args.code,
        kind: args.kind,
        faq: { [args.lang]: args.built },
      },
    };
  }
  const before = args.target.faq?.[args.lang];
  if (deepEqual(before, args.built)) return { action: "skip", reason: "già uguale su Sanity" };
  return {
    action: "patch",
    id: args.target._id,
    rev: args.target._rev,
    before,
    hasFaq: args.target.faq != null,
  };
}

export interface FaqComparison {
  /** Nel file e non sul pubblicato. */
  missing: string[];
  /** Sul pubblicato e non nel file. */
  extra: string[];
  /** La stessa domanda con testo, keyword, link o grassetti diversi (`textHash`). */
  changed: string[];
  /**
   * Solo se l'ordine è diverso: per ogni domanda nell'ordine del pubblicato, la sua posizione nel
   * file (es. `[1, 2, 4, 3]`), contando le sole domande che stanno da tutte e due le parti.
   */
  order: number[] | null;
}

/**
 * Le FAQ pubblicate contro quelle dei file, domanda per domanda (`pnpm faq:verifica`). Tre esiti,
 * separati (2/11/2026): domande mancanti o in più (per esempio una bozza vecchia pubblicata sopra),
 * testo diverso, e solo l'ordine diverso. I primi due sono errori; l'ordine è un avviso, perché
 * il testo che il sito serve è quello giusto.
 */
export function compareFaq(
  built: readonly BuiltItem[],
  published:
    | ReadonlyArray<{ question?: string; keyword?: string; answer?: unknown; deepDive?: unknown }>
    | undefined,
): FaqComparison {
  const live = published ?? [];
  const missing: string[] = [];
  const changed: string[] = [];
  for (const b of built) {
    const p = live.find((x) => x.question === b.question);
    if (!p) missing.push(b.question);
    else if (textHash({ ...p, question: p.question! }) !== textHash(b)) changed.push(b.question);
  }
  const extra = live
    .filter((p) => !built.some((b) => b.question === p.question))
    .map((p) => p.question ?? "");
  const positions = live
    .map((p) => built.findIndex((b) => b.question === p.question))
    .filter((i) => i >= 0);
  const inOrder = positions.every((i, k) => k === 0 || positions[k - 1] < i);
  return { missing, extra, changed, order: inOrder ? null : positions.map((i) => i + 1) };
}

/** Un confronto con domande mancanti, in più o col testo diverso: l'ordine da solo non lo è. */
export const faqComparisonFails = (c: FaqComparison) =>
  c.missing.length + c.extra.length + c.changed.length > 0;

/**
 * Come si rimette una pagina com'era prima di una scrittura (`--ripristina`). Con le FAQ di prima
 * si riscrive `faq.<lingua>`; senza, si toglie `faq` intero solo se il verbale dice che il campo
 * non c'era e su Sanity non ci sono altre lingue, altrimenti il solo `faq.<lingua>`.
 */
export function restoreOp(
  entry: { before?: unknown; hasFaq: boolean },
  lang: string,
  current: Record<string, unknown> | null | undefined,
): { set: Record<string, unknown> } | { unset: string[] } {
  if (entry.before != null) return { set: { [`faq.${lang}`]: entry.before } };
  const others = Object.entries(current ?? {}).some(([k, v]) => k !== lang && v != null);
  return { unset: [entry.hasFaq || others ? `faq.${lang}` : "faq"] };
}

/**
 * Il tipo e lo slug di una pagina che `faq:carica` scrive, per i suoi tag (rule `cache-isr`): una
 * collezione col suo slug, una pagina principale col solo tipo, anche quando nasce in questo giro
 * (`contentPage-<code>`). Un id che non è nessuna delle due resta `undefined`, e `stampaTag` si ferma.
 */
export function trovaPaginaFaq(
  pages: ReadonlyArray<{ _id: string; _type: string }>,
  slugs: ReadonlyArray<{ _id: string; slug: string }>,
): (id: string) => { _type: string; slug: string | null } | undefined {
  return (id) => {
    const p = pages.find((x) => x._id === id);
    if (p) return { _type: p._type, slug: slugs.find((d) => d._id === id)?.slug ?? null };
    return id.startsWith("contentPage-") ? { _type: "contentPage", slug: null } : undefined;
  };
}
