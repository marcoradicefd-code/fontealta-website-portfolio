/**
 * 2026-08-27-alt-bonifica.ts — one-shot: bonifica degli `alt` delle 580 immagini
 * prodotto (563 `model.primaryImage`, 17 `concealedBody.image`).
 *
 * Quattro difetti, approvati da Marco in blocco: em dash rivolto all'utente,
 * «Freetanding» (refuso di «Freestanding»), «Aisi» (la grafia del catalogo è
 * «AISI»), doppi spazi.
 *
 * LA SORGENTE È IL FILE, NON QUESTO SCRIPT. `alt-bonifica-2026-08-27-v2.json` è
 * il dry-run già rivisto: i valori `after` si applicano come stanno. Lo script non
 * trasforma niente — non ha una sola regola di riscrittura, e non deve averla:
 * il giorno che la avesse, il file smetterebbe di essere la fonte di verità e
 * nessuno saprebbe più quale dei due ha prodotto il testo in produzione.
 *
 * ⚠️ PROPRIO PER QUESTO c'è la guardia 4. Se il post-audit deve chiudere a zero
 * su tutti e quattro i difetti, allora scrivere `after` che quei difetti li
 * contengono ancora è un errore da fermare PRIMA, non una sorpresa dopo 580
 * scritture. Lo script confronta gli `after` con i criteri dichiarati e
 * abortisce se non li soddisfano, dicendo esattamente quali voci e perché.
 *
 * Il `-v2` nel nome non è cosmetico: la prima versione del file correggeva il
 * SOLO em dash e lasciava 27 «Aisi», 2 «Freetanding» e 6 doppi spazi negli
 * `after`. La guardia 2 l'ha fermata prima di qualunque scrittura. Il file
 * committato qui è quello effettivamente applicato — nessuna ambiguità su quale
 * dei due abbia prodotto il testo che sta in produzione.
 *
 * Si patcha il PUBBLICATO: nessuna bozza, `perspective: "published"` in lettura
 * e patch dirette in scrittura.
 *
 *   pnpm tsx scripts/one-shot/2026-08-27-alt-bonifica.ts            # DRY-RUN
 *   pnpm tsx scripts/one-shot/2026-08-27-alt-bonifica.ts --apply    # SCRIVE
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(HERE, "..", "..", ".env.local") });

const APPLY = process.argv.includes("--apply");
const DATA =
  process.argv.find((a) => a.endsWith(".json")) ?? resolve(HERE, "alt-bonifica-2026-08-27-v2.json");

/** 580 patch in una transazione sola sono un payload scomodo. */
const BATCH = 50;

/** Attesi, e verificati in coda: se cambiano, qualcosa è successo fuori da qui.
 *  I default sono quelli del giro del 27/08: senza flag lo script si comporta
 *  esattamente come allora. Un giro successivo li DICHIARA da riga di comando —
 *  la guardia resta viva, cambia solo il numero contro cui asserisce. Derivarli
 *  dal file li renderebbe tautologici, che è come non averli. */
const numArg = (nome: string, def: number): number => {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`));
  if (!a) return def;
  const n = Number(a.slice(a.indexOf("=") + 1));
  if (!Number.isInteger(n) || n < 0) abort(`--${nome} non è un intero >= 0: "${a}"`);
  return n;
};
const ATTESI = {
  totale: numArg("attesi-totale", 580),
  model: numArg("attesi-model", 563),
  concealedBody: numArg("attesi-body", 17),
  /** Alt totali sulle tre famiglie. 0 = non dichiarato → riga informativa. */
  alt: numArg("attesi-alt", 0),
};

/** I quattro difetti. `split` e non regex: una regex sbagliata torna 0 e sembra
 *  una buona notizia. */
const DIFETTI: { nome: string; ago: string }[] = [
  { nome: "em dash", ago: "—" },
  { nome: "«Freetanding»", ago: "Freetanding" },
  { nome: "«Aisi»", ago: "Aisi" },
  { nome: "doppi spazi", ago: "  " },
];
const conta = (s: string | null | undefined, ago: string) => (s ?? "").split(ago).length - 1;

/** Le TRE forme ammesse per `field`. La terza è arrivata il 31/08 con la
 *  galleria: `images[_key=="…"].alt` è path notation su un elemento di array, e
 *  Sanity la accetta in `set` come qualunque altro percorso. È l'UNICA aggiunta
 *  al resolver: lo script continua a non conoscere nessuna regola di riscrittura. */
const CAMPO_OK = /^(primaryImage\.alt|image\.alt|images\[_key=="[^"]+"\]\.alt)$/;

interface Voce {
  _id: string;
  field: string;
  before: string;
  after: string;
}

function abort(msg: string, detail?: unknown): never {
  console.error(`\n✖ ABORT — ${msg}`);
  if (detail !== undefined) console.error(detail);
  process.exit(1);
}

async function main() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = APPLY ? process.env.SANITY_WRITE_TOKEN : process.env.SANITY_API_READ_TOKEN;
  if (!projectId || !dataset) abort("NEXT_PUBLIC_SANITY_PROJECT_ID/DATASET assenti");
  if (!token) abort(APPLY ? "SANITY_WRITE_TOKEN assente" : "SANITY_API_READ_TOKEN assente");

  const client: SanityClient = createClient({
    projectId,
    dataset,
    apiVersion: "2024-10-01",
    useCdn: false,
    token,
    perspective: "published",
  });

  const voci: Voce[] = JSON.parse(readFileSync(DATA, "utf8"));
  console.log(`\n${APPLY ? "⚠️  ESECUZIONE" : "DRY-RUN"} · bonifica alt immagini prodotto`);
  console.log(`  dataset:  ${projectId}/${dataset}`);
  console.log(`  sorgente: ${DATA.split("/").slice(-2).join("/")}  (${voci.length} voci)\n`);

  // ── GUARDIA 1 · forma del file ──────────────────────────────────────────────
  if (voci.length !== ATTESI.totale)
    abort(`il file ha ${voci.length} voci, attese ${ATTESI.totale}`);
  const malformate = voci.filter(
    (v) => !v._id || !v.field || typeof v.before !== "string" || typeof v.after !== "string",
  );
  if (malformate.length) abort(`${malformate.length} voci malformate`, malformate.slice(0, 5));
  // Il duplicato si conta su `_id|field`, non su `_id`: un documento con la
  // galleria compare legittimamente più volte, una per `_key`. Con la sola `_id`
  // un file di 23 voci su 12 modelli veniva respinto come «11 duplicati».
  // Il senso della guardia resta: due patch sullo STESSO bersaglio.
  const dup = voci.length - new Set(voci.map((v) => `${v._id}|${v.field}`)).size;
  if (dup) abort(`${dup} bersagli duplicati nel file (stesso _id e stesso field)`);
  const bozze = voci.filter((v) => v._id.startsWith("drafts."));
  if (bozze.length)
    abort(`${bozze.length} _id di bozza nel file: si patcha il pubblicato`, bozze.slice(0, 5));
  const campiIgnoti = voci.filter((v) => !CAMPO_OK.test(v.field));
  if (campiIgnoti.length)
    abort(`campi non previsti`, [...new Set(campiIgnoti.map((v) => v.field))]);
  const inutili = voci.filter((v) => v.before === v.after);
  if (inutili.length)
    abort(`${inutili.length} voci con before === after: patch a vuoto`, inutili.slice(0, 5));
  console.log(
    `  guardia 1 · forma del file ....... ok  (${voci.filter((v) => v.field === "primaryImage.alt").length} primaryImage.alt · ${voci.filter((v) => v.field === "image.alt").length} image.alt · ${voci.filter((v) => v.field.startsWith("images[")).length} images[].alt)`,
  );

  // ── GUARDIA 2 · gli `after` reggono il post-audit? ───────────────────────────
  // Non è pedanteria: il post-audit dichiarato chiude a zero su tutti e quattro
  // i difetti. Se gli `after` non ci arrivano, fallirebbe DOPO aver scritto.
  const residui = DIFETTI.map((d) => ({
    ...d,
    voci: voci.filter((v) => conta(v.after, d.ago) > 0),
  })).filter((d) => d.voci.length > 0);
  if (residui.length) {
    console.error("\n✖ ABORT — gli `after` del file non sono puliti su tutti e quattro i difetti.");
    console.error("  Il post-audit di questo script pretende ZERO su ognuno: scrivere questi");
    console.error("  valori significherebbe fallirlo per costruzione, dopo 580 patch.");
    console.error("  Lo script NON riscrive i valori da sé, per scelta: la fonte è il file.\n");
    for (const d of residui) {
      console.error(`  ${d.nome}: ${d.voci.length} voci`);
      for (const v of d.voci.slice(0, 4)) console.error(`    ${v._id}\n      "${v.after}"`);
      if (d.voci.length > 4) console.error(`    … e altre ${d.voci.length - 4}`);
    }
    console.error("\n  Serve un file con quei valori già corretti, oppure la conferma che");
    console.error("  quei tre difetti restano fuori da questo giro (e allora il post-audit");
    console.error("  va ridefinito prima di eseguire).\n");
    process.exit(1);
  }
  console.log("  guardia 2 · after puliti ......... ok");

  // ── GUARDIA 3 · il `before` è ancora quello che c'è in produzione? ───────────
  // Si leggono TUTTE E TRE le famiglie e si risolve per CAMPO. Il vecchio
  // `coalesce(primaryImage.alt, image.alt)` non vedeva la galleria: con un file di
  // sole voci `images[]` avrebbe dato 23 «diversi» e un abort che sembrava un
  // guasto del dato invece che della lettura.
  const vivi: {
    _id: string;
    p: string | null;
    i: string | null;
    g: { _key: string; alt: string | null }[] | null;
  }[] = await client.fetch(
    `*[_id in $ids]{ _id, "p": primaryImage.alt, "i": image.alt, "g": images[]{ _key, alt } }`,
    { ids: voci.map((v) => v._id) },
  );
  const perId = new Map(vivi.map((r) => [r._id, r]));
  /** `undefined` = documento o elemento assente; `null` = c'è ma senza alt. */
  const vivo = (v: Voce): string | null | undefined => {
    const doc = perId.get(v._id);
    if (!doc) return undefined;
    if (v.field === "primaryImage.alt") return doc.p;
    if (v.field === "image.alt") return doc.i;
    const key = v.field.match(/_key=="([^"]+)"/)?.[1];
    const el = doc.g?.find((x) => x._key === key);
    return el ? el.alt : undefined;
  };
  const assenti = voci.filter((v) => vivo(v) === undefined);
  const diversi = voci.filter((v) => vivo(v) !== undefined && vivo(v) !== v.before);
  const ok = voci.length - assenti.length - diversi.length;
  console.log(
    `  guardia 3 · before === live ...... ${ok} ok · ${diversi.length} diversi · ${assenti.length} assenti`,
  );

  if (diversi.length || assenti.length) {
    console.error("\n✖ ABORT — il dato vivo non corrisponde al file. NON scrivo.\n");
    for (const v of assenti.slice(0, 10)) console.error(`  ASSENTE  ${v._id}`);
    for (const v of diversi.slice(0, 10)) {
      console.error(`  DIVERSO  ${v._id}`);
      console.error(`    file:  "${v.before}"`);
      console.error(`    live:  "${vivo(v)}"`);
    }
    const resto =
      assenti.length + diversi.length - Math.min(10, assenti.length) - Math.min(10, diversi.length);
    if (resto > 0) console.error(`  … e altre ${resto}`);
    process.exit(1);
  }

  const bozzePrima: number = await client.fetch(
    `count(*[_id in path("drafts.**") && (_type == "model" || _type == "concealedBody")])`,
  );
  console.log(`  bozze model/concealedBody prima .. ${bozzePrima}`);

  if (!APPLY) {
    console.log(
      `\n  DRY-RUN: nessuna scrittura. Pronte ${voci.length} patch su ${Math.ceil(voci.length / BATCH)} transazioni.`,
    );
    console.log(
      `  Per eseguire: pnpm tsx ${DATA.includes("/") ? "scripts/one-shot/2026-08-27-alt-bonifica.ts" : DATA} --apply\n`,
    );
    return;
  }

  // ── SCRITTURA ───────────────────────────────────────────────────────────────
  console.log(`\n  scrittura in ${Math.ceil(voci.length / BATCH)} transazioni da ${BATCH}\n`);
  let scritte = 0;
  for (let i = 0; i < voci.length; i += BATCH) {
    const blocco = voci.slice(i, i + BATCH);
    let tx = client.transaction();
    for (const v of blocco) tx = tx.patch(v._id, (p) => p.set({ [v.field]: v.after }));
    await tx.commit({ visibility: "sync" });
    scritte += blocco.length;
    console.log(
      `  blocco ${String(i / BATCH + 1).padStart(2)}/${Math.ceil(voci.length / BATCH)} · ${blocco.length} patch · totale ${scritte}/${voci.length}`,
    );
  }

  // ── POST-AUDIT ──────────────────────────────────────────────────────────────
  console.log("\n  post-audit (rilettura dal dataset)\n");
  // POST-AUDIT ESTESO alle TRE famiglie di alt. Contare i difetti sul solo
  // `coalesce(primaryImage, image)` lascerebbe fuori la galleria: chiuderebbe a
  // zero mentre l'em dash è ancora lì, che è il modo peggiore di sbagliare — un
  // verde che non guarda dove sta il difetto.
  const docs: {
    _id: string;
    tipo: string;
    p: string | null;
    i: string | null;
    g: { _key: string; alt: string | null }[] | null;
  }[] = await client.fetch(
    `*[(_type == "model" && defined(primaryImage.asset)) || (_type == "concealedBody" && defined(image.asset))]{
       _id, "tipo": _type, "p": primaryImage.alt, "i": image.alt, "g": images[]{ _key, alt }
     }`,
  );
  /** Un elemento per ALT, non per documento: i conteggi dei difetti girano qui. */
  const dopo: { _id: string; tipo: string; field: string; alt: string }[] = [];
  for (const d of docs) {
    if (typeof d.p === "string")
      dopo.push({ _id: d._id, tipo: d.tipo, field: "primaryImage.alt", alt: d.p });
    if (typeof d.i === "string")
      dopo.push({ _id: d._id, tipo: d.tipo, field: "image.alt", alt: d.i });
    for (const el of d.g ?? [])
      if (typeof el.alt === "string")
        dopo.push({
          _id: d._id,
          tipo: d.tipo,
          field: `images[_key=="${el._key}"].alt`,
          alt: el.alt,
        });
  }
  // La chiave è `_id|field` e non `_id`: in un file di galleria lo stesso
  // documento compare più volte, e con la sola `_id` le voci si sovrascriverebbero
  // fra loro — 23 attese diventerebbero 12 confronti.
  const atteso = new Map(voci.map((v) => [`${v._id}|${v.field}`, v.after]));
  const perTipo = (t: string) => docs.filter((r) => r.tipo === t).length;
  const esatti = dopo.filter(
    (r) => atteso.has(`${r._id}|${r.field}`) && r.alt === atteso.get(`${r._id}|${r.field}`),
  ).length;
  const bozzeDopo: number = await client.fetch(
    `count(*[_id in path("drafts.**") && (_type == "model" || _type == "concealedBody")])`,
  );

  const righe: [string, number, number | null][] = [
    ["alt con after esatto", esatti, ATTESI.totale],
    ["alt totali (3 famiglie)", dopo.length, ATTESI.alt || null],
    ["model con immagine", perTipo("model"), ATTESI.model],
    ["concealedBody con immagine", perTipo("concealedBody"), ATTESI.concealedBody],
    ["bozze create", bozzeDopo - bozzePrima, 0],
    ...DIFETTI.map(
      (d) =>
        [d.nome, dopo.reduce((s, r) => s + conta(r.alt, d.ago), 0), 0] as [string, number, number],
    ),
  ];
  let rotte = 0;
  for (const [nome, valore, atteso2] of righe) {
    // `null` = riga informativa: un numero che si riporta ma su cui non si è
    // dichiarata un'attesa. Non può far fallire, e non finge di essere un verde.
    if (atteso2 === null) {
      console.log(`  · ${nome.padEnd(28)} ${String(valore).padStart(4)}  (non dichiarato)`);
      continue;
    }
    const buono = valore === atteso2;
    if (!buono) rotte++;
    console.log(
      `  ${buono ? "✓" : "✖"} ${nome.padEnd(28)} ${String(valore).padStart(4)}  (atteso ${atteso2})`,
    );
  }
  if (rotte) abort(`${rotte} verifiche del post-audit non tornano`);
  console.log("\n  ✓ post-audit tutto verde.\n");
}

main().catch((e) => abort("eccezione non gestita", e));
