/**
 * Le regole delle FAQ, pure: le usano lo Studio (validazioni), gli script di rito
 * (`faq:carica`, `faq:doppie`) e i test. Spec `docs/specs/faq-pagine-uso.md` § 1.3, § 2.2, § 4.
 *
 * ⚠️ Niente import: questo file entra nel bundle dello Studio e nei comandi `tsx`, e non deve
 * tirarsi dietro né Next né il client di Sanity.
 */

/** Le lingue delle FAQ, nello stesso ordine di `ALL_LOCALES` (`src/i18n/routing.ts`). */
export const FAQ_LANGUAGES = ["it", "en", "de", "fr", "es"] as const;
export type FaqLanguage = (typeof FAQ_LANGUAGES)[number];

/**
 * Le cinque pagine principali, ciascuna con un documento fisso e id stabile (spec § 1.1, Marco
 * 30/10, D3). L'id è `contentPage-<code>` col trattino: un id col punto sarebbe privato, e il sito
 * non lo leggerebbe senza token.
 */
export const MAIN_PAGES = [
  { code: "home", title: "Home" },
  { code: "about", title: "Chi siamo" },
  { code: "finishes", title: "Finiture" },
  { code: "production", title: "Produzione" },
  { code: "contact", title: "Contatti" },
] as const;

/**
 * Le pagine d'uso (spec `seo-pagine-contenuto.md`, c1a del 3/11/2026): un documento fisso ciascuna,
 * come le principali, creato dal caricatore e mai da Studio (Marco, grill del 3/11, Q16).
 */
export const USE_PAGES = [{ code: "outdoor-shower", title: "Doccia da esterno" }] as const;

export const contentPageId = (code: string) => `contentPage-${code}`;

/** Il tetto di domande per lingua per pagina: un tetto, non un obiettivo (spec § 1.3). */
export const FAQ_MAX_ITEMS = 5;

/**
 * Le rotte che un link interno può raggiungere: chiavi di `routing.pathnames`, col tipo di
 * documento a cui punta lo slug. `null` = rotta senza slug.
 *
 * ⚠️ Le voci letterali stanno PRIMA della dinamica sorella, come in `routing.ts`: il percorso
 * `/collezioni/corpi-a-incasso` è la pagina dei corpi, non una collezione con quello slug.
 * Fuori apposta: `/area-riservata`, `/officina` (`noindex`) e `/menzioni-legali`. Che ogni
 * chiave esista davvero in `routing.pathnames` lo controlla `faq-rules.test.ts`.
 */
export const FAQ_LINK_ROUTES = {
  "/": null,
  "/collezioni": null,
  "/collezioni/corpi-a-incasso": null,
  "/collezioni/corpi-a-incasso/[slug]": "concealedBody",
  "/collezioni/[slug]": "collection",
  "/modello/[slug]": "model",
  "/finiture": null,
  "/produzione": null,
  "/chi-siamo": null,
  "/contatti": null,
  "/blog": null,
  "/blog/[slug]": "post",
  "/referenze": null,
  "/referenze/[slug]": "projectReference",
  // La pagina d'uso (c1b, 4/11/2026): gli ingressi dalle FAQ delle collezioni da esterno.
  "/doccia-da-esterno": null,
} as const;
export type FaqLinkRoute = keyof typeof FAQ_LINK_ROUTES;

/** La rotta e lo slug di un percorso scritto con la chiave italiana (`/modello/b40l`). */
export function matchLinkRoute(href: string): { route: FaqLinkRoute; slug?: string } | null {
  const path = href.split("#")[0].replace(/\/$/, "") || "/";
  for (const route of Object.keys(FAQ_LINK_ROUTES) as FaqLinkRoute[]) {
    if (!route.includes("[slug]")) {
      if (route === path) return { route };
      continue;
    }
    const prefix = route.replace("/[slug]", "/");
    const slug = path.startsWith(prefix) ? path.slice(prefix.length) : "";
    if (/^[a-z0-9-]+$/.test(slug)) return { route, slug };
  }
  return null;
}

/**
 * La rotta di una pagina con FAQ, per riconoscere un «Approfondisci» che punta alla pagina stessa
 * (4/11/2026): le principali e le pagine d'uso per codice; una collezione col suo slug, tranne il
 * contenitore dei corpi, che ha la sua pagina.
 */
const MAIN_PAGE_ROUTES: Record<string, FaqLinkRoute> = {
  home: "/",
  about: "/chi-siamo",
  finishes: "/finiture",
  production: "/produzione",
  contact: "/contatti",
  "outdoor-shower": "/doccia-da-esterno",
};
export function faqPageRoute(
  kind: string,
  code: string,
  collection?: { _id: string; slug?: string | null },
): { route: FaqLinkRoute; ref?: string } | null {
  if (kind === "main" || kind === "use")
    return Object.hasOwn(MAIN_PAGE_ROUTES, code) ? { route: MAIN_PAGE_ROUTES[code] } : null;
  if (kind !== "collection" || !collection) return null;
  return collection.slug === "corpi-a-incasso"
    ? { route: "/collezioni/corpi-a-incasso" }
    : { route: "/collezioni/[slug]", ref: collection._id };
}

/** Il testo di «Approfondisci»: parole (spec FAQ § 8, Marco 4/11/2026). */
export const DEEP_DIVE_WORDS = { min: 3, max: 12 } as const;

/**
 * I controlli del testo di «Approfondisci», uguali in Studio e nel caricatore (Marco, 4/11/2026):
 * descrittivo, da 3 a 12 parole, niente em dash, apostrofo tipografico, e in francese lo spazio
 * unificatore (U+00A0 o U+202F) prima di `: ; ! ? »` e dopo `«`.
 */
export function checkDeepDiveLabel(label: string | undefined, lang: string): FaqProblem[] {
  const out: FaqProblem[] = [];
  const t = (label ?? "").trim();
  if (!t) return [{ level: "error", message: "«Approfondisci» senza testo del link" }];
  const n = words(t).length;
  if (n < DEEP_DIVE_WORDS.min || n > DEEP_DIVE_WORDS.max)
    out.push({
      level: "error",
      message: `«Approfondisci»: ${n} parole nel testo (attese ${DEEP_DIVE_WORDS.min}-${DEEP_DIVE_WORDS.max})`,
    });
  if (t.includes("—")) out.push({ level: "error", message: "«Approfondisci»: em dash nel testo" });
  if (t.includes("'"))
    out.push({ level: "error", message: "«Approfondisci»: apostrofo dritto, serve ’" });
  if (lang === "fr" && (/ [:;!?»]/.test(t) || /« /.test(t)))
    out.push({
      level: "error",
      message: "«Approfondisci»: in francese lo spazio unificatore prima di : ; ! ? » e dopo «",
    });
  return out;
}

/** Un blocco di Portable Text, quanto basta per leggerne il testo. */
export interface FaqBlock {
  _type: string;
  children?: Array<{ _type?: string; text?: string; marks?: string[] }>;
  markDefs?: Array<{ _key: string; _type: string }>;
}

export function blocksToText(blocks: readonly FaqBlock[] | undefined): string {
  return (blocks ?? [])
    .filter((b) => b._type === "block")
    .map((b) => (b.children ?? []).map((c) => c.text ?? "").join(""))
    .join("\n\n");
}

/** Le parole di un testo: ogni gruppo senza spazi che contiene una lettera o una cifra. */
export function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

/** I testi in grassetto, ciascuno con l'indice della parola da cui parte. */
export function strongSpans(
  blocks: readonly FaqBlock[] | undefined,
): Array<{ text: string; at: number }> {
  const out: Array<{ text: string; at: number }> = [];
  let count = 0;
  for (const b of blocks ?? []) {
    if (b._type !== "block") continue;
    for (const c of b.children ?? []) {
      const text = c.text ?? "";
      if (c.marks?.includes("strong")) out.push({ text, at: count });
      count += words(text).length;
    }
  }
  return out;
}

/** I tipi delle annotazioni usate nei blocchi (`internalLink`, `link`). */
export function annotationTypes(blocks: readonly FaqBlock[] | undefined): string[] {
  return (blocks ?? []).flatMap((b) =>
    (b.markDefs ?? [])
      .filter((d) => (b.children ?? []).some((c) => c.marks?.includes(d._key)))
      .map((d) => d._type),
  );
}

const fold = (s: string) =>
  s
    .toLocaleLowerCase("it")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * La domanda ridotta per il confronto dei doppioni: minuscole, senza punteggiatura e senza i nomi
 * dati, così «Boss si usa all'aperto?» e «Club si usa all'aperto?» risultano uguali. Quali domande
 * si confrontano lo decide `duplicateKey`.
 *
 * ⚠️ Lettere di ogni lingua (`\p{L}`): il controllo del giro 3 teneva solo quelle italiane, e in
 * tedesco o in spagnolo avrebbe tolto «ü», «ß» o «ñ».
 */
export function normalizeQuestion(question: string, names: readonly string[]): string {
  let q = ` ${fold(question)} `;
  for (const name of [...names]
    .map(fold)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    q = q.split(` ${name} `).join(" ");
  }
  return q.replace(/\s+/g, " ").trim();
}

/** Le parole della keyword si trovano tutte nel testo (in grassetto, di solito). */
export function containsKeyword(text: string, keyword: string): boolean {
  const have = new Set(words(fold(text)));
  return words(fold(keyword)).every((w) => have.has(w));
}

/** Le parole vuote delle cinque lingue, che una keyword può avere e il grassetto no. */
const KEYWORD_STOPWORDS = new Set(
  [
    "di da in il lo la le i gli e ed ad per con che si un una uno",
    "del della dei delle al alla nel nella sul sulla dell nell all dall sull",
    "the of for and a an with to on by or",
    "aus von der die das und fur mit im zu zum zur den dem des ein eine am vom auf",
    "de du des les en et pour avec au aux d l sur une dans par",
    "el los las y para por",
  ]
    .join(" ")
    .split(" "),
);

/** Minuscole e senza accenti: «Küchenarmatur» e «kuchenarmatur», «Außen» e «aussen» sono la stessa parola. */
const foldAccents = (s: string) =>
  fold(s)
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "");

/** La radice di una parola da 5 lettere in su: 5 lettere, al più la parola meno 2. */
const radice = (w: string) => w.slice(0, Math.min(5, w.length - 2));

/**
 * Il grassetto porta la keyword (Marco, 2/11/2026): ogni parola piena della keyword compare nel
 * grassetto (i grassetti delle prime 50 parole, insieme) come inizio di parola, in qualsiasi ordine, ignorando maiuscole, accenti e parole
 * vuote. Di una parola da 5 lettere in su basta la radice, lunga 5 lettere ma al più la parola
 * meno 2 («Armaturen» in «Armatur», «poliert» in «polierte»); dal 4/11/2026 (Marco) il «meno 2»
 * fa combaciare il plurale italiano che cambia la vocale prima della desinenza: «doccia» e
 * «docce» (radice «docc»), «camicia» e «camicie». Una parola più corta deve esserci intera
 * («316», «inox»).
 */
export function boldHasKeyword(bold: string, keyword: string): boolean {
  const have = words(foldAccents(bold));
  return words(foldAccents(keyword))
    .filter((w) => !KEYWORD_STOPWORDS.has(w))
    .every((w) => (w.length >= 5 ? have.some((h) => h.startsWith(radice(w))) : have.includes(w)));
}

const PRICE_WORDS = /\b(prezz[oi]|prices?|preise?|prix|precios?)\b/iu;

/**
 * Una cifra accanto a un simbolo di valuta, o a «prezzo» nella stessa frase: sulle FAQ e sugli
 * approfondimenti i prezzi non si scrivono (spec, regole che non si discutono).
 */
export function mentionsPrice(text: string): boolean {
  if (/\d[\d.,]*\s?[€$£]|[€$£]\s?\d/u.test(text)) return true;
  return text.split(/[.!?]\s/).some((s) => PRICE_WORDS.test(s) && /\d/.test(s));
}

export type FaqProblemLevel = "error" | "warning";
export interface FaqProblem {
  level: FaqProblemLevel;
  message: string;
}

export const ANSWER_WORDS = { min: 75, max: 105, head: 50 } as const;

/**
 * I controlli di una risposta (spec § 2.2): parole, grassetto con la keyword e nome entro le prime
 * 50, un link interno, niente prezzi, niente em dash. `names` sono i nomi che valgono come «nome»
 * (Fontealta e, sulle collezioni, il titolo della collezione).
 */
export function checkAnswer(
  item: { question: string; keyword?: string; answer?: readonly FaqBlock[] },
  names: readonly string[],
): FaqProblem[] {
  const problems: FaqProblem[] = [];
  if (item.question.includes("—"))
    problems.push({ level: "error", message: "em dash nella domanda" });
  const text = blocksToText(item.answer);
  if (!text.trim())
    return [
      ...problems,
      { level: "warning", message: "domanda senza risposta: non compare sul sito" },
    ];

  const all = words(text);
  if (all.length < ANSWER_WORDS.min || all.length > ANSWER_WORDS.max)
    problems.push({
      level: "warning",
      message: `${all.length} parole (attese ${ANSWER_WORDS.min}-${ANSWER_WORDS.max})`,
    });

  const head = all.slice(0, ANSWER_WORDS.head).join(" ");
  if (!names.some((n) => containsKeyword(head, n)))
    problems.push({
      level: "warning",
      message: `né ${names.join(" né ")} nelle prime ${ANSWER_WORDS.head} parole`,
    });

  const strong = strongSpans(item.answer);
  const early = strong.filter((s) => s.at < ANSWER_WORDS.head);
  if (early.length === 0)
    problems.push({
      level: "warning",
      message: `nessun grassetto nelle prime ${ANSWER_WORDS.head} parole`,
    });
  else if (item.keyword && !boldHasKeyword(early.map((s) => s.text).join(" "), item.keyword))
    problems.push({
      level: "warning",
      message: `il grassetto non contiene la keyword «${item.keyword}»`,
    });

  const seen = new Set<string>();
  for (const s of strong) {
    const k = fold(s.text);
    if (seen.has(k))
      problems.push({ level: "warning", message: `«${s.text}» in grassetto due volte` });
    seen.add(k);
  }

  if (!annotationTypes(item.answer).includes("internalLink"))
    problems.push({ level: "warning", message: "nessun link interno" });
  if (mentionsPrice(text)) problems.push({ level: "error", message: "un prezzo nella risposta" });
  if (text.includes("—")) problems.push({ level: "error", message: "em dash nella risposta" });
  return problems;
}

/** La domanda nomina questa collezione (parola intera, senza maiuscole né punteggiatura). */
export function mentionsName(question: string, name: string | undefined): boolean {
  const n = name ? fold(name) : "";
  return Boolean(n) && ` ${fold(question)} `.includes(` ${n} `);
}

/**
 * La chiave dei doppioni (Marco, 30/10). Una domanda che nomina la **sua** collezione è di
 * prodotto e non è mai il doppione di un'altra pagina («In quali finiture si fa Arko?» e «…Onda?»
 * sono domande diverse): sulla pagina si confronta col suo testo intero. Le altre sono generiche, e
 * senza i nomi di tutte le collezioni restano uniche in tutto il sito.
 */
export function duplicateKey(
  question: string,
  own: string | undefined,
  names: readonly string[],
): { scope: "page" | "site"; key: string } {
  return mentionsName(question, own)
    ? { scope: "page", key: normalizeQuestion(question, []) }
    : { scope: "site", key: normalizeQuestion(question, names) };
}

/** Le domande uguali dentro uno stesso elenco: gli indici dei doppioni. */
export function duplicateIndexes(
  questions: readonly string[],
  own: string | undefined,
  names: readonly string[],
): number[] {
  const seen = new Set<string>();
  const dup: number[] = [];
  questions.forEach((q, i) => {
    const { scope, key } = duplicateKey(q, own, names);
    const k = `${scope}:${key}`;
    if (key && seen.has(k)) dup.push(i);
    seen.add(k);
  });
  return dup;
}
