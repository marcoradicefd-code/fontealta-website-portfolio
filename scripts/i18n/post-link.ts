/**
 * scripts/i18n/post-link.ts --dir <cartella> [--lingua=<l,…>] [--base=<url>] [--execute --all [--conferma=<codice>] [--invalida]]
 * scripts/i18n/post-link.ts --ripristina=<verbale> [--execute]
 *
 * Aggiunge ai corpi dei post **solo i link** che Cowork ha segnato nei `.md` leggibili
 * (`<cartella>/<lingua>/<slug>.md`, l'export per Cowork del 4/11/2026), nelle cinque lingue,
 * italiano compreso (Marco, 4/11/2026, Q16 del grill della c1). Le regole stanno in
 * `post-link-md.ts`: il testo non cambia di un carattere, nessun link si toglie, i percorsi sono
 * quelli della lingua del file.
 *
 * ⚠️ **Dry-run di default.** Con `--execute --all` scrive sul PUBBLICATO il solo `body.<lingua>`, con
 * `ifRevisionId`, dopo il diff e il codice di conferma, con l'export del dataset del giorno, verbale
 * in `tmp/post-link-scritture/` e `--ripristina`, come `contenuti:carica` (`carico-lib.ts`). Un post
 * con una bozza o una versione non si scrive: chi la pubblicasse dopo porterebbe via i link.
 *
 * `--base=<url>` chiede ogni percorso nuovo al sito (`https://…/de/gartendusche`) e vuole 200:
 * la verifica prima del carico (Marco, 4/11/2026).
 *
 * Uso:  pnpm post:link --dir tmp/ingressi/post/leggibile                     (dry-run)
 *       pnpm post:link --dir … --base=https://fontealta-website-sigma.vercel.app
 *       pnpm post:link --dir … --execute --all --conferma=<codice>
 *       pnpm post:link --ripristina=tmp/post-link-scritture/<file>.json --execute
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

import {
  codiceConferma,
  exportDiOggi,
  invalidaTag,
  leggiPercorso,
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
import { perPuntoDiCodice } from "./ordine";
import { aggiungiLink, parsePostFile, type PostBlock } from "./post-link-md";

loadEnv({ path: ".env.local", quiet: true });

const argv = process.argv.slice(2);
const valore = (nome: string) => argv.find((a) => a.startsWith(`${nome}=`))?.slice(nome.length + 1);
const dirArg = argv.indexOf("--dir");
const CARTELLA = dirArg >= 0 ? argv[dirArg + 1] : undefined;
const LINGUE = valore("--lingua")?.split(",") ?? ["it", "en", "de", "fr", "es"];
const BASE = valore("--base")?.replace(/\/$/, "");
const ESEGUI = argv.includes("--execute");
const TUTTI = argv.includes("--all");
const INVALIDA = argv.includes("--invalida");
const RIPRISTINA = valore("--ripristina");
const CONFERMA = valore("--conferma");
const RADICE = join(process.cwd(), "tmp", "post-link-scritture");

if (!RIPRISTINA && !CARTELLA) {
  console.error("✖ Uso: pnpm post:link --dir <cartella> [--execute --all]");
  process.exit(1);
}
if (ESEGUI && !RIPRISTINA && !TUTTI) {
  console.error("✖ --execute vuole anche --all, scritto apposta");
  process.exit(1);
}
if (INVALIDA && (!ESEGUI || RIPRISTINA)) {
  console.error("✖ --invalida va con --execute --all");
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

type Post = {
  _id: string;
  _rev: string;
  _type: string;
  slug?: string;
  title?: Record<string, string>;
  body?: Record<string, PostBlock[]>;
};

async function main(): Promise<number> {
  const file = LINGUE.flatMap((lang) => {
    const dir = join(CARTELLA!, lang);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort(perPuntoDiCodice)
      .map((nome) => ({
        chiave: `${lang}/${nome}`,
        lang,
        ...parsePostFile(readFileSync(join(dir, nome), "utf-8")),
      }));
  });
  const ids = [...new Set(file.flatMap((f) => (f.file ? [f.file.id] : [])))];
  const dati = await client.fetch<{
    posts: Post[];
    slugs: Array<{ _id: string; _type: string; slug: string }>;
  }>(
    `{
      "posts": *[_type == "post" && (_id in $ids || _id in $bozze || _id in path("versions.**"))]{ _id, _rev, _type, "slug": slug.current, title, body },
      "slugs": *[_type in ["collection", "concealedBody", "model", "post", "projectReference"] && defined(slug.current)]{ _id, _type, "slug": slug.current }
    }`,
    { ids, bozze: ids.map((i) => `drafts.${i}`) },
  );
  const esistenti = new Set(
    dati.slugs.filter((d) => pubblicato(d._id)).map((d) => `${d._type}:${d.slug}`),
  );
  const conBozza = new Set(
    dati.posts.filter((p) => !pubblicato(p._id)).map((p) => radiceId(p._id)),
  );
  const docs = new Map(dati.posts.filter((p) => pubblicato(p._id)).map((p) => [p._id, p]));

  let errori = 0;
  const ops: Operazione[] = [];
  const percorsi = new Set<string>();
  for (const f of file) {
    console.log(`\n■ ${f.chiave}`);
    for (const e of f.errors) console.log(`  ✖ ${e}`);
    errori += f.errors.length;
    if (!f.file) continue;
    if (f.file.lang !== f.lang) {
      console.log(`  ✖ lang «${f.file.lang}» in una cartella «${f.lang}»`);
      errori++;
      continue;
    }
    const doc = docs.get(f.file.id);
    if (!doc) {
      console.log(`  ✖ nessun post pubblicato con id ${f.file.id}`);
      errori++;
      continue;
    }
    const r = aggiungiLink(
      f.file,
      { title: doc.title?.[f.lang], body: doc.body?.[f.lang] },
      (type, slug) => esistenti.has(`${type}:${slug}`),
    );
    for (const a of r.avvisi) console.log(`  · ${a}`);
    for (const e of r.errori) console.log(`  ✖ ${e}`);
    for (const n of r.nuovi) console.log(`  + «${n.testo}» → ${n.href}`);
    if (conBozza.has(doc._id)) {
      console.log("  ✖ il post ha una bozza o una versione: si pubblica o si scarta prima quella");
      errori++;
    }
    errori += r.errori.length;
    for (const n of r.nuovi) percorsi.add(n.href);
    if (!r.body) {
      if (!r.nuovi.length && !r.errori.length) console.log("  · nessun link nuovo");
      continue;
    }
    const op = operazione(doc, `${f.chiave}`, { [`body.${f.lang}`]: r.body }, {});
    if (op) ops.push(op);
  }

  // La verifica dei percorsi nuovi sul sito: 200, senza seguire i redirect.
  if (BASE)
    for (const p of [...percorsi].sort(perPuntoDiCodice)) {
      const r = await fetch(`${BASE}${p}`, { redirect: "manual" });
      console.log(`  ${r.status === 200 ? "✔" : "✖"} ${r.status} ${p}`);
      if (r.status !== 200) errori++;
    }

  const daScrivere = unisciPerDocumento(ops);
  const codice = codiceConferma(daScrivere);
  console.log(
    `\n  ${file.length} file · ${ops.length} lingue da scrivere su ${daScrivere.length} post · ${percorsi.size} percorsi${BASE ? " verificati" : " (verifica con --base)"} · ${errori} errori · ${ESEGUI ? "SCRITTURA" : "DRY-RUN, nessuna scrittura"}\n`,
  );
  const trova = (id: string) => {
    const d = docs.get(id);
    return d ? { _type: d._type, slug: d.slug ?? null } : undefined;
  };
  if (!ESEGUI) {
    stampaTag(
      daScrivere.map((o) => o.id),
      trova,
    );
    if (daScrivere.length) console.log(`  codice di conferma di questo diff: ${codice}\n`);
    return errori;
  }
  if (errori) {
    console.error("✖ ci sono errori: nessuna scrittura");
    return 1;
  }
  if (!exportDiOggi()) {
    console.error("✖ --all vuole l'export del dataset di oggi in tmp/backup/ (pnpm sanity:export)");
    return 1;
  }
  if (!(await confermato(daScrivere, docs, codice))) return 1;
  const revisioni = new Map<string, string>();
  let problemi = 0;
  let tags: string[] = [];
  try {
    const r = await scriviCampi(client, "post-link", daScrivere, RADICE, docs, revisioni);
    problemi += r.problemi;
    console.log(
      `  ${daScrivere.length} scritture, ${r.problemi} problemi · verbale ${r.verbale.replace(`${process.cwd()}/`, "")}`,
    );
  } finally {
    tags = stampaTag([...revisioni.keys()], trova);
  }
  if (INVALIDA && tags.length) problemi += await invalidaTag(tags);
  return problemi;
}

/** Il diff di ogni post, prima e dopo, e il codice che lo conferma (come `contenuti:carica`). */
async function confermato(
  operazioni: readonly Operazione[],
  docs: Map<string, Post>,
  codice: string,
) {
  if (!operazioni.length) return true;
  const dir = join(RADICE, "diff", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  for (const op of operazioni) {
    const prima = Object.fromEntries(
      percorsiToccati(op).map((p) => [p, leggiPercorso(docs.get(op.id), p) ?? null]),
    );
    const a = join(dir, `${op.id}-prima.json`);
    const b = join(dir, `${op.id}-dopo.json`);
    writeFileSync(a, `${JSON.stringify(prima, null, 2)}\n`, "utf-8");
    writeFileSync(b, `${JSON.stringify(op.set, null, 2)}\n`, "utf-8");
    console.log(`\n■ ${op.label} → ${op.id} (rev ${op.rev})`);
    try {
      // Percorso assoluto, non il PATH: il programma lanciato è quello di sistema (Sonar S4036).
      execFileSync("/usr/bin/diff", ["-u", "--label", "prima", "--label", "dopo", a, b], {
        stdio: "inherit",
      });
    } catch {
      // `diff` esce con 1 quando i file sono diversi: è il caso normale.
    }
  }
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

(RIPRISTINA ? ripristinaCampi(client, RIPRISTINA, RADICE, ESEGUI) : main())
  .then((n) => process.exit(n ? 1 : 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
