/**
 * scripts/i18n/publish-content.ts <lingua> [<lingua> …] [--dry-run | --execute] [--ids=a,b] [--all]
 *
 * Porta sul PUBBLICATO i soli campi delle lingue richieste, presi dalle bozze nostre, e scarta o
 * riallinea le bozze. La logica sta in `publish.ts`; qui ci sono la riga di comando, il client e
 * le stampe.
 *
 * ⚠️ **Non pubblica mai una bozza come tale.** Fino al 15/09/2026 questo script usava
 * `sanity.action.document.publish`, che pubblica la bozza intera: le bozze nostre sono copie del
 * pubblicato al momento della creazione, e tutto ciò che è cambiato sul pubblicato dopo (le foto
 * dei 54 modelli Boss, per esempio) sarebbe tornato indietro.
 *
 * ⚠️ **Pubblicare è l'unica operazione di questa famiglia che si VEDE sul sito**, appena la lingua
 * è in `ACTIVE_LOCALES`. Tre cancelli: il dry-run di default; solo gli id dei manifest, mai una
 * query; e `--execute` senza `--ids` vuole anche `--all`, perché un publish di tutto non deve
 * poter partire per distrazione.
 *
 * Uso:  pnpm i18n:publish de                                  (dry-run, tutte le voci aperte)
 *       pnpm i18n:publish de --execute --ids=model-b40l,model-b40lm
 *       pnpm i18n:publish de fr es --execute --all
 */

import { readFileSync } from "node:fs";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

import { LINGUE, validaLingua, type Lingua } from "./lib";
import {
  chiudiGiro,
  giroCorrente,
  idBozza,
  idPubblicato,
  perIlLog,
  radiceManifest,
  salvaManifest,
  type Giro,
  type Manifest,
} from "./manifest";
import {
  planDocument,
  publishByFields,
  runIsComplete,
  verifyPlan,
  type DocumentPlan,
  type OpenRun,
  type Operation,
  type SanityDocument,
} from "./publish";
import { aLotti, attendiIndice, commitConBackoff } from "./sanity-batch";

loadEnv({ path: ".env.local" });

const argv = process.argv.slice(2);
const ESEGUI = argv.includes("--execute");

const CONFIGURAZIONE = ((): { lingue: Lingua[]; ids?: string[]; tutti: boolean } => {
  try {
    // ⚠️ I dati della riga di comando diventano chiavi di query e percorsi di file: si
    // controllano PRIMA di usarli, in un posto solo.
    const noti = new Set(["--execute", "--dry-run", "--all"]);
    const ignoti = argv.filter(
      (a) => a.startsWith("--") && !noti.has(a) && !a.startsWith("--ids="),
    );
    if (ignoti.length > 0) throw new Error(`opzioni sconosciute: ${ignoti.join(" ")}`);
    if (ESEGUI && argv.includes("--dry-run"))
      throw new Error("o --dry-run o --execute, non tutti e due");
    const lingue = [
      ...new Set(argv.filter((a) => !a.startsWith("--")).map((a) => validaLingua(a))),
    ];
    if (lingue.length === 0) throw new Error("serve almeno una lingua");
    if (lingue.includes("it")) throw new Error("l'italiano è la fonte, non una destinazione");
    const idsArg = argv.find((a) => a.startsWith("--ids="))?.slice("--ids=".length);
    const ids = idsArg
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids?.some((id) => !/^[A-Za-z0-9._-]+$/.test(id)))
      throw new Error("--ids accetta solo id di documento separati da virgole");
    const tutti = argv.includes("--all");
    if (ESEGUI && !ids && !tutti)
      throw new Error("--execute senza --ids pubblica TUTTO: serve anche --all, scritto apposta");
    return { lingue, ids, tutti };
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`);
    console.error(
      `  Uso: pnpm i18n:publish <${LINGUE.filter((x) => x !== "it").join("|")}> […] [--dry-run | --execute] [--ids=a,b] [--all]`,
    );
    process.exit(1);
  }
})();

// ⚠️ **Si caricano i giri aperti di TUTTE le lingue, non solo di quelle richieste.** Una bozza
// porta anche le lingue non pubblicate: la loro firma serve a riconoscerla, e dopo un publish
// parziale va aggiornata sulla bozza riallineata.
const giri: Array<OpenRun & { giro: Giro }> = [];
for (const lingua of LINGUE.filter((l) => l !== "it")) {
  const giro = giroCorrente(radiceManifest(), lingua);
  if (!giro) continue;
  giri.push({
    lingua,
    giro,
    manifest: JSON.parse(readFileSync(giro.manifest, "utf-8")) as Manifest,
  });
}
const senzaGiro = CONFIGURAZIONE.lingue.filter((l) => !giri.some((g) => g.lingua === l));
if (senzaGiro.length > 0) {
  console.error(`✖ Nessun giro aperto per: ${senzaGiro.join(", ")}`);
  process.exit(1);
}

// Gli id da considerare: le voci nostre, non saltate e non pubblicate delle lingue richieste.
const candidati: string[] = [];
for (const lingua of CONFIGURAZIONE.lingue) {
  const run = giri.find((g) => g.lingua === lingua)!;
  for (const v of run.manifest.voci)
    if (v.nostra && !v.saltata && !v.publishedAt && !candidati.includes(idPubblicato(v.id)))
      candidati.push(idPubblicato(v.id));
}
let IDS = candidati;
if (CONFIGURAZIONE.ids) {
  const richiesti = CONFIGURAZIONE.ids.map(idPubblicato);
  const fuori = richiesti.filter((id) => !candidati.includes(id));
  if (fuori.length > 0) {
    console.error(`✖ Id senza una voce aperta nelle lingue richieste: ${fuori.join(", ")}`);
    process.exit(1);
  }
  IDS = richiesti;
}

console.log(`\n  lingue: ${CONFIGURAZIONE.lingue.join(", ")} · documenti: ${IDS.length}`);
for (const g of giri) console.log(`  giro ${g.lingua}: ${perIlLog(g.giro.manifest)}`);

const token = ESEGUI
  ? process.env.SANITY_WRITE_TOKEN
  : (process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_API_READ_TOKEN);
if (!token) {
  console.error(
    ESEGUI
      ? "\n  ✖ Manca SANITY_WRITE_TOKEN\n"
      : "\n  ✖ Manca SANITY_WRITE_TOKEN (o SANITY_API_READ_TOKEN per il dry-run)\n",
  );
  process.exit(1);
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01",
  token,
  useCdn: false,
});

/** Legge `raw`, perché è l'unica prospettiva che vede bozze e pubblicati insieme. */
async function leggi(ids: readonly string[]): Promise<Map<string, SanityDocument>> {
  const docs = await client
    .withConfig({ perspective: "raw" })
    .fetch<SanityDocument[]>(`*[_id in $ids]`, { ids: [...ids] });
  return new Map(docs.map((d) => [d._id, d]));
}

async function committa(operations: readonly Operation[]): Promise<string> {
  const tx = client.transaction();
  for (const op of operations) {
    if (op.kind === "delete") {
      tx.delete(op.id);
      continue;
    }
    tx.patch(op.id, (p) => {
      let q = p.ifRevisionId(op.ifRevisionId);
      if (op.set && Object.keys(op.set).length > 0) q = q.set(op.set);
      if (op.unset && op.unset.length > 0) q = q.unset(op.unset);
      return q;
    });
  }
  // ⚠️ `deferred`, come l'import: la verifica si fa dopo l'attesa dell'indice, con `raw`.
  return commitConBackoff(tx, { visibility: "deferred" });
}

const riga = (p: DocumentPlan) =>
  `    ${p.action === "publish" ? "↑" : "·"} ${p.id.padEnd(28)} ${p.languages.join("+").padEnd(9)} bozza ${p.draft.padEnd(10)} ${p.reason}`;

async function dryRun() {
  const piani: DocumentPlan[] = [];
  for (const lotto of aLotti(IDS)) {
    const docs = await leggi(lotto.flatMap((id) => [id, idBozza(id)]));
    for (const id of lotto)
      piani.push(
        planDocument({
          id,
          languages: CONFIGURAZIONE.lingue,
          runs: giri,
          draft: docs.get(idBozza(id)),
          published: docs.get(id),
        }),
      );
  }
  const pubblica = piani.filter((p) => p.action === "publish");
  console.log(
    `\n  DRY-RUN, sullo stato letto adesso: ${pubblica.length} da pubblicare · ${piani.length - pubblica.length} saltati`,
  );
  for (const p of piani.slice(0, 40)) console.log(riga(p));
  if (piani.length > 40) console.log(`    … e altri ${piani.length - 40}`);
  console.log(
    `\n  campi da copiare sul pubblicato: ${pubblica.reduce((n, p) => n + Object.keys((p.operations[0] as { set?: object }).set ?? {}).length, 0)}` +
      ` · bozze da scartare: ${pubblica.filter((p) => p.draft === "discarded").length}` +
      ` · da riallineare: ${pubblica.filter((p) => p.draft === "realigned").length}`,
  );
  console.log("\n  Nessuna scrittura. Rilanciare con --execute per pubblicare.\n");
}

async function esegui() {
  const piani = await publishByFields({
    ids: IDS,
    languages: CONFIGURAZIONE.lingue,
    runs: giri,
    now: () => new Date().toISOString(),
    io: {
      read: leggi,
      commit: committa,
      isRevisionConflict: (e) =>
        (e as { statusCode?: number; response?: { statusCode?: number } })?.statusCode === 409 ||
        (e as { response?: { statusCode?: number } })?.response?.statusCode === 409,
      pause: () => new Promise((r) => setTimeout(r, 120)),
    },
    onBatch: (i, plans, transactionId) => {
      // ⚠️ Dopo ogni lotto, come l'import: un processo che muore a metà lascia manifest veri.
      for (const g of giri) salvaManifest(g.giro.manifest, g.manifest);
      console.log(
        `    lotto ${i + 1} — ${plans.filter((p) => p.action === "publish").length} pubblicati · tx ${transactionId ?? "nessuna"}`,
      );
    },
    onConflict: (i, attempt) =>
      console.log(`    lotto ${i + 1}: conflitto di revisione, rileggo e riprovo (${attempt})`),
  });

  // Chiude il giro di ogni lingua richiesta che non ha più voci da pubblicare.
  for (const lingua of CONFIGURAZIONE.lingue) {
    const g = giri.find((x) => x.lingua === lingua)!;
    if (runIsComplete(g.manifest)) {
      chiudiGiro(g.giro.manifest, g.manifest);
      console.log(`  giro ${lingua} CHIUSO: tutte le voci nostre sono pubblicate`);
    }
  }
  for (const g of giri) salvaManifest(g.giro.manifest, g.manifest);

  const pubblicati = piani.filter((p) => p.action === "publish");
  console.log(
    `\n  ${pubblicati.length} documenti pubblicati · ${piani.length - pubblicati.length} saltati`,
  );
  for (const p of piani.filter((x) => x.action === "skip")) console.log(riga(p));

  console.log(`\n  attendo l'indice (15 s) e rileggo con perspective raw…`);
  await attendiIndice();
  const problemi: string[] = [];
  for (const lotto of aLotti(pubblicati)) {
    const docs = await leggi(lotto.flatMap((p) => [p.id, idBozza(p.id)]));
    for (const p of lotto)
      problemi.push(
        ...verifyPlan(p, { published: docs.get(p.id), draft: docs.get(idBozza(p.id)) }),
      );
  }
  if (problemi.length > 0) {
    console.error(`\n  ✖ ${problemi.length} documenti non tornano:`);
    for (const x of problemi) console.error(`      ${x}`);
    process.exit(1);
  }
  console.log(`  verificati ${pubblicati.length}: pubblicato e bozza sono quelli attesi.\n`);
}

(ESEGUI ? esegui() : dryRun()).catch((e) => {
  console.error(e);
  process.exit(1);
});
