/**
 * scripts/i18n/import-content.ts <locale> [--execute]
 *
 * Legge i JSON di `tmp/traduzioni/<locale>/` con la colonna `<locale>`
 * compilata e scrive i SOLI campi di quella lingua come **bozze**.
 *
 * ⚠️ **DRY-RUN di default, e `--execute` è l'unica porta.** Uno strumento che
 * scrive su un CMS deve chiedere due volte: la prima stampa cosa farebbe, la
 * seconda lo fa.
 *
 * ⚠️ **Mai `publish`, mai un campo che non sia della lingua chiesta.** Le patch
 * toccano `drafts.<id>` e scrivono solo i path `<campo>.<locale>`: l'italiano e
 * l'inglese non vengono sfiorati, e la pagina pubblicata non cambia finché non
 * pubblica una persona.
 *
 * ⚠️ **Un documento con anche UN solo problema non si scrive.** I controlli
 * stanno in `lib.ts` e sono provati lì; qui si decide solo cosa farne, e la
 * decisione è: si riporta tutto e non si scrive niente di quel documento. Una
 * traduzione scritta a metà è peggio di una non scritta, perché sembra fatta.
 *
 * ⚠️ **Le bozze si CREANO, non si patchano.** Provato il 11/09/2026 su un id
 * inesistente: `Mutation failed: The document with the ID "drafts.…" was not
 * found`. E le bozze non ci sono: sui 595 modelli il dataset ne aveva **zero**.
 * Quindi per ogni documento si guarda se `drafts.<id>` esiste; se non esiste si
 * crea **copiando il pubblicato** e poi si applicano i campi della lingua.
 *
 * ⚠️ **Una bozza che esisteva già si SALTA e si registra.** Può essere il lavoro
 * in corso di una persona: sovrascriverlo sarebbe il danno peggiore che questo
 * script può fare, e sarebbe invisibile.
 *
 * ⚠️ **`--aggiorna` corregge quello che un giro ha GIÀ scritto**, e fa solo quello: l'import
 * normale riprende il giro aperto e salta i documenti che contiene. La logica sta in `aggiorna.ts`:
 * patch dei soli campi di questa lingua che cambiano, con `ifRevisionId`, sulle bozze ancora firmate
 * da un giro aperto; la firma passa alla revisione nuova; mai creare, togliere o cancellare.
 *
 * Uso:  pnpm i18n:import de               (dry-run)
 *       pnpm i18n:import de --check-only  (solo i controlli, nessuna rete)
 *       pnpm i18n:import de --execute     (scrive le bozze)
 *       ... --solo <id,id>                (il rito di prova su pochi documenti)
 *       pnpm i18n:import de --aggiorna [--execute] [--solo=id,id]   (corregge bozze già scritte)
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

import { planUpdate, updateByFields, verifyUpdate, type UpdatePlan } from "./aggiorna";
import {
  blocking,
  controlla,
  LINGUE,
  validaLingua,
  type Lingua,
  type Problema,
  type ValoreLocalizzato,
} from "./lib";
import {
  decidiDocumento,
  draftsOwnedByOtherRuns,
  eBozza,
  giaFatti,
  giroCorrente,
  idBozza,
  idPubblicato,
  idNostriDistinti,
  registra,
  giroPerScrivere,
  leggiManifest,
  lottiFatti,
  perIlLog,
  radiceManifest,
  salvaManifest,
  segnaLotto,
  type Giro,
  type Manifest,
} from "./manifest";
import type { OpenRun, SanityDocument } from "./publish";
import { aLotti, attendiIndice, commitConBackoff, eseguiLotti } from "./sanity-batch";

loadEnv({ path: ".env.local" });

const lingua = process.argv[2] as Lingua | undefined;
const ESEGUI = process.argv.includes("--execute");
const SOLO_CONTROLLI = process.argv.includes("--check-only");
const AGGIORNA = process.argv.includes("--aggiorna");
/** `--solo a,b,c`: il rito di prova di R10 gira su pochi documenti veri. */
const soloArg = process.argv.find((a) => a.startsWith("--solo="))?.split("=")[1];
const SOLO = soloArg ? new Set(soloArg.split(",").map((x) => x.trim())) : null;
// ⚠️ Il narrowing non attraversa il confine di `scrivi()`: la lingua si cattura
// qui, una volta, invece di ripetere un `!` a ogni uso. E si VALIDA, perché da
// qui in giù diventa un nome di cartella.
const CONFIGURAZIONE = ((): { lingua: Lingua; percManifest?: string } => {
  try {
    // ⚠️ I dati della riga di comando diventano nomi di cartella e percorsi di
    // file: si controllano PRIMA di usarli, in un posto solo. Una IIFE e non un
    // `let` con un `try`, perché così il tipo è certo anche a valle: nel ramo
    // dell'errore si esce, e `process.exit` ha tipo `never`.
    const l = validaLingua(lingua);
    if (l === "it") throw new Error("l'italiano è la fonte, non una destinazione");
    return { lingua: l };
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`);
    console.error(
      `  Uso: pnpm i18n:import <${LINGUE.filter((x) => x !== "it").join("|")}> [--check-only|--execute] [--aggiorna] [--solo=id,id]`,
    );
    process.exit(1);
  }
})();
const LINGUA: Lingua = CONFIGURAZIONE.lingua;

const cartella = join(process.cwd(), "tmp", "traduzioni", LINGUA);
let file: string[];
try {
  file = readdirSync(cartella).filter((f) => f.endsWith(".json"));
} catch {
  console.error(
    `✖ Cartella assente: tmp/traduzioni/${LINGUA}/ — lanciare prima pnpm i18n:export ${LINGUA}`,
  );
  process.exit(1);
}

interface Documento {
  _id: string;
  _type: string;
  campi: Record<string, Record<string, ValoreLocalizzato | null>>;
}

let conProblemi = 0;
let pronti = 0;
let campiScritti = 0;
/** Avvisi dei documenti pronti: si scrivono, ma i numeri vanno nel rapporto. */
const avvisi: Array<{ tipo: string; id: string; p: Problema }> = [];
const patch: Array<{ id: string; tipo: string; set: Record<string, ValoreLocalizzato> }> = [];

/** File di bozze trovati in cartella: si rifiutano e si nominano, non si scartano zitti. */
const bozzeInCartella: string[] = [];

// Sui nomi dei file l'ordine è quello di `sort()` senza argomenti, sulle cinque lingue
// (misurato il 28/10/2026): stessa lavorazione e stessi lotti di prima. Senza `numeric`.
const ORDINE = new Intl.Collator("it");
for (const nome of file.toSorted(ORDINE.compare)) {
  const doc = JSON.parse(readFileSync(join(cartella, nome), "utf-8")) as Documento;
  // ⚠️ **Una bozza non si importa, e il rifiuto sta ANCHE qui.** L'export non
  // ripulisce la cartella: un file prodotto da un export vecchio sopravvive a
  // valle della correzione, e questo è l'ultimo cancello prima di Sanity.
  // Misurato l'11/09: senza questa riga il file della bozza orfana passava, l'id
  // perdeva il prefisso e finiva fra i «pronti» per poi essere saltato più giù
  // come «pubblicato assente». Saltato, quindi senza danno, ma contato.
  if (eBozza(doc._id)) {
    bozzeInCartella.push(`${doc._type} ${doc._id}`);
    continue;
  }
  if (SOLO && !SOLO.has(doc._id)) continue;
  const set: Record<string, ValoreLocalizzato> = {};
  const problemi: Problema[] = [];

  for (const [path, valori] of Object.entries(doc.campi)) {
    const tradotto = valori[LINGUA];
    // Un campo lasciato vuoto non è un errore: è un campo che il traduttore non
    // ha ancora fatto, e si riesporta. Solo i campi COMPILATI si controllano.
    if (tradotto === null || tradotto === undefined) continue;
    const originale = valori.it ?? undefined;
    problemi.push(...controlla(path, originale ?? undefined, tradotto, LINGUA));
    set[`${path}.${LINGUA}`] = tradotto;
  }

  if (Object.keys(set).length === 0) continue;

  // ⚠️ Blocca solo un problema `blocking`. Gli avvisi (lunghezza per DE/FR/ES, parole
  // identiche all'italiano) non fermano la scrittura, ma si stampano tutti, con i numeri.
  if (blocking(problemi).length > 0) {
    conProblemi += 1;
    console.log(`\n  ✖ ${doc._type} ${doc._id}`);
    for (const p of problemi)
      console.log(
        `      ${p.severity === "warning" ? "(avviso) " : ""}${p.path}${p.blocco !== undefined ? ` [blocco ${p.blocco}]` : ""}: ${p.messaggio}`,
      );
    continue;
  }
  for (const p of problemi) avvisi.push({ tipo: doc._type, id: doc._id, p });

  pronti += 1;
  campiScritti += Object.keys(set).length;
  // L'id è già quello del pubblicato: le bozze sono state rifiutate sopra.
  patch.push({ id: doc._id, tipo: doc._type, set });
}

if (avvisi.length > 0) {
  console.log(`\n  AVVISI sui documenti pronti (non bloccano la scrittura):`);
  for (const { tipo, id, p } of avvisi)
    console.log(
      `    · ${tipo} ${id} · ${p.path}${p.blocco !== undefined ? ` [blocco ${p.blocco}]` : ""}: ${p.messaggio}`,
    );
}
const avvisiLunghezza = avvisi.filter(({ p }) => p.messaggio.includes("parole diventano")).length;
const avvisiParole = avvisi.filter(({ p }) => p.messaggio.startsWith("parole identiche")).length;
console.log(
  `\n  ${file.length} file letti · ${pronti} documenti pronti (${campiScritti} campi) · ${conProblemi} con problemi · avvisi ${avvisi.length} (lunghezza ${avvisiLunghezza} · parole identiche all'italiano ${avvisiParole})`,
);
if (bozzeInCartella.length > 0) {
  console.log(
    `  ${bozzeInCartella.length} file di BOZZE rifiutati (residui di un export vecchio):`,
  );
  for (const b of bozzeInCartella) console.log(`    ${b}`);
}

if (SOLO_CONTROLLI) {
  console.log("\n  CHECK-ONLY: solo i controlli, nessuna rete toccata.\n");
  process.exit(conProblemi > 0 ? 1 : 0);
}

if (!ESEGUI && !AGGIORNA) {
  console.log(
    "\n  DRY-RUN: non è stato scritto niente. Rilanciare con --execute per scrivere le bozze.\n",
  );
  process.exit(conProblemi > 0 ? 1 : 0);
}

if (conProblemi > 0) {
  console.error("\n  ✖ Ci sono documenti con problemi: si corregge, non si scrive a metà.\n");
  process.exit(1);
}

// Il dry-run di --aggiorna legge Sanity per decidere: basta il token di lettura.
const token = ESEGUI
  ? process.env.SANITY_WRITE_TOKEN
  : (process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_API_READ_TOKEN);
if (!token) {
  console.error(`\n  ✖ Manca SANITY_WRITE_TOKEN${ESEGUI ? "" : " (o SANITY_API_READ_TOKEN)"}\n`);
  process.exit(1);
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01",
  token,
  useCdn: false,
});

// `tsx` compila in CJS e il top-level await non passa: la scrittura sta in un main.
async function scrivi() {
  const base = radiceManifest();
  // ⚠️ Il giro si RIPRENDE se ce n'è uno aperto. Prima il percorso era datato, e
  // una ripresa dopo mezzanotte scriveva in un manifest diverso: le bozze del
  // tronco precedente diventavano «di qualcun altro» e il rollback non le toccava.
  const { giro, ripreso } = giroPerScrivere(base, LINGUA);
  const perc = giro.manifest;
  const manifest = leggiManifest(perc, LINGUA);
  const fatti = giaFatti(manifest);
  const cartellaDone = giro.lotti;
  const lottiGia = lottiFatti(cartellaDone);
  console.log(`\n  giro: ${giro.id}${ripreso ? " (RIPRESO)" : " (nuovo)"}`);

  // ⚠️ Le bozze già esistenti si scoprono PRIMA di scrivere, in una query sola.
  // Chiederlo documento per documento sarebbe 641 round-trip per un'informazione
  // che sta in una riga di GROQ, e ogni round-trip è un'occasione di 429.
  const ids = patch.map((x) => x.id);
  // ⚠️ Con la `_rev`, non solo l'id: una bozza già presente si completa solo se la sua `_rev`
  // è ancora la firma lasciata da un giro aperto di un'altra lingua (`decidiDocumento`).
  const revBozze = new Map<string, string>(
    (
      await client.fetch<Array<{ _id: string; _rev: string }>>(`*[_id in $ids]{_id, _rev}`, {
        ids: ids.map(idBozza),
      })
    ).map((d) => [d._id, d._rev]),
  );
  const firmeAltriGiri = draftsOwnedByOtherRuns(
    base,
    LINGUE.filter((l) => l !== "it" && l !== LINGUA),
  );
  const condivisibili = [...revBozze].filter(([id, rev]) =>
    firmeAltriGiri.get(id)?.some((g) => g.revDopo === rev),
  ).length;
  const pubblicati = new Map<string, Record<string, unknown>>(
    (await client.fetch<Array<Record<string, unknown>>>(`*[_id in $ids]`, { ids })).map((d) => [
      d._id as string,
      d,
    ]),
  );

  console.log(
    `\n  bozze già presenti: ${revBozze.size} (di cui nostre di altri giri e intatte, da completare: ${condivisibili} · da saltare: ${revBozze.size - condivisibili}) · da creare: ${ids.length - revBozze.size}`,
  );

  const daFare = patch.filter((x) => !fatti.has(x.id));
  const lotti = aLotti(daFare);
  let creati = 0;
  let saltati = 0;
  let giaNostre = 0;
  let aggiunti = 0;
  /** Gli id creati dal lotto in corso: a commit fatto prendono il `revDopo`. */
  const creatiNelLotto: string[] = [];

  await eseguiLotti(
    client,
    lotti,
    (tx, lotto) => {
      creatiNelLotto.length = 0;
      for (const { id, tipo, set } of lotto) {
        const draftId = idBozza(id);
        const esito = decidiDocumento({
          id,
          tipo,
          campi: Object.keys(set),
          bozzaEsiste: revBozze.has(draftId),
          revBozza: revBozze.get(draftId),
          otherRuns: firmeAltriGiri.get(draftId),
          pubblicatoEsiste: pubblicati.has(id),
        });

        if (esito.azione === "crea") {
          // La bozza NASCE dal pubblicato: `createIfNotExists` la crea solo se manca,
          // quindi due esecuzioni di fila non si pestano i piedi.
          // ⚠️ `_rev` NON si copia: appartiene al documento pubblicato, e portarlo
          // sulla bozza farebbe fallire la scrittura con un conflitto di revisione.
          const corpo = { ...(pubblicati.get(id) as Record<string, unknown>) };
          delete corpo._rev;
          tx.createIfNotExists({ ...corpo, _id: draftId } as never);
          tx.patch(draftId, (pt) => pt.set(set));
          creatiNelLotto.push(draftId);
        } else if (esito.azione === "aggiungi") {
          // La bozza è di un altro giro e nessuno l'ha toccata: le si aggiungono SOLO i campi di
          // questa lingua. ⚠️ `ifRevisionId`: se fra la lettura e il commit qualcuno la apre,
          // la transazione fallisce invece di scriverle sopra.
          tx.patch(draftId, (pt) => pt.ifRevisionId(revBozze.get(draftId)!).set(set));
          creatiNelLotto.push(draftId);
        }

        const registrata = registra(manifest, esito.voce);
        creati += esito.azione === "crea" ? 1 : 0;
        aggiunti += esito.azione === "aggiungi" ? 1 : 0;
        // ⚠️ I conteggi separano «saltata perché di qualcun altro» da «già creata
        // da noi in un giro precedente»: prima erano lo stesso numero, e quel
        // numero raccontava una bozza nostra come se fosse di una persona.
        if (esito.azione === "salta") {
          if (registrata === "declassamento-evitato") giaNostre += 1;
          else saltati += 1;
        }
      }
    },
    {
      // ⚠️ `deferred` e non `sync`: su centinaia di documenti l'attesa
      // dell'indicizzazione è il costo dominante. Il prezzo è che la verifica
      // va fatta DOPO un'attesa, e con `perspective: raw`.
      visibility: "deferred",
      onFatto: (i, lotto, transactionId) => {
        // ⚠️ Il `transactionId` È il `_rev` che i documenti di questo lotto hanno
        // ora. Si scrive solo su quelli creati QUI: una bozza saltata non è stata
        // toccata, e il suo `revDopo` di un giro precedente resta quello giusto.
        for (const id of creatiNelLotto) {
          const voce = manifest.voci.find((v) => v.id === id);
          if (voce) voce.revDopo = transactionId;
        }
        salvaManifest(perc, manifest);
        segnaLotto(cartellaDone, i, {
          documenti: lotto.length,
          creati,
          aggiunti,
          saltati,
          giaNostre,
        });
        console.log(`    lotto ${i + 1}/${lotti.length} — ${lotto.length} documenti`);
      },
    },
  );

  salvaManifest(perc, manifest);
  console.log(
    `\n  ${creati} bozze create · ${aggiunti} completate (bozze di altri giri) · ${saltati} saltate · ${giaNostre} già nostre da un giro precedente`,
  );
  console.log(`  manifest: ${perIlLog(perc)}`);
  console.log(`  lotti già fatti prima di questo giro: ${lottiGia.size}`);

  // Rilettura di verifica: `raw` è l'unica prospettiva che vede le bozze.
  console.log(`\n  attendo l'indice (${15} s) e rileggo con perspective raw…`);
  await attendiIndice();
  // ⚠️ **Id DISTINTI da tutte e due le parti.** Prima a sinistra c'erano le voci
  // del manifest e a destra i documenti trovati: con un manifest che accumulava,
  // la guardia usciva rossa su giri corretti. La stessa funzione la usa il
  // rollback, così i due non possono contare cose diverse.
  const nostre = idNostriDistinti(manifest);
  const trovate = new Set(
    await client
      .withConfig({ perspective: "raw" })
      .fetch<string[]>(`*[_id in $ids]._id`, { ids: nostre }),
  );
  console.log(`  attese ${nostre.length} · trovate ${trovate.size}`);
  const mancanti = nostre.filter((id) => !trovate.has(id));
  if (mancanti.length > 0) {
    console.error(`  ✖ ${mancanti.length} bozze attese e non trovate: NON procedere al volume.`);
    for (const id of mancanti.slice(0, 10)) console.error(`      ${id}`);
    process.exit(1);
  }
  console.log("\n  NESSUN publish: le pagine restano come sono.\n");
}

/** Legge `raw`: è l'unica prospettiva che vede le bozze. */
async function leggiRaw(ids: readonly string[]): Promise<Map<string, SanityDocument>> {
  const docs = await client
    .withConfig({ perspective: "raw" })
    .fetch<SanityDocument[]>(`*[_id in $ids]`, { ids: [...ids] });
  return new Map(docs.map((d) => [d._id, d]));
}

/** I giri aperti di TUTTE le lingue: la firma di una bozza può stare in quello di un'altra. */
function giriAperti(): Array<OpenRun & { giro: Giro }> {
  const out: Array<OpenRun & { giro: Giro }> = [];
  for (const l of LINGUE.filter((x) => x !== "it")) {
    const giro = giroCorrente(radiceManifest(), l);
    if (giro && existsSync(giro.manifest))
      out.push({
        lingua: l,
        giro,
        manifest: JSON.parse(readFileSync(giro.manifest, "utf-8")) as Manifest,
      });
  }
  return out;
}

const SEGNO: Record<UpdatePlan["action"], string> = { update: "✎", nothing: "=", skip: "·" };

const rigaAggiorna = (p: UpdatePlan) => `    ${SEGNO[p.action]} ${p.id.padEnd(34)} ${p.reason}`;

async function aggiorna() {
  const giri = giriAperti();
  if (!giri.some((g) => g.lingua === LINGUA)) {
    console.error(
      `\n  ✖ Nessun giro aperto per ${LINGUA}: --aggiorna corregge solo bozze già scritte.\n`,
    );
    process.exit(1);
  }
  const valori = new Map(patch.map((x) => [idPubblicato(x.id), x.set as Record<string, unknown>]));
  const ids = [...valori.keys()];
  const stampa = (piani: UpdatePlan[]) => {
    const n = (a: UpdatePlan["action"]) => piani.filter((p) => p.action === a).length;
    console.log(
      `\n  --aggiorna ${LINGUA}: ${n("update")} da correggere · ${n("nothing")} già uguali · ${n("skip")} saltati` +
        ` · campi da scrivere ${piani.reduce((s, p) => s + Object.keys(p.set).length, 0)}`,
    );
    for (const p of piani.filter((x) => x.action !== "nothing").slice(0, 80))
      console.log(rigaAggiorna(p));
  };

  if (!ESEGUI) {
    const piani: UpdatePlan[] = [];
    for (const lotto of aLotti(ids)) {
      const docs = await leggiRaw(lotto.map(idBozza));
      for (const id of lotto)
        piani.push(
          planUpdate({
            id,
            lingua: LINGUA,
            values: valori.get(id)!,
            runs: giri,
            draft: docs.get(idBozza(id)),
          }),
        );
    }
    stampa(piani);
    console.log("\n  DRY-RUN --aggiorna: niente scritto. Rilanciare con --execute.\n");
    return;
  }

  const piani = await updateByFields({
    ids,
    lingua: LINGUA,
    valuesFor: (id) => valori.get(id)!,
    runs: giri,
    now: () => new Date().toISOString(),
    io: {
      read: leggiRaw,
      commit: (operations) => {
        const tx = client.transaction();
        for (const op of operations) {
          // ⚠️ Solo patch con `set`: aggiorna.ts non ne produce altre, e qui non se ne accettano.
          if (op.kind !== "patch" || op.unset)
            throw new Error(`operazione non ammessa in --aggiorna: ${op.kind}`);
          tx.patch(op.id, (pt) => pt.ifRevisionId(op.ifRevisionId).set(op.set ?? {}));
        }
        return commitConBackoff(tx, { visibility: "deferred" });
      },
      isRevisionConflict: (e) =>
        (e as { statusCode?: number })?.statusCode === 409 ||
        (e as { response?: { statusCode?: number } })?.response?.statusCode === 409,
      pause: () => new Promise((r) => setTimeout(r, 120)),
    },
    onBatch: (i, plans, transactionId) => {
      // ⚠️ Dopo ogni lotto: un processo che muore a metà lascia manifest veri.
      for (const g of giri) salvaManifest(g.giro.manifest, g.manifest);
      console.log(
        `    lotto ${i + 1} — ${plans.filter((p) => p.action === "update").length} corretti · tx ${transactionId ?? "nessuna"}`,
      );
    },
    onConflict: (i, attempt) =>
      console.log(`    lotto ${i + 1}: conflitto di revisione, rileggo e riprovo (${attempt})`),
  });
  for (const g of giri) salvaManifest(g.giro.manifest, g.manifest);
  stampa(piani);

  console.log(`\n  attendo l'indice (15 s) e rileggo con perspective raw…`);
  await attendiIndice();
  const corretti = piani.filter((p) => p.action === "update");
  const problemi: string[] = [];
  for (const lotto of aLotti(corretti)) {
    const docs = await leggiRaw(lotto.map((p) => idBozza(p.id)));
    for (const p of lotto) problemi.push(...verifyUpdate(p, docs.get(idBozza(p.id))));
  }
  if (problemi.length > 0) {
    console.error(`\n  ✖ ${problemi.length} bozze non tornano:`);
    for (const x of problemi) console.error(`      ${x}`);
    process.exit(1);
  }
  console.log(`  verificate ${corretti.length}: ogni bozza è quella attesa, campo per campo.`);
  console.log("\n  NESSUN publish: le pagine restano come sono.\n");
}

(AGGIORNA ? aggiorna() : scrivi()).catch((e) => {
  console.error(e);
  process.exit(1);
});
