/**
 * scripts/i18n/faq-carica.ts <lingua> [--dir <cartella>] [--execute (--solo=<code,…> | --all)]
 * scripts/i18n/faq-carica.ts <lingua> --ripristina=<file> [--execute]
 *
 * Legge i file delle FAQ di una lingua (`<cartella>/<lingua>/*.md`, di default
 * `docs/content/faq`) e dice, file per file, cosa scriverebbe su Sanity: domande, parole,
 * controlli della risposta (spec FAQ § 2.2), link interni risolti, doppioni nella lingua, prezzi.
 *
 * ⚠️ **Dry-run di default.** Con `--execute` scrive sul PUBBLICATO il solo percorso
 * `faq.<lingua>`, con `ifRevisionId`: è l'operazione del publish per campi, senza il passaggio
 * dalla bozza, perché le FAQ non hanno una rilettura in Studio da fare (si rileggono nei file e
 * nel dry-run). Le pagine principali e quelle d'uso che non esistono si creano coi soli `code`,
 * `kind` e `faq` (le pagine d'uso dalla c1a del 3/11/2026).
 * `--execute` vuole `--solo=<code>` o `--all`, scritto apposta: la prima scrittura si fa su un
 * documento solo (spec § 11).
 *
 * ⚠️ **Non si scrive:** un file con anche un solo errore (tranne le domande bloccate, sotto); una
 * pagina con una bozza o una versione, perché chi la pubblicasse dopo porterebbe via le FAQ. **Un
 * doppione ferma tutto il giro.**
 *
 * Una domanda con «DA VERIFICARE» (nel testo o in un commento `<!-- -->`) è **bloccata**: non si
 * scrive, e le altre del file passano. I commenti non arrivano mai su Sanity.
 *
 * ⚠️ **Una risposta cambiata in Studio non si sovrascrive** (spec § 11): se la FAQ su Sanity ha
 * domande senza impronta, o con un'impronta che non combacia più col contenuto, il documento si
 * segnala e non si scrive.
 *
 * ⚠️ **Blocco ottimistico:** ogni scrittura porta `ifRevisionId` sul `_rev` letto (la creazione usa
 * `create`, che fallisce se il documento c'è già). Un 409 ferma quel documento e non si riprova:
 * il client scrive con `maxRetries: 0`, e le altre pagine proseguono.
 *
 * ⚠️ **Con `--solo`** prima di scrivere si mostra il diff esatto di `faq.<lingua>` (prima e dopo) e
 * si chiede conferma: a terminale, o con `--conferma=<codice>` quando non c'è un terminale (il
 * codice lo stampa il giro senza conferma, e vale solo per quel diff). **Con `--all`** serve
 * l'export del dataset del giorno, `tmp/backup/production-AAAA-MM-GG.tar.gz` (`pnpm sanity:export`).
 *
 * **`pnpm faq:verifica <lingua>`** (questo script con `--verifica`, sola lettura) confronta le FAQ
 * pubblicate coi file, domanda per domanda: si lancia dopo ogni ondata e una settimana dopo. Tre
 * esiti, separati: domande mancanti o in più, testo diverso (errori, exit code diverso da 0), e
 * l'ordine diverso, che è un avviso con la pagina e l'ordine (2/11/2026).
 *
 * **Indietro:** prima di scrivere si salva in `tmp/faq-scritture/` cosa c'era (`faq.<lingua>` di
 * ogni pagina e la revisione dopo la scrittura). `--ripristina=<file>` lo rimette, dry-run di
 * default, solo dove la revisione è ancora la nostra; non cancella mai un documento.
 *
 * Uso:  pnpm faq:carica it                                         (dry-run)
 *       pnpm faq:carica en --dir tmp/faq-ondata-1                  (i file di un'ondata)
 *       pnpm faq:carica it --dir tmp/faq-ondata-1 --execute --solo=boss
 *       pnpm faq:carica en --dir docs/content/pagine-uso/faq        (le FAQ delle pagine d'uso)
 *       pnpm faq:carica it --ripristina=tmp/faq-scritture/<file>.json --execute
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

import {
  blocksToText,
  contentPageId,
  faqPageRoute,
  MAIN_PAGES,
  USE_PAGES,
} from "../../sanity/lib/faq-rules";
import { claimsAllStainless, mentionsMeasure } from "../../sanity/lib/pagina-uso-rules";
import {
  buildFaqFile,
  compareFaq,
  contentHash,
  faqComparisonFails,
  crossDuplicates,
  decideFaqWrite,
  pagesForRun,
  parseFaqFile,
  restoreOp,
  trovaPaginaFaq,
  type BuiltItem,
  type DupPage,
  type FaqComparison,
  type FaqWrite,
} from "./faq-md";
import {
  exportDiOggi,
  invalidaTag,
  pubblicato,
  radiceId,
  stampaTag,
  type DocScritto,
} from "./carico-lib";
import { LINGUE, type Lingua } from "./lib";
import { britishWord } from "./pagina-uso-md";
import { percorsoSicuro } from "./manifest";
import { deepEqual } from "./publish";

loadEnv({ path: ".env.local" });

const argv = process.argv.slice(2);
const valore = (nome: string) => argv.find((a) => a.startsWith(`${nome}=`))?.slice(nome.length + 1);
const lingua: Lingua | undefined = LINGUE.find((l) => l === argv.find((a) => !a.startsWith("-")));
const dirArg = argv.indexOf("--dir");
const cartella = join(dirArg > 0 && argv[dirArg + 1] ? argv[dirArg + 1] : "docs/content/faq");
const ESEGUI = argv.includes("--execute");
/** Con `--execute`: invalida i tag stampati dall'API di Vercel (serve `VERCEL_TOKEN`; rule `cache-isr`). */
const INVALIDA = argv.includes("--invalida");
const SOLO = valore("--solo")
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const TUTTI = argv.includes("--all");
const RIPRISTINA = valore("--ripristina");
const CONFERMA = valore("--conferma");
const VERIFICA = argv.includes("--verifica");
const RADICE_SCRITTURE = join(process.cwd(), "tmp", "faq-scritture");
/** In `--verifica` il rapporto file per file non si stampa: conta il confronto. */
const log = VERIFICA ? () => {} : console.log;

const uso = `pnpm faq:carica <${LINGUE.join("|")}> [--dir <cartella>] [--execute (--solo=<code,…> | --all) [--invalida]] · [--ripristina=<file> [--execute]]`;
if (!lingua) {
  console.error(`✖ Uso: ${uso}`);
  process.exit(1);
}
if (SOLO?.some((c) => !/^[a-z0-9-]+$/.test(c))) {
  console.error("✖ --solo accetta solo code separati da virgole");
  process.exit(1);
}
if (INVALIDA && (!ESEGUI || RIPRISTINA)) {
  console.error("✖ --invalida va con --execute: in dry-run i tag si stampano e basta");
  process.exit(1);
}
if (VERIFICA && (ESEGUI || RIPRISTINA)) {
  console.error("✖ --verifica è in sola lettura: niente --execute né --ripristina");
  process.exit(1);
}
if (ESEGUI && !RIPRISTINA && !SOLO && !TUTTI) {
  console.error(
    "✖ --execute senza --solo scrive TUTTE le pagine: serve anche --all, scritto apposta",
  );
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
  // Nessun nuovo tentativo da solo: un 409 o un errore di rete su una scrittura si legge, non si ripete.
  maxRetries: 0,
  ...(token ? { token, perspective: "raw" as const } : { perspective: "published" as const }),
});

interface Target {
  _id: string;
  _rev: string;
  _type: string;
  code?: string;
  title?: string;
  faq?: Partial<Record<Lingua, Array<BuiltItem & { loadedHash?: string }>>>;
}

/** Il verbale di una scrittura: cosa c'era prima, per poterlo rimettere. */
interface Scrittura {
  lang: Lingua;
  quando: string;
  voci: Array<{
    id: string;
    action: "create" | "patch";
    before?: unknown;
    hasFaq: boolean;
    revDopo?: string;
    /** Perché la scrittura non è avvenuta (un 409). */
    fermata?: string;
  }>;
}

/** Le domande già su Sanity che lo script non ha scritto, o che in Studio sono cambiate. */
function changedInStudio(items: Array<BuiltItem & { loadedHash?: string }> | undefined): string[] {
  return (items ?? [])
    .filter((i) => !i.loadedHash || contentHash(i) !== i.loadedHash)
    .map((i) => i.question);
}

/** L'id del documento che una scrittura tocca. */
const idOf = (w: FaqWrite) =>
  w.action === "create" ? w.doc._id : w.action === "patch" ? w.id : "";

async function main(lang: Lingua) {
  const dir = join(cartella, lang);
  if (!existsSync(dir)) throw new Error(`cartella assente: ${dir}`);
  const data = await client.fetch<{
    pages: Target[];
    slugs: Array<{ _id: string; _type: string; slug: string }>;
  }>(
    `{
      "pages": *[_type in ["collection", "contentPage"]]{ _id, _rev, _type, code, title, faq },
      "slugs": *[_type in ["collection", "concealedBody", "model", "post", "projectReference"] && defined(slug.current)]{
        _id, _type, "slug": slug.current
      }
    }`,
  );
  const bySlug = new Map(
    data.slugs.filter((d) => pubblicato(d._id)).map((d) => [`${d._type}:${d.slug}`, d._id]),
  );
  const names = data.pages.filter((p) => p._type === "collection" && p.title).map((p) => p.title!);
  const pages = data.pages.filter((p) => pubblicato(p._id));
  const conBozza = new Set(
    data.pages.filter((p) => !pubblicato(p._id)).map((p) => radiceId(p._id)),
  );

  let errori = 0;
  let avvisi = 0;
  let bloccate = 0;
  const lette: DupPage[] = [];
  const piano: Array<{
    label: string;
    code: string;
    kind: string;
    write: FaqWrite;
    built: BuiltItem[];
    live?: BuiltItem[];
    exists: boolean;
  }> = [];
  for (const nome of readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const { file, errors } = parseFaqFile(readFileSync(join(dir, nome), "utf-8"));
    log(`\n■ ${lang}/${nome}`);
    for (const e of errors) log(`  ✖ ${e}`);
    errori += errors.length;
    if (!file) continue;
    // Gli errori che fermano il file: tutti, tranne quelli delle domande bloccate.
    let delFile = errors.length;
    const segnala = (level: "error" | "warning" | "info", message: string) => {
      log(`  ${level === "error" ? "✖" : level === "warning" ? "⚠" : "·"} ${message}`);
      if (level === "error") {
        errori++;
        delFile++;
      }
      if (level === "warning") avvisi++;
    };
    if (file.lang !== lang) segnala("error", `lang «${file.lang}» in una cartella «${lang}»`);

    const fisse = file.kind === "main" ? MAIN_PAGES : file.kind === "use" ? USE_PAGES : undefined;
    const id = fisse ? contentPageId(file.code) : undefined;
    const target =
      file.kind === "collection"
        ? pages.find((p) => p._type === "collection" && p.code === file.code)
        : fisse
          ? pages.find((p) => p._id === id)
          : undefined;
    if (fisse && !fisse.some((p) => p.code === file.code))
      segnala(
        "error",
        `«${file.code}» non è una delle pagine ${file.kind === "use" ? "d'uso" : "principali"}`,
      );
    else if (fisse && !target) segnala("info", `${id} non esiste ancora: si creerebbe`);
    else if (file.kind === "collection" && !target)
      segnala("error", `nessuna collezione con code «${file.code}»`);
    else if (!["collection", "main", "use"].includes(file.kind))
      segnala("error", `kind «${file.kind}» sconosciuto`);
    log(`  → ${target ? `${target._type} ${target._id}` : "—"}`);

    const titolo = file.kind === "collection" ? target?.title : undefined;
    const report = buildFaqFile(
      file,
      titolo ? ["Fontealta", titolo] : ["Fontealta"],
      (type, slug) => bySlug.get(`${type}:${slug}`),
      faqPageRoute(
        file.kind,
        file.code,
        target && file.kind === "collection"
          ? { _id: target._id, slug: data.slugs.find((d) => d._id === target._id)?.slug }
          : undefined,
      ),
    );
    for (const p of report.problems) log(`  ${p.level === "error" ? "✖" : "⚠"} ${p.message}`);
    report.items.forEach((it, i) => {
      log(`  ${i + 1}. ${it.question} · ${it.words} parole${it.blocked ? " · BLOCCATA" : ""}`);
      for (const p of it.problems) log(`     ${p.level === "error" ? "✖" : "⚠"} ${p.message}`);
    });
    // Le FAQ della pagina d'uso seguono anche le regole di contenuto della pagina (spec
    // `seo-pagine-contenuto.md` § 4; verificatore del 3/11): niente misure, mai «tutto inox», e in
    // inglese l'americano.
    if (file.kind === "use")
      for (const it of report.built) {
        const testo = `${it.question}\n${blocksToText(it.answer)}`;
        if (mentionsMeasure(testo)) segnala("error", `«${it.question}»: una misura nella risposta`);
        if (claimsAllStainless(testo)) segnala("error", `«${it.question}»: «tutto inox»`);
        const w = lang === "en" ? britishWord(testo) : undefined;
        if (w) segnala("warning", `«${it.question}»: inglese britannico «${w}»`);
      }
    bloccate += report.items.filter((i) => i.blocked).length;
    const tutti = [...report.problems, ...report.items.flatMap((i) => i.problems)];
    errori += tutti.filter((p) => p.level === "error").length;
    avvisi += tutti.filter((p) => p.level === "warning").length;
    delFile += [
      ...report.problems,
      ...report.items.filter((i) => !i.blocked).flatMap((i) => i.problems),
    ].filter((p) => p.level === "error").length;

    const cambiate = changedInStudio(target?.faq?.[lang]);
    if (cambiate.length)
      segnala(
        "error",
        `${cambiate.length} domande su Sanity non scritte da qui o cambiate in Studio: non si sovrascrive`,
      );
    lette.push({
      label: `${lang}/${nome}`,
      page: target?._id ?? id ?? `${lang}/${nome}`,
      own: titolo,
      questions: file.items.map((i) => i.question),
    });
    piano.push({
      label: `${lang}/${nome}`,
      code: file.code,
      kind: file.kind,
      built: report.built,
      live: target?.faq?.[lang],
      exists: Boolean(target),
      write: decideFaqWrite({
        kind: file.kind,
        code: file.code,
        lang,
        id,
        target,
        hasDraft: conBozza.has(target?._id ?? id ?? ""),
        errors: delFile,
        built: report.built,
      }),
    });
  }

  const scelti = SOLO ? piano.filter((p) => SOLO.includes(p.code)) : piano;
  const ignoti = SOLO?.filter((c) => !piano.some((p) => p.code === c)) ?? [];
  if (ignoti.length) {
    console.error(`\n✖ --solo: nessun file con code ${ignoti.join(", ")}`);
    return 1;
  }

  // I doppioni nella lingua: fra i file, e fra i file e le FAQ già su Sanity di altre pagine. Si
  // tolgono le FAQ su Sanity delle sole pagine che questo giro scrive (`pagesForRun`).
  const scritte = new Set(
    scelti.flatMap(({ write: w }) =>
      w.action === "create" ? [w.doc._id] : w.action === "patch" ? [w.id] : [],
    ),
  );
  const suSanity = data.pages
    .filter((p) => (p.faq?.[lang]?.length ?? 0) > 0)
    .map((p) => ({
      label: `Sanity ${p._id}`,
      page: radiceId(p._id),
      own: p._type === "collection" ? p.title : undefined,
      questions: p.faq![lang]!.map((i) => i.question),
    }));
  const doppie = crossDuplicates(pagesForRun(suSanity, lette, scritte), names);
  log(`\n■ doppioni in «${lang}»: ${doppie.length || "nessuno"}`);
  for (const d of doppie) log(`  ✖ «${d.question}»: ${d.first} e ${d.second}`);
  errori += doppie.length;
  log(`\n■ scrittura${SOLO ? ` (solo ${SOLO.join(", ")})` : ""}`);
  for (const p of scelti) {
    const w = p.write;
    log(
      w.action === "skip"
        ? `  · ${p.label}: si salta, ${w.reason}`
        : `  → ${p.label}: ${w.action === "create" ? `crea ${w.doc._id}` : `faq.${lang} su ${w.id}`} (${p.built.length} domande)`,
    );
  }
  log(
    `\n  ${lette.length} file · ${lette.reduce((s, f) => s + f.questions.length, 0)} domande · ${errori} errori (${bloccate} domande bloccate) · ${avvisi} avvisi${token ? "" : " · senza token: bozze non viste"}`,
  );

  // Tipo e slug di una pagina scritta, per i suoi tag (una pagina principale nuova non ha slug).
  const trova = trovaPaginaFaq(data.pages, data.slugs);
  if (VERIFICA) return verifica(lang, piano);
  if (!ESEGUI) {
    stampaTag(
      scelti.filter((p) => p.write.action !== "skip").map((p) => idOf(p.write)),
      trova,
    );
    console.log("  DRY-RUN: nessuna scrittura\n");
    return errori;
  }
  if (doppie.length) {
    console.error("\n✖ Un doppione ferma tutto il giro: nessuna scrittura.\n");
    return 1;
  }
  return scrivi(
    lang,
    scelti.filter((p) => p.write.action !== "skip"),
    trova,
  );
}

/** Il segno di una pagina nella verifica: ✖ se fallisce, ⚠ se cambia solo l'ordine, ✔ se è uguale. */
function segnoVerifica(c: FaqComparison): string {
  if (faqComparisonFails(c)) return "✖";
  if (c.order) return "⚠";
  return "✔";
}

/** Le righe di una pagina nella verifica: il segno, poi ogni differenza, l'ordine per ultimo. */
function stampaVerifica(label: string, domande: number, c: FaqComparison): void {
  const segno = segnoVerifica(c);
  console.log(`  ${segno} ${label}: ${domande} domande${segno === "✔" ? " uguali" : ""}`);
  for (const q of c.missing) console.log(`     manca su Sanity: «${q}»`);
  for (const q of c.extra) console.log(`     in più su Sanity: «${q}»`);
  for (const q of c.changed) console.log(`     testo diverso: «${q}»`);
  if (c.order)
    console.log(
      `     ⚠ solo l'ordine: su Sanity le domande del file stanno come ${c.order.join(" ")}`,
    );
}

/** Le FAQ pubblicate contro i file, domanda per domanda. */
function verifica(
  lang: Lingua,
  piano: Array<{
    label: string;
    kind: string;
    built: BuiltItem[];
    live?: BuiltItem[];
    exists: boolean;
  }>,
): number {
  let sbagliate = 0;
  let ordine = 0;
  const conta = { missing: 0, extra: 0, changed: 0 };
  console.log(`\n■ verifica «${lang}»: le FAQ pubblicate contro i file`);
  for (const p of piano) {
    if (!p.exists) {
      sbagliate++;
      console.log(`  ✖ ${p.label}: pagina assente su Sanity`);
      continue;
    }
    const c = compareFaq(p.built, p.live);
    if (faqComparisonFails(c)) sbagliate++;
    if (c.order) ordine++;
    conta.missing += c.missing.length;
    conta.extra += c.extra.length;
    conta.changed += c.changed.length;
    stampaVerifica(p.label, p.built.length, c);
  }
  console.log(
    `\n  ${piano.length} file · ${conta.missing} mancanti · ${conta.extra} in più · ${conta.changed} testi diversi · ${ordine} pagine con l'ordine diverso (avviso) · sola lettura\n`,
  );
  return sbagliate;
}

/**
 * Il diff di `faq.<lingua>`, prima e dopo, per ogni pagina, e il codice che lo conferma: lo
 * stesso diff dà lo stesso codice, un documento cambiato nel frattempo ne dà un altro.
 */
function mostraDiff(
  lang: Lingua,
  daScrivere: Array<{ label: string; write: FaqWrite; built: BuiltItem[] }>,
): string {
  const dir = join(RADICE_SCRITTURE, "diff");
  mkdirSync(dir, { recursive: true });
  const firma = createHash("sha256");
  for (const { label, write, built } of daScrivere) {
    const id = write.action === "create" ? write.doc._id : write.action === "patch" ? write.id : "";
    const prima = write.action === "patch" ? write.before : undefined;
    const a = join(dir, `${id}-${lang}-prima.json`);
    const b = join(dir, `${id}-${lang}-dopo.json`);
    writeFileSync(a, `${JSON.stringify(prima ?? null, null, 2)}\n`, "utf-8");
    writeFileSync(b, `${JSON.stringify(built, null, 2)}\n`, "utf-8");
    console.log(
      `\n■ ${label} → ${id}, faq.${lang} (${write.action === "create" ? "pagina nuova" : `rev ${write.action === "patch" ? write.rev : ""}`})`,
    );
    try {
      // Percorso assoluto, non il PATH: il programma lanciato è quello di sistema (Sonar S4036).
      execFileSync(
        "/usr/bin/diff",
        ["-u", "--label", `prima faq.${lang}`, "--label", `dopo faq.${lang}`, a, b],
        {
          stdio: "inherit",
        },
      );
    } catch {
      // `diff` esce con 1 quando i file sono diversi: è il caso normale.
    }
    firma.update(
      `${id}|${write.action === "patch" ? write.rev : "nuova"}|${JSON.stringify(built)}`,
    );
  }
  return firma.digest("hex").slice(0, 8);
}

async function scrivi(
  lang: Lingua,
  daScrivere: Array<{ label: string; write: FaqWrite; built: BuiltItem[] }>,
  trova: (id: string) => DocScritto | undefined,
): Promise<number> {
  if (daScrivere.length === 0) {
    console.log("\n  Niente da scrivere.\n");
    return 0;
  }
  if (TUTTI) {
    const backup = exportDiOggi();
    if (!backup) {
      console.error(
        "\n✖ --all vuole l'export del dataset di oggi in tmp/backup/ (pnpm sanity:export): nessuna scrittura.\n",
      );
      return 1;
    }
    console.log(`\n  export del dataset: ${backup.perc}, ${backup.mb} MB`);
  }
  if (SOLO) {
    const codice = mostraDiff(lang, daScrivere);
    let ok = CONFERMA === codice;
    if (!ok && process.stdin.isTTY) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      ok =
        (await rl.question(`\n  Scrivo? Batti il codice ${codice} per confermare: `)).trim() ===
        codice;
      rl.close();
    }
    if (!ok) {
      console.log(
        `\n  Nessuna scrittura. ${CONFERMA ? "Il codice non corrisponde a questo diff. " : ""}Per scrivere questo diff: --conferma=${codice}\n`,
      );
      return 1;
    }
  }
  const quando = new Date().toISOString();
  mkdirSync(RADICE_SCRITTURE, { recursive: true });
  const perc = join(RADICE_SCRITTURE, `${quando.replace(/[:.]/g, "-")}-${lang}.json`);
  const verbale: Scrittura = { lang, quando, voci: [] };
  // Il verbale si scrive PRIMA della scrittura e dopo ognuna: se il processo muore, dice cosa c'era.
  const salva = () => writeFileSync(perc, JSON.stringify(verbale, null, 1), "utf-8");

  const scritte: typeof daScrivere = [];
  for (const item of daScrivere) {
    const { label, write, built } = item;
    if (write.action === "skip") continue;
    const voce: Scrittura["voci"][number] =
      write.action === "create"
        ? { id: write.doc._id, action: "create", hasFaq: false }
        : { id: write.id, action: "patch", before: write.before, hasFaq: write.hasFaq };
    verbale.voci.push(voce);
    salva();
    try {
      // ⚠️ Blocco ottimistico: `create` fallisce se la pagina c'è già, `ifRevisionId` se il
      // documento non è più quello letto. In tutti e due i casi il 409 ferma questa pagina.
      const r =
        write.action === "create"
          ? await client.create(write.doc, { visibility: "sync" })
          : await client
              .patch(write.id)
              .ifRevisionId(write.rev)
              .setIfMissing({ faq: {} })
              .set({ [`faq.${lang}`]: built })
              .commit({ visibility: "sync" });
      voce.revDopo = r._rev;
      scritte.push(item);
      console.log(`  ✔ ${label}`);
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode !== 409) {
        salva();
        // Le pagine già scritte prima dell'errore hanno comunque bisogno dei loro tag.
        stampaTag(
          scritte.map((x) => idOf(x.write)),
          trova,
        );
        throw e;
      }
      voce.fermata = "409: il documento è cambiato dopo la lettura, non si riprova";
      console.error(`  ✖ ${label}: ${voce.fermata}`);
    }
    salva();
  }
  const fermate = daScrivere.length - scritte.length;

  // La verifica legge il pubblicato e lo confronta con quello che doveva scrivere.
  const ids = verbale.voci.filter((v) => v.revDopo).map((v) => v.id);
  const letti = await client.fetch<Array<{ _id: string; faq?: Record<string, unknown> }>>(
    `*[_id in $ids]{ _id, faq }`,
    { ids },
  );
  let diversi = 0;
  for (const { write, built, label } of scritte) {
    const id = write.action === "create" ? write.doc._id : write.action === "patch" ? write.id : "";
    const ok = deepEqual(letti.find((d) => d._id === id)?.faq?.[lang], built);
    if (!ok) {
      diversi++;
      console.error(`  ✖ ${label}: su Sanity non è quello scritto`);
    }
  }
  console.log(
    `\n  ${scritte.length} pagine scritte · verificate ${scritte.length - diversi} · fermate dal 409 ${fermate} · verbale ${perc.replace(`${process.cwd()}/`, "")}\n`,
  );
  const tags = stampaTag(
    scritte.map((x) => idOf(x.write)),
    trova,
  );
  const nonInvalidati = INVALIDA && tags.length ? await invalidaTag(tags) : 0;
  return diversi + fermate + nonInvalidati;
}

/** Rimette `faq.<lingua>` com'era prima di una scrittura, dove nessuno l'ha toccata dopo. */
async function ripristina(lang: Lingua, file: string): Promise<number> {
  const verbale = JSON.parse(
    readFileSync(percorsoSicuro(file, RADICE_SCRITTURE), "utf-8"),
  ) as Scrittura;
  if (verbale.lang !== lang) throw new Error(`il verbale è di «${verbale.lang}», non di «${lang}»`);
  const letti = new Map(
    (
      await client.fetch<
        Array<{
          _id: string;
          _rev: string;
          _type: string;
          slug?: string;
          faq: Record<string, unknown> | null;
        }>
      >(`*[_id in $ids]{ _id, _rev, _type, "slug": slug.current, faq }`, {
        ids: verbale.voci.map((v) => v.id),
      })
    ).map((d) => [d._id, d]),
  );
  let saltate = 0;
  const rimessi: string[] = [];
  for (const v of verbale.voci) {
    const letto = letti.get(v.id);
    if (!v.revDopo || letto?._rev !== v.revDopo) {
      saltate++;
      console.log(`  · ${v.id}: toccato dopo la scrittura (o mai scritto), si lascia`);
      continue;
    }
    // Una pagina creata da qui resta: si toglie solo la FAQ. Nessun documento si cancella.
    const op = restoreOp(v, lang, letto.faq);
    console.log(
      `  → ${v.id}: ${"unset" in op ? `toglie ${op.unset.join(", ")}` : `rimette faq.${lang} di prima`}`,
    );
    if (!ESEGUI) continue;
    const patch = client.patch(v.id).ifRevisionId(v.revDopo);
    await ("unset" in op ? patch.unset(op.unset) : patch.set(op.set)).commit({
      visibility: "sync",
    });
    rimessi.push(v.id);
  }
  console.log(
    `\n  ${ESEGUI ? "ripristinate" : "DRY-RUN, si ripristinerebbero"} ${verbale.voci.length - saltate} · lasciate ${saltate}\n`,
  );
  // Un ripristino col webhook spento lascia la stessa cache vecchia di un carico (rule cache-isr).
  stampaTag(rimessi, (id) => letti.get(id));
  return saltate;
}

(RIPRISTINA ? ripristina(lingua, RIPRISTINA) : main(lingua))
  .then((n) => process.exit(n ? 1 : 0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
