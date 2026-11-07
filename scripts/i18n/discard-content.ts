/**
 * scripts/i18n/discard-content.ts <locale> [--execute] [--manifest <percorso>]
 *
 * Il rollback: toglie dalle bozze i campi della lingua che abbiamo scritto noi e,
 * dove la bozza **l'abbiamo creata noi** e non ha altre differenze dal pubblicato,
 * la cancella.
 *
 * ⚠️ **Si fida del manifest e di nient'altro.** Senza, un rollback dovrebbe
 * indovinare quali bozze fossero nostre: nel dubbio o cancella il lavoro di una
 * persona, o non cancella niente e lascia sporco. Il manifest registra `nostra` per
 * ogni voce, e questa è la riga su cui gira tutto.
 *
 * ⚠️ **Una bozza `nostra: false` non viene MAI cancellata**, nemmeno con
 * `--execute`: era già lì prima di noi. Al massimo le si tolgono i campi della
 * lingua, e solo se li avevamo scritti noi.
 *
 * ⚠️ **Dry-run di default**, come l'import. E va provato PRIMA del primo
 * `--execute` dell'import: una rete di sicurezza mai provata non è una rete.
 *
 * Uso:  pnpm i18n:discard de
 *       pnpm i18n:discard de --execute
 */

import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

import { LINGUE, validaLingua, type Lingua } from "./lib";
import {
  chiudiGiro,
  decidiRollback,
  giroCorrente,
  percorsoSicuro,
  perIlLog,
  radiceManifest,
  salvaManifest,
  type Manifest,
} from "./manifest";
import { aLotti, commitConBackoff } from "./sanity-batch";

loadEnv({ path: ".env.local" });

const lingua = process.argv[2] as Lingua | undefined;
const ESEGUI = process.argv.includes("--execute");
const percArg = process.argv.find((a) => a.startsWith("--manifest="))?.split("=")[1];

const CONFIGURAZIONE = ((): { lingua: Lingua; percManifest?: string } => {
  try {
    // ⚠️ I dati della riga di comando diventano nomi di cartella e percorsi di
    // file: si controllano PRIMA di usarli, in un posto solo. Una IIFE e non un
    // `let` con un `try`, perché così il tipo è certo anche a valle: nel ramo
    // dell'errore si esce, e `process.exit` ha tipo `never`.
    const l = validaLingua(lingua);
    if (l === "it") throw new Error("l'italiano è la fonte, non una destinazione");
    return { lingua: l, percManifest: percArg ? percorsoSicuro(percArg) : undefined };
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`);
    console.error(
      `  Uso: pnpm i18n:discard <${LINGUE.filter((x) => x !== "it").join("|")}> [--execute]`,
    );
    process.exit(1);
  }
})();
const LINGUA: Lingua = CONFIGURAZIONE.lingua;

// ⚠️ Il manifest del giro in corso si trova dal PUNTATORE, non dalla data: una
// ripresa a cavallo della mezzanotte non deve poter guardare altrove.
const giro = giroCorrente(radiceManifest(), LINGUA);
const perc = CONFIGURAZIONE.percManifest ?? giro?.manifest;

if (!perc) {
  console.error(
    "✖ Nessun giro aperto per questa lingua.\n" +
      "  Se il giro è già stato chiuso, passare il manifest a mano: --manifest=<percorso>",
  );
  process.exit(1);
}
if (!existsSync(perc)) {
  console.error(
    `✖ Manifest assente: ${perIlLog(perc)}\n  Senza manifest non si torna indietro: si riporta.`,
  );
  process.exit(1);
}
// Ristretto qui: `process.exit` interrompe il flusso ma non il tipo, e più giù
// TypeScript vedrebbe ancora `string | undefined`. Stessa ragione di `LINGUA`.
const PERCORSO: string = perc;

const manifest = JSON.parse(readFileSync(PERCORSO, "utf-8")) as Manifest;
const nostre = manifest.voci.filter((v) => v.nostra && !v.saltata);
const altrui = manifest.voci.filter((v) => !v.nostra);

console.log(`\n  manifest: ${perIlLog(PERCORSO)}`);
console.log(`  bozze nostre: ${nostre.length} · non nostre (intoccabili): ${altrui.length}`);

if (nostre.length === 0) {
  console.log("\n  niente da annullare.\n");
  process.exit(0);
}

const token = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_API_READ_TOKEN;
if (!token) {
  console.error("\n  ✖ Manca SANITY_WRITE_TOKEN (o SANITY_API_READ_TOKEN per il dry-run)\n");
  process.exit(1);
}
if (ESEGUI && !process.env.SANITY_WRITE_TOKEN) {
  console.error("\n  ✖ Manca SANITY_WRITE_TOKEN: con --execute serve quello\n");
  process.exit(1);
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01",
  token,
  useCdn: false,
});

/** Lo stato corrente delle bozze del manifest, letto `raw`. */
async function revAttuali(voci: typeof nostre): Promise<Map<string, string>> {
  const fuori = new Map<string, string>();
  for (const lotto of aLotti(voci)) {
    const letti = await client
      .withConfig({ perspective: "raw" })
      .fetch<Array<{ _id: string; _rev: string }>>(`*[_id in $ids]{_id,_rev}`, {
        ids: lotto.map((v) => v.id),
      });
    for (const d of letti) fuori.set(d._id, d._rev);
  }
  return fuori;
}

// ⚠️ `tsx` compila in CJS e il top-level await NON passa: ogni cosa asincrona
// sta dentro una funzione, dry-run compreso.
async function mostraDryRun() {
  // ⚠️ **Il dry-run LEGGE.** Fidarsi del solo manifest gli faceva elencare come
  // «da rimuovere» anche bozze già cancellate: l'11/09/2026 ne ha promesse cinque
  // che non esistevano più. Un dry-run che descrive un mondo che non c'è non è
  // una prova, è una rassicurazione.
  const attuali = await revAttuali(nostre);
  const per: Record<string, typeof nostre> = { cancella: [], "togli-campi": [], niente: [] };
  for (const v of nostre) per[decidiRollback(v, attuali.get(v.id)).azione].push(v);

  console.log("\n  DRY-RUN, sullo stato letto adesso:");
  console.log(`    ${per.cancella.length} bozze nostre e intatte → si cancellerebbero`);
  console.log(`    ${per["togli-campi"].length} modificate da altri → SOLO i campi della lingua`);
  console.log(`    ${per.niente.length} non ci sono più → niente da fare`);
  for (const v of per.cancella.slice(0, 10)) console.log(`      − ${v.tipo.padEnd(14)} ${v.id}`);
  if (per.cancella.length > 10) console.log(`      … e altre ${per.cancella.length - 10}`);
  for (const v of per["togli-campi"]) console.log(`      ~ ${v.tipo.padEnd(14)} ${v.id}`);
  console.log(`\n  Le ${altrui.length} non nostre NON sarebbero toccate.`);
  console.log("  Rilanciare con --execute per annullare.\n");
}

async function annulla() {
  const lotti = aLotti(nostre);
  let tolte = 0;
  let alleggerite = 0;
  let sparite = 0;

  // ⚠️ Qui NON si usa `eseguiLotti`: quel corpo è sincrono, e il rollback ha
  // bisogno di una LETTURA dentro il ciclo, appena prima di scrivere. Restano il
  // lotto da 50 e il backoff, che sono le due cose che contano.

  for (const [i, lotto] of lotti.entries()) {
    // ⚠️ **I `_rev` si leggono lotto per lotto, non tutti all'inizio.** Fra la
    // lettura e la cancellazione deve passare il meno possibile: è esattamente la
    // finestra in cui qualcuno può aprire Studio e mettere mano a una bozza.
    const attuali = new Map<string, string>(
      (
        await client
          .withConfig({ perspective: "raw" })
          .fetch<Array<{ _id: string; _rev: string }>>(`*[_id in $ids]{_id,_rev}`, {
            ids: lotto.map((v) => v.id),
          })
      ).map((d) => [d._id, d._rev]),
    );

    const tx = client.transaction();
    for (const v of lotto) {
      const { azione, ragione } = decidiRollback(v, attuali.get(v.id));
      if (azione === "cancella") {
        // Una bozza creata da noi e non più toccata si cancella intera: era una
        // copia del pubblicato più i campi della lingua, e senza quei campi non
        // ha ragione di esistere.
        tx.delete(v.id);
        tolte += 1;
      } else if (azione === "togli-campi") {
        // ⛔ NON si cancella il documento: si tolgono solo i campi che abbiamo
        // scritto noi, e il resto — il lavoro di quella persona — resta.
        tx.patch(v.id, (p) => p.unset(v.campi));
        v.modificataDaAltri = true;
        alleggerite += 1;
        console.log(`    ~ ${v.id}: ${ragione}, tolti solo ${v.campi.length} campi`);
      } else {
        sparite += 1;
      }
    }
    await commitConBackoff(tx, { visibility: "sync" });
    salvaManifest(PERCORSO, manifest);
    console.log(`    lotto ${i + 1}/${lotti.length}`);
  }

  // ⚠️ Il giro si CHIUDE: dopo un rollback il lavoro successivo è un giro nuovo.
  // Senza, il filtro di ripresa salterebbe documenti le cui bozze non ci sono più.
  chiudiGiro(PERCORSO, manifest);

  console.log(`\n  ${tolte} bozze rimosse · ${alleggerite} alleggerite (modificate da altri)`);
  if (sparite > 0) console.log(`  ${sparite} non c'erano più`);
  console.log(`  Le ${altrui.length} non nostre sono intatte.\n`);
}

(ESEGUI ? annulla() : mostraDryRun()).catch((e) => {
  console.error(e);
  process.exit(1);
});
