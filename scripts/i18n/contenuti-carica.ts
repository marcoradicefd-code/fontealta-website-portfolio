/**
 * scripts/i18n/contenuti-carica.ts --dir <cartella> [--misure <cartella>] [--sezione=<a,b>] [--lingua=<l,…>] [--execute --all [--invalida]]
 * scripts/i18n/contenuti-carica.ts --ripristina=<file> [--execute]
 *
 * Il caricatore dei contenuti per lingua (spec `docs/specs/contenuti-per-lingua.md` § C): legge i
 * file di Cowork (`<cartella>/<lingua>/<sezione>.md`) e dice cosa scriverebbe su Sanity.
 *
 * Sezioni: `collezioni` (tagline, `seo.metaTitle`, `seo.metaDescription` per lingua; una `tagline:`
 * vuota la TOGLIE da Sanity, e tolte tutte le lingue si toglie il campo intero, 4/11/2026), `alt-blog`
 * (`coverImage.altI18n`), `alt-autori` (`photo.altI18n`), `descrizioni` (le correzioni scritte da
 * Cowork più quelle meccaniche: «Aisi» → «AISI», apostrofo tipografico, maiuscola iniziale), `misure`
 * (`specs` di modelli e corpi dall'estrazione dei disegni del listino, `<cartella misure>/*-misure.json`,
 * spec `docs/specs/misure.md`: solo le misure con nome, stato «da verificare»), `pagine-uso` (titolo,
 * introduzione, corpo, `seo` per lingua e collezioni delle pagine d'uso, dai file di
 * `<cartella pagine>/<lingua>/<code>.md`, spec `docs/specs/seo-pagine-contenuto.md`; c1a del
 * 3/11/2026). `pagine-uso` si sceglie sempre per nome (`--sezione=pagine-uso`): non è nel giro di
 * default. La pagina che non c'è si crea, col suo id fisso; una lingua cambiata in Studio dopo il
 * caricamento (impronta in `loadedHashes`) non si sovrascrive. `post` (5/11/2026, grill di Marco,
 * Q13): titolo, estratto, corpo e `seo` per lingua dei post del blog, dai file di
 * `<cartella post>/<lingua>/<slug>.md` (`articolo-md.ts`), più `revisedAt`, il giorno del carico;
 * solo per nome come le pagine d'uso (`pnpm post:carica`). Nel dry-run ogni link interno si apre sul
 * sito nella lingua del file e deve rispondere 200. Un post che non c'è si CREA (c2, Marco, 5/11/2026)
 * se il file italiano porta `copertina`, `categoria` e `pubblicato` e tutte e cinque le lingue hanno
 * `copertina.alt`: id fisso `post-<slug>`, nessun `revisedAt` alla nascita; `--ripristina` lo cancella,
 * e si ferma senza toccarlo se un altro documento lo referenzia.
 *
 * ⚠️ **Dry-run di default.** Con `--execute --all` (scritto apposta) scrive sul PUBBLICATO i soli
 * campi della sezione e della lingua, con `ifRevisionId`, verbale in `tmp/contenuti-scritture/` e
 * l'export del dataset del giorno come cancello (`pnpm sanity:export`). Un file con errori non si
 * scrive; un documento con una bozza o una versione si salta, perché chi la pubblicasse dopo
 * porterebbe via quello che si scrive qui. `--ripristina=<file>` rimette i campi del verbale.
 *
 * ⚠️ **Diff e codice di conferma** (manutenzione 3, c1a del 3/11/2026): prima di scrivere si salva in
 * `tmp/contenuti-scritture/diff/` il prima e il dopo di ogni documento (a terminale, fino a 10
 * documenti) e si chiede il codice che quel diff produce: a terminale, o con `--conferma=<codice>`
 * quando non c'è un terminale. Lo stesso diff dà lo stesso codice; un documento cambiato nel
 * frattempo ne dà un altro.
 *
 * A fine `--execute` stampa i tag da invalidare, tipo e `<tipo>:<slug>` di ogni documento scritto, a
 * gruppi da 16 (rule `cache-isr`: col webhook spento il deploy non basta). Con `--invalida`, scritto
 * apposta, li invalida dall'API di Vercel (serve `VERCEL_TOKEN`); senza, si usano i gruppi stampati
 * col connettore.
 *
 * Uso:  pnpm contenuti:carica --dir tmp/contenuti-ondata-1
 *       pnpm contenuti:carica --dir tmp/contenuti-ondata-1 --sezione=collezioni --execute --all
 *       pnpm contenuti:carica --sezione=pagine-uso                    (docs/content/pagine-uso)
 *       pnpm contenuti:carica --sezione=pagine-uso --lingua=it --execute --all --conferma=<codice>
 *       pnpm post:carica --post tmp/post-finiture/post                (= --sezione=post)
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

import { contentPageId, USE_PAGES } from "../../sanity/lib/faq-rules";
import {
  assetMancanti,
  codiceConferma,
  compattaUnset,
  exportDiOggi,
  invalidaTag,
  operazione,
  percorsiToccati,
  pubblicato,
  radiceId,
  ripristinaCampi,
  scriviCampi,
  stampaTag,
  unisciPerDocumento,
  type Operazione,
} from "./carico-lib";
import {
  SEZIONI,
  conTesto,
  controllaFile,
  correzioniMeccaniche,
  parseFile,
  rigaPerArticolo,
  specsDaRiga,
  testoSemplice,
  type FileContenuti,
  type LinguaFile,
  type Problema,
  type RigaEstrazione,
  type Sezione,
} from "./contenuti-md";
import { contentFingerprint, parseFaqFile } from "./faq-md";
import { perPuntoDiCodice } from "./ordine";
import { checkUsePage, liveUseFields, parseUsePageFile, pageFields } from "./pagina-uso-md";
import {
  articoloFields,
  checkArticolo,
  checkCreazione,
  copertinaNuova,
  linkInterni,
  parseArticoloFile,
  percorsoNellaLingua,
  publishedAtDi,
  type ArticoloFile,
} from "./articolo-md";

loadEnv({ path: ".env.local", quiet: true });

const argv = process.argv.slice(2);
const valore = (nome: string) => argv.find((a) => a.startsWith(`${nome}=`))?.slice(nome.length + 1);
const dirArg = argv.indexOf("--dir");
const CARTELLA = dirArg >= 0 ? argv[dirArg + 1] : "tmp/contenuti-ondata-1";
const misureArg = argv.indexOf("--misure");
const CARTELLA_MISURE = misureArg >= 0 ? argv[misureArg + 1] : "tmp/misure";
const pagineArg = argv.indexOf("--pagine");
const CARTELLA_PAGINE = pagineArg >= 0 ? argv[pagineArg + 1] : "docs/content/pagine-uso";
const postArg = argv.indexOf("--post");
const CARTELLA_POST = postArg >= 0 ? argv[postArg + 1] : "docs/content/post";
/** Il sito su cui il dry-run apre i link interni dei post (Q12). */
const SITO = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fontealta-website-sigma.vercel.app";
/** Le sezioni che il caricatore conosce; `pagine-uso` e `post` solo per nome, fuori dal giro di default. */
const SEZIONI_TUTTE = [...SEZIONI, "pagine-uso", "post"] as const;
type SezioneCarico = (typeof SEZIONI_TUTTE)[number];
const SCELTE = (valore("--sezione")?.split(",") ?? [...SEZIONI]) as SezioneCarico[];
const LINGUE: LinguaFile[] = (valore("--lingua")?.split(",") as LinguaFile[]) ?? [
  "it",
  "en",
  "de",
  "fr",
  "es",
];
const ESEGUI = argv.includes("--execute");
const INVALIDA = argv.includes("--invalida");
const TUTTI = argv.includes("--all");
const RIPRISTINA = valore("--ripristina");
const CONFERMA = valore("--conferma");
const RADICE = join(process.cwd(), "tmp", "contenuti-scritture");

if (SCELTE.some((s) => !(SEZIONI_TUTTE as readonly string[]).includes(s))) {
  console.error(`✖ --sezione: una fra ${SEZIONI_TUTTE.join(", ")}`);
  process.exit(1);
}
if (INVALIDA && (!ESEGUI || RIPRISTINA)) {
  console.error("✖ --invalida va con --execute --all: in dry-run i tag si stampano e basta");
  process.exit(1);
}
if (ESEGUI && !RIPRISTINA && !TUTTI) {
  console.error("✖ --execute vuole anche --all, scritto apposta");
  process.exit(1);
}
const token = ESEGUI ? process.env.SANITY_WRITE_TOKEN : process.env.SANITY_API_READ_TOKEN;
if (ESEGUI && !token) {
  console.error("✖ Manca SANITY_WRITE_TOKEN");
  process.exit(1);
}
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01",
  useCdn: false,
  maxRetries: 0,
  token,
  perspective: "raw",
});

type Doc = Record<string, unknown> & { _id: string; _rev: string; _type: string };

interface Esito {
  sezione: SezioneCarico;
  /** `null` per le misure, che non hanno lingua. */
  lang: LinguaFile | null;
  voci: number;
  problemi: Problema[];
  operazioni: Operazione[];
  invariate: number;
  bozze: string[];
  nonTrovate: string[];
  nota?: string;
}

const LOC = { collezioni: "localizedTextOptional", stringa: "localizedStringOptional" } as const;

const leggi = (doc: unknown, p: string) =>
  p
    .split(".")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      doc,
    );

async function main(): Promise<number> {
  const tutti = await client.fetch<Doc[]>(
    `*[_type in ["collection", "post", "author", "category", "model", "concealedBody", "contentPage", "projectReference"]]{ _id, _rev, _type, "slug": slug.current, code, kind, name, tagline, seo, coverImage, photo, description, specs, title, intro, body, collections, loadedHashes, excerpt, revisedAt, "autore": author->name }`,
  );
  const conBozza = new Set(tutti.filter((d) => !pubblicato(d._id)).map((d) => radiceId(d._id)));
  const pub = tutti.filter((d) => pubblicato(d._id));
  const docs = new Map(pub.map((d) => [d._id, d]));
  const esiti: Esito[] = [];

  for (const sezione of SCELTE.filter((x): x is Sezione => x !== "pagine-uso" && x !== "post"))
    for (const lang of LINGUE) {
      const perc = join(CARTELLA, lang, `${sezione}.md`);
      if (!existsSync(perc)) continue;
      const f: FileContenuti = parseFile(readFileSync(perc, "utf8"));
      if (f.sezione !== sezione || f.lang !== lang)
        throw new Error(`${perc}: front matter diverso dal percorso`);
      const e: Esito = {
        sezione,
        lang,
        voci: f.voci.length,
        problemi: controllaFile(f),
        operazioni: [],
        invariate: 0,
        bozze: [],
        nonTrovate: [],
      };
      const aggiungi = (
        doc: Doc | undefined,
        chiave: string,
        campi: Record<string, unknown>,
        mancanti: Record<string, unknown>,
        togli: string[] = [],
      ) => {
        if (!doc) return void e.nonTrovate.push(chiave);
        if (conBozza.has(doc._id)) return void e.bozze.push(chiave);
        const op = operazione(doc, `${chiave} (${lang})`, campi, mancanti, togli);
        if (op) e.operazioni.push(op);
        else e.invariate++;
      };
      for (const v of f.voci) {
        if (sezione === "collezioni") {
          const doc = pub.find((d) => d._type === "collection" && d.slug === v.chiave);
          // `tagline:` vuoto nel file = la tagline di quella lingua si toglie (Marco, 4/11/2026);
          // title e description restano obbligatori (`controllaFile`).
          const svuota = v.campi.tagline === "";
          aggiungi(
            doc,
            v.chiave,
            {
              ...(svuota ? {} : { [`tagline.${lang}`]: v.campi.tagline }),
              [`seo.metaTitle.${lang}`]: v.campi.metaTitle,
              [`seo.metaDescription.${lang}`]: v.campi.metaDescription,
            },
            {
              ...(svuota ? {} : { tagline: { _type: LOC.collezioni } }),
              seo: { _type: "seoFields" },
              "seo.metaTitle": { _type: LOC.stringa },
              "seo.metaDescription": { _type: LOC.collezioni },
            },
            svuota ? [`tagline.${lang}`] : [],
          );
        } else if (sezione === "alt-blog") {
          const doc = pub.find((d) => d._type === "post" && d.slug === v.chiave);
          if (doc && !leggi(doc, "coverImage.asset"))
            e.problemi.push({
              livello: "errore",
              chiave: v.chiave,
              campo: "testo",
              messaggio: "il post non ha la cover",
            });
          aggiungi(
            doc,
            v.chiave,
            { [`coverImage.altI18n.${lang}`]: v.campi.testo },
            { "coverImage.altI18n": { _type: LOC.stringa } },
          );
        } else if (sezione === "alt-autori") {
          aggiungi(
            docs.get(v.chiave),
            v.chiave,
            { [`photo.altI18n.${lang}`]: v.campi.testo },
            { "photo.altI18n": { _type: LOC.stringa } },
          );
        } else {
          const doc = pub.find(
            (d) => (d._type === "model" || d._type === "concealedBody") && d.code === v.chiave,
          );
          const blocchi = doc ? leggi(doc, `description.${lang}`) : undefined;
          if (doc && testoSemplice(blocchi) === null) {
            e.problemi.push({
              livello: "errore",
              chiave: v.chiave,
              campo: "testo",
              messaggio: "descrizione non in forma semplice (un blocco, uno span)",
            });
            continue;
          }
          aggiungi(
            doc,
            v.chiave,
            {
              [`description.${lang}`]: conTesto(blocchi, correzioniMeccaniche(v.campi.testo, lang)),
            },
            {},
          );
        }
      }
      esiti.push(e);
    }

  // Le correzioni meccaniche delle descrizioni, su tutti i modelli e i corpi delle lingue scelte.
  if (SCELTE.includes("descrizioni"))
    for (const lang of LINGUE) {
      let e = esiti.find((x) => x.sezione === "descrizioni" && x.lang === lang);
      if (!e)
        esiti.push(
          (e = {
            sezione: "descrizioni",
            lang,
            voci: 0,
            problemi: [],
            operazioni: [],
            invariate: 0,
            bozze: [],
            nonTrovate: [],
          }),
        );
      const giaInFile = new Set(e.operazioni.map((o) => o.id));
      for (const d of pub.filter((x) => x._type === "model" || x._type === "concealedBody")) {
        if (giaInFile.has(d._id) || conBozza.has(d._id)) continue;
        const blocchi = leggi(d, `description.${lang}`);
        const t = testoSemplice(blocchi);
        if (t === null || !t) continue;
        const nuovo = correzioniMeccaniche(t, lang);
        if (nuovo !== t)
          e.operazioni.push({
            id: d._id,
            rev: d._rev,
            label: `${String(d.code)} (${lang}, meccanica)`,
            set: { [`description.${lang}`]: conTesto(blocchi, nuovo) },
          });
      }
    }

  // Le misure: una riga per articolo, solo le misure con nome. Chi non ne ha resta senza `specs`.
  if (SCELTE.includes("misure")) {
    const righe = readdirSync(CARTELLA_MISURE)
      .filter((f) => f.endsWith("-misure.json"))
      .flatMap(
        (f) => JSON.parse(readFileSync(join(CARTELLA_MISURE, f), "utf8")) as RigaEstrazione[],
      );
    const e: Esito = {
      sezione: "misure",
      lang: null,
      voci: 0,
      problemi: [],
      operazioni: [],
      invariate: 0,
      bozze: [],
      nonTrovate: [],
    };
    let senzaSpecs = 0;
    for (const [code, { riga, diverse }] of rigaPerArticolo(righe)) {
      const { specs, problemi } = specsDaRiga(riga);
      e.problemi.push(...problemi);
      if (diverse.length)
        e.problemi.push({
          livello: "avviso",
          chiave: code,
          campo: "collezioni",
          messaggio: `misure diverse in ${diverse.join(", ")}: vale ${riga.collezione}`,
        });
      if (!specs) {
        senzaSpecs++;
        continue;
      }
      e.voci++;
      const doc = pub.find(
        (d) => (d._type === "model" || d._type === "concealedBody") && d.code === code,
      );
      if (!doc) e.nonTrovate.push(code);
      else if (conBozza.has(doc._id)) e.bozze.push(code);
      else {
        const op = operazione(doc, `${code} (misure)`, { specs }, {});
        if (op) e.operazioni.push(op);
        else e.invariate++;
      }
    }
    e.nota = `${righe.length} righe dell'estrazione, ${e.voci + senzaSpecs} articoli: ${senzaSpecs} senza misure con nome, restano senza specs`;
    esiti.push(e);
  }

  if (SCELTE.includes("pagine-uso")) esiti.push(...(await pagineUso(pub, conBozza)));
  if (SCELTE.includes("post")) esiti.push(...(await articoli(pub, conBozza)));

  // Il rapporto.
  let errori = 0;
  for (const e of esiti) {
    const err = e.problemi.filter((p) => p.livello === "errore");
    errori += err.length + e.nonTrovate.length;
    console.log(
      `■ ${e.sezione} ${e.lang ?? "(senza lingua)"}: ${e.voci} voci · ${e.operazioni.length} documenti da scrivere · ${e.invariate} invariati · ${err.length} errori · ${e.bozze.length} saltati per bozza · ${e.nonTrovate.length} non trovati`,
    );
    if (e.nota) console.log(`    ${e.nota}`);
    for (const p of e.problemi)
      console.log(
        `    ${p.livello === "errore" ? "✖" : "·"} ${p.chiave} ${p.campo}: ${p.messaggio}`,
      );
    for (const c of e.nonTrovate) console.log(`    ✖ ${c}: documento non trovato`);
    for (const c of e.bozze) console.log(`    · ${c}: ha una bozza, si salta`);
  }
  const ops = esiti.flatMap((e) => e.operazioni);
  // Il dettaglio di ogni scrittura, campo per campo, da rileggere prima del GO.
  mkdirSync(RADICE, { recursive: true });
  const dettaglio = join(RADICE, `dry-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(
    dettaglio,
    JSON.stringify(
      esiti.map((e) => ({ sezione: e.sezione, lang: e.lang, operazioni: e.operazioni })),
      null,
      1,
    ),
  );
  console.log(`  dettaglio: ${dettaglio.replace(`${process.cwd()}/`, "")}`);
  const ids = new Set(ops.map((o) => o.id));
  // Una scrittura per documento e sezione: le operazioni dello stesso documento si uniscono.
  const perSezione = SCELTE.map((sezione) => ({
    sezione,
    // Tolte tutte le lingue della tagline, si toglie la tagline intera: com'era prima del 2/11.
    daScrivere: unisciPerDocumento(
      esiti.filter((e) => e.sezione === sezione).flatMap((e) => e.operazioni),
    ).map((op) => compattaUnset(op, docs.get(op.id), "tagline")),
  }));
  const scritture = perSezione.reduce((n, s) => n + s.daScrivere.length, 0);
  console.log(
    `\n  ${ops.length} operazioni · ${scritture} scritture (una per documento e sezione) su ${ids.size} documenti · ${errori} errori · ${ESEGUI ? "SCRITTURA" : "DRY-RUN, nessuna scrittura"}\n`,
  );
  const trova = (id: string) => {
    const d = docs.get(id);
    if (d) return { _type: d._type, slug: typeof d.slug === "string" ? d.slug : null };
    // Un post creato in questo giro: tipo e slug, come gli altri post.
    if (creati.has(id)) return { _type: "post", slug: creati.get(id) ?? null };
    // Una pagina d'uso creata in questo giro: il solo tipo, come le pagine principali.
    return id.startsWith("contentPage-") ? { _type: "contentPage", slug: null } : undefined;
  };
  const tutte = perSezione.flatMap((x) => x.daScrivere);
  const codice = codiceConferma(tutte);
  if (!ESEGUI) {
    stampaTag([...ids], trova);
    if (tutte.length) console.log(`  codice di conferma di questo diff: ${codice}\n`);
    return errori;
  }
  if (errori) {
    console.error("✖ ci sono errori: nessuna scrittura");
    return 1;
  }
  const backup = exportDiOggi();
  if (!backup) {
    console.error(
      "✖ --all vuole l'export del dataset di oggi in tmp/backup/ (pnpm sanity:export): nessuna scrittura",
    );
    return 1;
  }
  if (!(await confermato(tutte, docs, codice))) return 1;
  let problemi = 0;
  // Un documento scritto da una sezione cambia revisione: la sezione dopo parte da quella nuova.
  // `scriviCampi` la riempie a ogni scrittura riuscita, così anche un giro morto a metà dice chi è
  // già scritto e i suoi tag si stampano (finally).
  const revisioni = new Map<string, string>();
  let tags: string[] = [];
  try {
    for (const { sezione, daScrivere: lette } of perSezione) {
      if (!lette.length) continue;
      const daScrivere = lette.map((o) => ({ ...o, rev: revisioni.get(o.id) ?? o.rev }));
      const r = await scriviCampi(client, sezione, daScrivere, RADICE, docs, revisioni);
      problemi += r.problemi;
      console.log(
        `  ${sezione}: ${daScrivere.length} scritture, ${r.problemi} problemi · verbale ${r.verbale.replace(`${process.cwd()}/`, "")}`,
      );
    }
  } finally {
    tags = stampaTag([...revisioni.keys()], trova);
  }
  if (INVALIDA && tags.length) problemi += await invalidaTag(tags);
  return problemi;
}

/**
 * Il diff di ogni documento, prima e dopo, campo per campo, e il codice che lo conferma (stesso
 * metodo di `faq:carica`). Fino a 10 documenti il diff si stampa; oltre, si legge dai file.
 */
async function confermato(
  operazioni: readonly Operazione[],
  docs: Map<string, Doc>,
  codice: string,
): Promise<boolean> {
  if (!operazioni.length) return true;
  // Una cartella per giro: i diff di giri diversi non si mescolano (revisore del 3/11).
  const dir = join(RADICE, "diff", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  for (const op of operazioni) {
    const prima = Object.fromEntries(
      percorsiToccati(op).map((p) => [p, leggi(docs.get(op.id), p) ?? null]),
    );
    // Dopo: un percorso tolto vale `null`, come nel «prima» un campo che non c'era.
    const dopo = { ...op.set, ...Object.fromEntries((op.unset ?? []).map((p) => [p, null])) };
    const a = join(dir, `${op.id}-prima.json`);
    const b = join(dir, `${op.id}-dopo.json`);
    writeFileSync(a, `${JSON.stringify(prima, null, 2)}\n`, "utf-8");
    writeFileSync(b, `${JSON.stringify(dopo, null, 2)}\n`, "utf-8");
    if (operazioni.length > 10) continue;
    console.log(`\n■ ${op.label} → ${op.id} (${op.crea ? "documento nuovo" : `rev ${op.rev}`})`);
    try {
      // Percorso assoluto, non il PATH: il programma lanciato è quello di sistema (Sonar S4036).
      execFileSync("/usr/bin/diff", ["-u", "--label", "prima", "--label", "dopo", a, b], {
        stdio: "inherit",
      });
    } catch {
      // `diff` esce con 1 quando i file sono diversi: è il caso normale.
    }
  }
  if (operazioni.length > 10)
    console.log(
      `\n  ${operazioni.length} documenti: il diff sta in ${dir.replace(`${process.cwd()}/`, "")}`,
    );
  let ok = CONFERMA === codice;
  if (!ok && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    ok =
      (await rl.question(`\n  Scrivo? Batti il codice ${codice} per confermare: `)).trim() ===
      codice;
    rl.close();
  }
  if (!ok)
    console.log(
      `\n  Nessuna scrittura. ${CONFERMA ? "Il codice non corrisponde a questo diff. " : ""}Per scrivere questo diff: --conferma=${codice}\n`,
    );
  return ok;
}

/** Gli asset delle foto di un corpo. */
function assetRefs(body: readonly unknown[]): string[] {
  return body.flatMap((b) => {
    const x = b as Record<string, { asset?: { _ref?: string } } | undefined>;
    return [x.image, x.left, x.right].flatMap((i) => (i?.asset?._ref ? [i.asset._ref] : []));
  });
}

/** Gli oggetti dei campi della pagina d'uso, col loro tipo, annidati (`seo` coi suoi due figli). */
const OGGETTI_PAGINA_USO = {
  title: { _type: LOC.stringa },
  intro: { _type: LOC.collezioni },
  body: { _type: "localizedUseBody" },
  seo: {
    _type: "seoFields",
    metaTitle: { _type: LOC.stringa },
    metaDescription: { _type: LOC.collezioni },
  },
} as const;

/** Quelli che mancano a un documento che c'è: interi se manca il padre, altrimenti i soli figli. */
function oggettiMancanti(doc: Doc): { setIfMissing?: Record<string, unknown> } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(OGGETTI_PAGINA_USO)) {
    if (leggi(doc, k) === undefined) out[k] = v;
    else if (k === "seo")
      for (const figlio of ["metaTitle", "metaDescription"] as const)
        if (leggi(doc, `seo.${figlio}`) === undefined)
          out[`seo.${figlio}`] = OGGETTI_PAGINA_USO.seo[figlio];
  }
  return Object.keys(out).length ? { setIfMissing: out } : {};
}

/**
 * Le pagine d'uso: un file per pagina e lingua, letto, controllato e trasformato nelle operazioni
 * sul documento fisso `contentPage-<code>`. Le impronte di tutte le lingue scritte finiscono in
 * `loadedHashes`, lo stesso valore in ogni operazione del documento (si uniscono in una).
 */
async function pagineUso(pub: Doc[], conBozza: Set<string>): Promise<Esito[]> {
  const esiti: Esito[] = [];
  const slugs = new Map(
    pub
      .filter((d) => d._type === "collection" && typeof d.slug === "string")
      .map((d) => [d.slug as string, d._id]),
  );
  const resolve = (type: string, slug: string) =>
    pub.find((d) => d._type === type && d.slug === slug)?._id;
  const impronte = new Map<string, Map<string, string>>();
  /** Gli asset delle foto di questo giro, coi file che li usano: devono esistere su Sanity. */
  const assetUsati = new Map<string, string[]>();
  const esitoDelFile = new Map<string, Esito>();
  const perDoc = new Map<string, Operazione[]>();

  for (const lang of LINGUE) {
    const dir = join(CARTELLA_PAGINE, lang);
    if (!existsSync(dir)) continue;
    for (const nome of readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort(perPuntoDiCodice)) {
      const perc = join(dir, nome);
      const e: Esito = {
        sezione: "pagine-uso",
        lang,
        voci: 1,
        problemi: [],
        operazioni: [],
        invariate: 0,
        bozze: [],
        nonTrovate: [],
      };
      esiti.push(e);
      const chiave = `${lang}/${nome}`;
      esitoDelFile.set(chiave, e);
      const segna = (livello: Problema["livello"], messaggio: string) =>
        e.problemi.push({ livello, chiave, campo: "pagina", messaggio });
      const { file, problems } = parseUsePageFile(readFileSync(perc, "utf8"), resolve);
      for (const p of problems) segna(p.level === "error" ? "errore" : "avviso", p.message);
      if (!file) continue;
      if (file.lang !== lang) segna("errore", `lang «${file.lang}» in una cartella «${lang}»`);
      if (!USE_PAGES.some((p) => p.code === file.code)) {
        segna("errore", `«${file.code}» non è una pagina d'uso`);
        continue;
      }
      const id = contentPageId(file.code);
      const faqPerc = join(CARTELLA_PAGINE, "faq", lang, `${file.code}.md`);
      const faq = existsSync(faqPerc)
        ? parseFaqFile(readFileSync(faqPerc, "utf8")).file
        : undefined;
      if (!faq) segna("avviso", `nessun file delle FAQ in ${faqPerc}: H2 non confrontati`);
      const otherDescriptions = pub
        .filter((d) => d._id !== id)
        .map((d) => leggi(d, `seo.metaDescription.${lang}`))
        .filter((x): x is string => typeof x === "string");
      for (const p of checkUsePage(file, {
        faqQuestions: faq?.items.map((i) => i.question) ?? [],
        otherDescriptions,
        collectionSlugs: new Set(slugs.keys()),
      }))
        segna(p.level === "error" ? "errore" : "avviso", p.message);

      const doc = pub.find((d) => d._id === id);
      if (doc && conBozza.has(id)) {
        e.bozze.push(chiave);
        continue;
      }
      const live = liveUseFields(doc, lang);
      const registrata = (
        doc?.loadedHashes as Array<{ lang?: string; hash?: string }> | undefined
      )?.find((h) => h.lang === lang)?.hash;
      const ids =
        lang === "it" && file.collections
          ? file.collections.map((c) => slugs.get(c) ?? c)
          : undefined;
      const { fields, hash } = pageFields(file, ids);
      // Cambiata in Studio dopo il caricamento: si ferma, a meno che il file porti già la stessa
      // modifica (spec § 7: «si riporta prima la modifica nel file»); allora si riscrive l'impronta.
      if (!live.empty && live.hash !== registrata && live.hash !== hash) {
        segna(
          "errore",
          "cambiata in Studio dopo il caricamento (o mai caricata da qui): riporta la modifica nel file",
        );
        continue;
      }
      if (live.hash === hash && registrata === hash) {
        e.invariate++;
        continue;
      }
      for (const a of assetRefs(file.body))
        assetUsati.set(a, [...(assetUsati.get(a) ?? []), chiave]);
      impronte.set(id, (impronte.get(id) ?? new Map()).set(lang, hash));
      const set: Record<string, unknown> = {
        [`title.${lang}`]: fields.title,
        [`intro.${lang}`]: fields.intro,
        [`body.${lang}`]: fields.body,
        [`seo.metaTitle.${lang}`]: fields.seoTitle,
        [`seo.metaDescription.${lang}`]: fields.seoDescription,
      };
      if (ids)
        set.collections = ids.map((ref, k) => ({
          _type: "reference",
          _key: file.collections![k],
          _ref: ref,
        }));
      const op: Operazione = {
        id,
        rev: doc?._rev ?? "",
        label: `${file.code} (${lang})`,
        set,
        // Un documento nuovo nasce con gli oggetti dentro; su uno che c'è, gli oggetti che mancano si
        // creano annidati, come `operazione()`: due percorsi separati dipenderebbero dall'ordine.
        ...(doc
          ? oggettiMancanti(doc)
          : {
              crea: {
                _id: id,
                _type: "contentPage",
                code: file.code,
                kind: "use",
                ...OGGETTI_PAGINA_USO,
              },
            }),
      };
      e.operazioni.push(op);
      perDoc.set(id, [...(perDoc.get(id) ?? []), op]);
    }
  }
  // Le foto: un asset scritto nel file deve esistere su Sanity (verificatori del 3/11), o la
  // transazione fallirebbe con un messaggio che non dice perché.
  if (assetUsati.size) {
    const esistono = new Set(
      await client.fetch<string[]>(`*[_type == "sanity.imageAsset" && _id in $ids]._id`, {
        ids: [...assetUsati.keys()],
      }),
    );
    for (const { asset, chiave } of assetMancanti(assetUsati, esistono))
      esitoDelFile.get(chiave)?.problemi.push({
        livello: "errore",
        chiave,
        campo: "pagina",
        messaggio: `foto: l'asset ${asset} non esiste su Sanity`,
      });
  }
  // Le impronte: quelle già su Sanity, con le lingue di questo giro aggiornate.
  for (const [id, ops] of perDoc) {
    const doc = pub.find((d) => d._id === id);
    const vecchie = (doc?.loadedHashes as Array<{ lang: string; hash: string }> | undefined) ?? [];
    const nuove = impronte.get(id) ?? new Map<string, string>();
    const lingue = [...new Set([...vecchie.map((h) => h.lang), ...nuove.keys()])].sort(
      perPuntoDiCodice,
    );
    const valore = lingue.map((l) => ({
      _type: "loadedHash",
      _key: l,
      lang: l,
      hash: nuove.get(l) ?? vecchie.find((h) => h.lang === l)?.hash,
    }));
    for (const op of ops) op.set.loadedHashes = valore;
  }
  return esiti;
}

/** Il giorno del carico, `AAAA-MM-GG` (Europe/Rome): il valore di `revisedAt` (Q10). */
const OGGI = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());

/** Le lingue che un post nuovo deve avere tutte nello stesso giro (Marco, 5/11/2026). */
const CINQUE_LINGUE: readonly LinguaFile[] = ["it", "en", "de", "fr", "es"];
/** L'id fisso di un post creato dal caricatore. */
const idPostNuovo = (slug: string) => `post-${slug}`;
/** I post creati in questo giro, id → slug: per i tag da invalidare. */
const creati = new Map<string, string>();
/** Un nome o un titolo da confrontare: minuscolo, senza spazi ai bordi. */
const piega = (s: unknown) => (typeof s === "string" ? s.toLocaleLowerCase("it").trim() : "");

/** I campi del post per lingua, col loro tipo: si creano se mancano, come la pagina d'uso. */
const OGGETTI_POST = {
  title: { _type: "localizedString" },
  excerpt: { _type: "localizedText" },
  body: { _type: "localizedPortableText" },
  seo: {
    _type: "seoFields",
    metaTitle: { _type: LOC.stringa },
    metaDescription: { _type: LOC.collezioni },
  },
} as const;

function oggettiMancantiPost(doc: Doc): { setIfMissing?: Record<string, unknown> } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(OGGETTI_POST)) {
    if (leggi(doc, k) === undefined) out[k] = v;
    else if (k === "seo")
      for (const figlio of ["metaTitle", "metaDescription"] as const)
        if (leggi(doc, `seo.${figlio}`) === undefined)
          out[`seo.${figlio}`] = OGGETTI_POST.seo[figlio];
  }
  return Object.keys(out).length ? { setIfMissing: out } : {};
}

/**
 * Gli articoli del blog (`--sezione=post`, Q13): un file per post e lingua, letto, controllato e
 * trasformato nei campi di quella lingua del post con lo stesso slug. Il post deve esistere: il
 * caricatore non ne crea. Quando una lingua cambia, la stessa operazione scrive `revisedAt` col giorno
 * del carico (Q10): le operazioni dello stesso documento si uniscono, il valore è uno.
 */
async function articoli(pub: Doc[], conBozza: Set<string>): Promise<Esito[]> {
  const esiti: Esito[] = [];
  const resolve = (type: string, slug: string) =>
    pub.find((d) => d._type === type && d.slug === slug)?._id;
  const slugDi = new Map(pub.map((d) => [d._id, typeof d.slug === "string" ? d.slug : undefined]));
  const assetUsati = new Map<string, string[]>();
  const esitoDelFile = new Map<string, Esito>();
  /** I link già aperti in questo giro, col loro stato: lo stesso percorso si chiede una volta. */
  const stati = new Map<string, number>();
  /** I file dei post che non esistono ancora, per slug e lingua: si creano alla fine, insieme. */
  const nuovi = new Map<string, Map<string, { file: ArticoloFile; e: Esito; chiave: string }>>();

  for (const lang of LINGUE) {
    const dir = join(CARTELLA_POST, lang);
    if (!existsSync(dir)) continue;
    for (const nome of readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort(perPuntoDiCodice)) {
      const e: Esito = {
        sezione: "post",
        lang,
        voci: 1,
        problemi: [],
        operazioni: [],
        invariate: 0,
        bozze: [],
        nonTrovate: [],
      };
      esiti.push(e);
      const chiave = `${lang}/${nome}`;
      esitoDelFile.set(chiave, e);
      const segna = (livello: Problema["livello"], messaggio: string) =>
        e.problemi.push({ livello, chiave, campo: "post", messaggio });
      const { file, problems } = parseArticoloFile(readFileSync(join(dir, nome), "utf8"), resolve);
      for (const p of problems) segna(p.level === "error" ? "errore" : "avviso", p.message);
      if (!file) continue;
      if (file.lang !== lang) segna("errore", `lang «${file.lang}» in una cartella «${lang}»`);
      const doc = pub.find((d) => d._type === "post" && d.slug === file.slug);
      const id = doc?._id ?? idPostNuovo(file.slug);
      const otherDescriptions = pub
        .filter((d) => d._id !== id)
        .map((d) => leggi(d, `seo.metaDescription.${lang}`))
        .filter((x): x is string => typeof x === "string");
      for (const p of checkArticolo(file, {
        // Un post nuovo non ha ancora un autore su Sanity: lo risolve la creazione, per nome.
        autore: doc && typeof doc.autore === "string" ? doc.autore : undefined,
        otherDescriptions,
      }))
        segna(p.level === "error" ? "errore" : "avviso", p.message);

      // I link interni, aperti sul sito nella lingua del file (Q12).
      for (const l of linkInterni(file.body)) {
        const percorso = percorsoNellaLingua(l.route, l.ref ? slugDi.get(l.ref) : undefined, lang);
        if (!stati.has(percorso)) {
          const r = await fetch(new URL(percorso, SITO), { redirect: "manual" }).catch(() => null);
          stati.set(percorso, r?.status ?? 0);
        }
        const s = stati.get(percorso);
        if (s !== 200)
          segna("errore", `link ${percorso}: risponde ${s || "niente (rete)"}, non 200`);
      }

      if (!doc) {
        // Un post che non c'è: si crea alla fine, con tutte le lingue dello stesso slug insieme.
        nuovi.set(file.slug, (nuovi.get(file.slug) ?? new Map()).set(lang, { file, e, chiave }));
        continue;
      }
      if (Object.keys(file.creazione).length || file.copertinaAlt)
        segna(
          "avviso",
          "il post esiste già: copertina, categoria, pubblicato e copertina.alt non si toccano",
        );
      if (conBozza.has(doc._id)) {
        e.bozze.push(chiave);
        continue;
      }
      const { fields, hash } = articoloFields(file);
      const live = contentFingerprint({
        title: leggi(doc, `title.${lang}`),
        excerpt: leggi(doc, `excerpt.${lang}`),
        body: leggi(doc, `body.${lang}`),
        seoTitle: leggi(doc, `seo.metaTitle.${lang}`),
        seoDescription: leggi(doc, `seo.metaDescription.${lang}`),
      });
      if (live === hash) {
        e.invariate++;
        continue;
      }
      for (const b of file.body) {
        const ref = (b as { image?: { asset?: { _ref?: string } } }).image?.asset?._ref;
        if (ref) assetUsati.set(ref, [...(assetUsati.get(ref) ?? []), chiave]);
      }
      e.operazioni.push({
        id: doc._id,
        rev: doc._rev,
        label: `${file.slug} (${lang})`,
        set: {
          [`title.${lang}`]: fields.title,
          [`excerpt.${lang}`]: fields.excerpt,
          [`body.${lang}`]: fields.body,
          [`seo.metaTitle.${lang}`]: fields.seoTitle,
          [`seo.metaDescription.${lang}`]: fields.seoDescription,
          revisedAt: OGGI,
        },
        ...oggettiMancantiPost(doc),
      });
    }
  }

  // I post nuovi (c2, Marco, 5/11/2026): nascono dalle chiavi del file italiano, con tutte le lingue
  // insieme e senza `revisedAt` («Aggiornato il» non compare alla nascita). Un documento solo, con
  // id fisso: un secondo giro trova il post e lo aggiorna invece di farne un altro.
  for (const [slug, perLingua] of nuovi) {
    const files = new Map([...perLingua].map(([l, x]) => [l, x.file]));
    const it = perLingua.get("it");
    if (!it || !Object.keys(it.file.creazione).length) {
      for (const x of perLingua.values())
        x.e.nonTrovate.push(
          `${x.chiave} (slug «${slug}»; per crearlo: copertina, categoria e pubblicato nel file italiano)`,
        );
      continue;
    }
    const segna = (livello: Problema["livello"], messaggio: string) =>
      it.e.problemi.push({ livello, chiave: it.chiave, campo: "post nuovo", messaggio });
    for (const p of checkCreazione(files, { lingue: CINQUE_LINGUE, oggi: OGGI }))
      segna(p.level === "error" ? "errore" : "avviso", p.message);
    const autore = pub.find(
      (d) => d._type === "author" && piega(d.name) === piega(it.file.autore),
    )?._id;
    if (!autore) segna("errore", `autore «${it.file.autore}» non trovato su Sanity`);
    const { categoria, copertina, pubblicato } = it.file.creazione;
    const idCategoria = pub.find(
      (d) => d._type === "category" && piega(leggi(d, "title.it")) === piega(categoria),
    )?._id;
    if (categoria && !idCategoria)
      segna("errore", `categoria «${categoria}» non trovata (il titolo italiano su Sanity)`);
    if (copertina) assetUsati.set(copertina, [...(assetUsati.get(copertina) ?? []), it.chiave]);
    for (const x of perLingua.values())
      for (const a of assetRefs(x.file.body))
        assetUsati.set(a, [...(assetUsati.get(a) ?? []), x.chiave]);
    if (!autore || !idCategoria || !copertina || !pubblicato) continue;

    const id = idPostNuovo(slug);
    const crea = {
      _id: id,
      _type: "post",
      slug: { _type: "slug", current: slug },
      author: { _type: "reference", _ref: autore },
      categories: [{ _type: "reference", _key: idCategoria, _ref: idCategoria }],
      coverImage: copertinaNuova(copertina, it.file.copertinaAlt ?? ""),
      publishedAt: publishedAtDi(pubblicato),
      featured: false,
      ...OGGETTI_POST,
    };
    creati.set(id, slug);
    for (const [l, x] of perLingua) {
      const { fields } = articoloFields(x.file);
      x.e.operazioni.push({
        id,
        rev: "",
        label: `${slug} (${l}, nuovo)`,
        set: {
          [`title.${l}`]: fields.title,
          [`excerpt.${l}`]: fields.excerpt,
          [`body.${l}`]: fields.body,
          [`seo.metaTitle.${l}`]: fields.seoTitle,
          [`seo.metaDescription.${l}`]: fields.seoDescription,
          [`coverImage.altI18n.${l}`]: x.file.copertinaAlt,
        },
        crea,
      });
    }
  }
  if (assetUsati.size) {
    const esistono = new Set(
      await client.fetch<string[]>(`*[_type == "sanity.imageAsset" && _id in $ids]._id`, {
        ids: [...assetUsati.keys()],
      }),
    );
    for (const { asset, chiave } of assetMancanti(assetUsati, esistono))
      esitoDelFile.get(chiave)?.problemi.push({
        livello: "errore",
        chiave,
        campo: "post",
        messaggio: `foto: l'asset ${asset} non esiste su Sanity`,
      });
  }
  return esiti;
}

(RIPRISTINA ? ripristinaCampi(client, RIPRISTINA, RADICE, ESEGUI) : main())
  .then((n) => process.exit(n ? 1 : 0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
