/**
 * populate-descriptions.ts — one-shot: descrizioni EN mancanti + le 64 ILLE senza
 * descrizione in nessuna lingua. Mail Andrea 28/07 sera, punti 3+4.
 *
 * LA SCOPERTA A MONTE: i 20 controlli a campione di Andrea erano la punta di un
 * iceberg. 523 modelli hanno `description.en` = ARRAY VUOTO — non assente, VUOTO — e
 * una lente che cerca stringhe non lo vede; le 64 ILLE non hanno `description` in
 * nessuna lingua. Fonte: Contenuti_Sito-002.xlsx (colonne ITALIANO/ENGLISH).
 *
 * COSA SCRIVE
 *  - 522 modelli → SOLO `description.en` (l'italiano non si tocca);
 *  - 64 ILLE     → l'intero `description` { it, en };
 *  - 3 patch chirurgiche sul testo IT esistente di BJ.02, BJ.04, P22.S per la sola
 *    grafia «Body-Jet» → «Body Jet» / «body jet» (verdetto Andrea 28/07: il trattino
 *    è grafia vecchia). Sono l'unico punto in cui questo script tocca un testo che
 *    esiste già, ed è dichiarato: senza, dopo il giro resterebbero tre «Body-Jet» nei
 *    dati mentre le label e le 586 descrizioni nuove usano la grafia nuova.
 *
 * FUORI SCOPE, a verbale
 *  - WX47C.SK.K: assente dall'Excel → la sua EN resta vuota. È in lista domande per
 *    Andrea. Lo script lo IGNORA e lo dichiara, non lo inventa.
 *  - Le 258 divergenze IT fra Sanity ed Excel (quasi tutte apostrofi tipografici, più
 *    alcune vere su B76 e BW50.YCWS.*): l'IT NON si tocca in questo giro.
 *
 * ⚠️ MAI SOVRASCRIVERE. Ogni bersaglio deve avere OGGI il campo vuoto: se un
 * documento ha già testo dove stiamo per scrivere, si ABORTISCE con report. Vale
 * anche per le 3 patch, che agiscono su un testo atteso e verificato carattere per
 * carattere prima di scrivere.
 *
 *   pnpm tsx scripts/populate-descriptions.ts             # DRY-RUN
 *   pnpm tsx scripts/populate-descriptions.ts --execute   # SCRIVE
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(HERE, "..", ".env.local") });

const EXECUTE = process.argv.includes("--execute");
const DATA = resolve(HERE, "data", "descrizioni-en-ille-2026-07-29.json");
const BACKUP = resolve(HERE, "data", "descriptions-backup-2026-07-29.json");

/** Lotti della transazione: 586 patch in un colpo solo sono un payload scomodo. */
const BATCH = 100;

interface Row {
  _id: string;
  code: string;
  en: string;
  it?: string;
}
interface Source {
  meta: Record<string, unknown>;
  rows: Row[];
}

interface Span {
  _key: string;
  _type: "span";
  marks?: string[];
  text?: string;
}
interface Block {
  _key: string;
  _type: "block";
  children?: Span[];
  markDefs?: unknown[];
  style?: string;
}
interface LiveDoc {
  _id: string;
  code: string | null;
  description?: { _type?: string; it?: Block[]; en?: Block[] } | null;
}

/** Le 3 patch di grafia: testo ATTESO → testo nuovo. Il match è esatto. */
const GRAFIA_PATCHES: { code: string; da: string; a: string }[] = [
  { code: "BJ.02", da: "Body-Jet esterno Spray", a: "Body Jet esterno Spray" },
  { code: "BJ.04", da: "Body-Jet esterno Rain", a: "Body Jet esterno Rain" },
  {
    code: "P22.S",
    da: "Pannello doccia murale, con miscelatore, deviatore 5 vie, 6 body-jet orientabili, soffione",
    a: "Pannello doccia murale, con miscelatore, deviatore 5 vie, 6 body jet orientabili, soffione",
  },
];

// Stessa forma dei 531 fratelli già in produzione (verificata sul dato vivo):
// 1 block «normal», 1 span, `marks` e `markDefs` array vuoti, `_key` a 12 caratteri.
function randomKey(): string {
  return Math.random().toString(36).slice(2, 14);
}
function toBlock(text: string): Block {
  return {
    _type: "block",
    _key: randomKey(),
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: randomKey(), text, marks: [] }],
  };
}

const flat = (blocks?: Block[] | null): string =>
  (blocks ?? [])
    .flatMap((b) => (b.children ?? []).map((c) => c.text ?? ""))
    .join("")
    .trim();

function abort(msg: string, detail?: unknown): never {
  console.error(`\n✖ ABORT — ${msg}`);
  if (detail) console.error(detail);
  process.exit(1);
}

async function main() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = EXECUTE ? process.env.SANITY_WRITE_TOKEN : process.env.SANITY_API_READ_TOKEN;
  if (!projectId || !dataset) abort("NEXT_PUBLIC_SANITY_PROJECT_ID/DATASET assenti");
  if (!token) abort(EXECUTE ? "SANITY_WRITE_TOKEN assente" : "SANITY_API_READ_TOKEN assente");

  const client: SanityClient = createClient({
    projectId,
    dataset,
    apiVersion: "2024-10-01",
    useCdn: false,
    token,
    perspective: "published",
  });

  const src: Source = JSON.parse(readFileSync(DATA, "utf8"));
  const rows = src.rows;

  console.log(`\n${EXECUTE ? "⚠️  ESECUZIONE" : "DRY-RUN"} · descrizioni EN + ILLE\n`);
  console.log(`  sorgente: ${DATA.split("/").slice(-2).join("/")}  (${rows.length} righe)\n`);

  // ── GUARDIE ────────────────────────────────────────────────────────────────
  const ids = rows.map((r) => r._id);
  if (new Set(ids).size !== ids.length) abort("_id duplicati nel JSON");

  const live: LiveDoc[] = await client.fetch(
    `*[_type=="model" && _id in $ids]{_id, code, description}`,
    { ids },
  );
  const byId = new Map(live.map((d) => [d._id, d]));

  // I1 · corrispondenza 1:1 col dataset, zero orfani per lato.
  const orfaniJson = ids.filter((i) => !byId.has(i));
  if (orfaniJson.length) abort(`I1: ${orfaniJson.length} _id del JSON non esistono`, orfaniJson);

  const bersagliSanity: { _id: string; code: string | null }[] = await client.fetch(
    `*[_type=="model" && (count(description.en)==0 || !defined(description))]{_id, code}`,
  );
  const nonCoperti = bersagliSanity.filter((d) => !ids.includes(d._id));
  const FUORI_SCOPE = ["WX47C.SK.K"];
  const inattesi = nonCoperti.filter((d) => !FUORI_SCOPE.includes(d.code ?? ""));
  if (inattesi.length) {
    abort(
      `I1: ${inattesi.length} modelli con il campo vuoto NON sono nel JSON e non sono dichiarati fuori scope`,
      inattesi.map((d) => d.code),
    );
  }
  console.log(`✓ I1  ${rows.length} righe ↔ dataset, 0 orfani per lato`);
  console.log(
    `      fuori scope dichiarato: ${nonCoperti.map((d) => d.code).join(", ") || "nessuno"}`,
  );

  // I2 · il campo bersaglio è VUOTO oggi. Mai sovrascrivere.
  const occupati: string[] = [];
  const ille: LiveDoc[] = [];
  const soloEn: LiveDoc[] = [];
  for (const r of rows) {
    const d = byId.get(r._id)!;
    const hasIt = flat(d.description?.it).length > 0;
    const hasEn = flat(d.description?.en).length > 0;
    if (hasEn) occupati.push(`${r.code}: en già popolata «${flat(d.description?.en)}»`);
    if (r.it) {
      // Riga con IT ⇒ atteso documento SENZA description del tutto (le 64 ILLE).
      if (d.description != null && (hasIt || hasEn)) {
        occupati.push(`${r.code}: riga con IT ma il documento ha già description`);
      } else {
        ille.push(d);
      }
    } else {
      if (!hasIt) occupati.push(`${r.code}: riga senza IT ma il documento non ha IT da preservare`);
      else soloEn.push(d);
    }
  }
  if (occupati.length) abort(`I2: ${occupati.length} bersagli NON vuoti`, occupati.slice(0, 20));
  console.log(`✓ I2  tutti i bersagli sono vuoti — ${ille.length} ILLE, ${soloEn.length} solo-EN`);

  // I3 · struttura dei fratelli: 1 block / 1 span. Tripwire anti-modifica
  // concorrente: `multiBlocco` è già 0 sul dataset, quindi non deve scattare mai.
  const badShape = soloEn
    .filter((d) => {
      const b = d.description?.it;
      return !Array.isArray(b) || b.length !== 1 || (b[0].children ?? []).length !== 1;
    })
    .map((d) => d.code);
  if (badShape.length) abort(`I3: struttura Portable Text inattesa`, badShape.slice(0, 20));
  console.log(`✓ I3  1 block / 1 span sugli IT che restano intatti`);

  // I4 · le 3 patch di grafia: il testo atteso deve esserci ESATTAMENTE.
  const patchTargets: { doc: LiveDoc; blockKey: string; spanKey: string; a: string }[] = [];
  for (const p of GRAFIA_PATCHES) {
    const d = live.find((x) => x.code === p.code);
    if (!d) abort(`I4: ${p.code} non è fra i documenti caricati`);
    const cur = flat(d.description?.it);
    if (cur !== p.da) abort(`I4: ${p.code} testo IT inatteso`, { atteso: p.da, trovato: cur });
    const block = d.description!.it![0];
    patchTargets.push({
      doc: d,
      blockKey: block._key,
      spanKey: block.children![0]._key,
      a: p.a,
    });
  }
  console.log(`✓ I4  3 patch di grafia: testo atteso confermato carattere per carattere`);

  // I5 · nessun «Body-Jet» superstite nel sorgente.
  const bjSorgente = rows.filter((r) => /Body-Jet/i.test(`${r.en} ${r.it ?? ""}`));
  if (bjSorgente.length)
    abort(
      `I5: «Body-Jet» nel JSON`,
      bjSorgente.map((r) => r.code),
    );
  console.log(`✓ I5  zero «Body-Jet» nel sorgente\n`);

  // ── BACKUP ─────────────────────────────────────────────────────────────────
  const backup = live.map((d) => ({
    _id: d._id,
    code: d.code,
    description: d.description ?? null,
  }));
  writeFileSync(BACKUP, JSON.stringify({ generato: new Date(), docs: backup }, null, 2) + "\n");
  console.log(`✓ backup di ${backup.length} documenti → ${BACKUP.split("/").slice(-2).join("/")}`);

  // ── PIANO ──────────────────────────────────────────────────────────────────
  console.log(`\n── PIANO ──`);
  console.log(`  ${ille.length} ILLE      → description { it, en } intero`);
  console.log(`  ${soloEn.length} modelli   → SOLO description.en`);
  console.log(`  ${patchTargets.length} patch     → grafia Body-Jet sul testo IT esistente`);
  console.log(
    `  lotti da ${BATCH} → ${Math.ceil((rows.length + patchTargets.length) / BATCH)} transazioni`,
  );
  console.log(`\n  esempi:`);
  for (const r of [rows[0], rows.find((x) => x.it)!]) {
    console.log(`   ${r.code}  en «${r.en.slice(0, 60)}${r.en.length > 60 ? "…" : ""}»`);
    if (r.it) console.log(`          it «${r.it.slice(0, 60)}${r.it.length > 60 ? "…" : ""}»`);
  }
  for (const p of GRAFIA_PATCHES) console.log(`   ${p.code}  it «${p.da}» → «${p.a}»`);

  if (!EXECUTE) {
    console.log(`\n⏸  DRY-RUN: niente è stato scritto. Rilancia con --execute.\n`);
    return;
  }

  // ── SCRITTURA ──────────────────────────────────────────────────────────────
  const illeIds = new Set(ille.map((d) => d._id));
  let scritti = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const lotto = rows.slice(i, i + BATCH);
    let tx = client.transaction();
    for (const r of lotto) {
      if (illeIds.has(r._id)) {
        tx = tx.patch(r._id, (p) =>
          p.set({
            description: {
              _type: "localizedPortableText",
              it: [toBlock(r.it!)],
              en: [toBlock(r.en)],
            },
          }),
        );
      } else {
        tx = tx.patch(r._id, (p) => p.set({ "description.en": [toBlock(r.en)] }));
      }
    }
    await tx.commit({ visibility: "sync" });
    scritti += lotto.length;
    console.log(`  lotto ${Math.floor(i / BATCH) + 1}: ${lotto.length} doc (totale ${scritti})`);
  }

  // Patch di grafia in una transazione a parte: scopo diverso, e così un problema
  // qui non lascia a metà la scrittura delle descrizioni.
  let txp = client.transaction();
  for (const t of patchTargets) {
    txp = txp.patch(t.doc._id, (p) =>
      p.set({
        [`description.it[_key=="${t.blockKey}"].children[_key=="${t.spanKey}"].text`]: t.a,
      }),
    );
  }
  await txp.commit({ visibility: "sync" });
  console.log(`  patch grafia: ${patchTargets.length} doc`);

  // ── VERIFICA su GROQ FRESCHE ───────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 3000));
  const after = await client.fetch<{
    enVuote: number;
    illeSenza: number;
  }>(`{
    "enVuote": count(*[_type=="model" && count(description.en)==0]),
    "illeSenza": count(*[_type=="model" && !defined(description)])
  }`);

  // ⚠️ La grafia NON si verifica con GROQ `match`: quell'operatore è TOKENIZZATO,
  // e «Body-Jet» produce gli stessi token di «Body Jet» — il pattern continua a
  // matchare dopo la correzione, quindi non distingue il prima dal dopo. Misurato:
  // al primo giro ha riportato 4 residui su 0 reali, abortendo una scrittura andata
  // a buon fine. Qui si scaricano i testi e si cerca la sottostringa esatta.
  const testi = await client.fetch<{ code: string | null; it: string | null; en: string | null }[]>(
    `*[_type=="model"]{code, "it": pt::text(description.it), "en": pt::text(description.en)}`,
  );
  const conTrattino = testi.filter((m) => /body-jet/i.test(`${m.it ?? ""} ${m.en ?? ""}`));

  const fails: string[] = [];
  if (after.enVuote !== 1) fails.push(`enVuote atteso 1 (WX47C.SK.K), trovato ${after.enVuote}`);
  if (after.illeSenza !== 0)
    fails.push(`ILLE senza description atteso 0, trovato ${after.illeSenza}`);
  if (conTrattino.length !== 0)
    fails.push(
      `«Body-Jet» atteso 0, trovato ${conTrattino.length}: ${conTrattino.map((m) => m.code).join(", ")}`,
    );

  // Rete indipendente: le _key dei 3 patchati devono essere sopravvissute.
  const keyCheck = await client.fetch<{ code: string; k: string | null }[]>(
    `*[_type=="model" && code in $codes]{code, "k": description.it[0]._key}`,
    { codes: GRAFIA_PATCHES.map((p) => p.code) },
  );
  for (const t of patchTargets) {
    const now = keyCheck.find((x) => x.code === t.doc.code)?.k;
    if (now !== t.blockKey)
      fails.push(`${t.doc.code}: _key del block cambiata (${t.blockKey} → ${now})`);
  }

  console.log(`\n── VERIFICA (GROQ fresche) ──`);
  console.log(`  EN vuote residue        ${after.enVuote}  (atteso 1: WX47C.SK.K, fuori scope)`);
  console.log(`  ILLE senza description  ${after.illeSenza}  (atteso 0)`);
  console.log(
    `  «Body-Jet» nei dati     ${conTrattino.length}  (atteso 0, su ${testi.length} modelli)`,
  );
  console.log(
    `  _key preservate         ${fails.some((f) => f.includes("_key")) ? "NO ✗" : "sì ✓"}`,
  );

  if (fails.length) abort(`verifica fallita — il backup è su disco`, fails);
  console.log(`\n✓ fatto: ${scritti} descrizioni + ${patchTargets.length} patch di grafia\n`);
}

main().catch((e) => abort(e instanceof Error ? e.message : String(e)));
