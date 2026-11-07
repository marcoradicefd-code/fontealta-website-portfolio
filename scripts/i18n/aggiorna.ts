/**
 * `--aggiorna`: corregge i campi di una lingua su bozze che un giro ha GIÀ scritto.
 *
 * ⚠️ **Perché serve.** L'import riprende il giro aperto della lingua e salta i documenti che
 * contiene: una traduzione corretta dopo (l'Excel ufficiale dei modelli, la rilettura) non
 * arriverebbe mai sulla bozza. Aprire un giro nuovo vorrebbe dire chiudere quello vecchio con dentro
 * post, finiture e categorie, e riscrivere valori identici su centinaia di bozze.
 *
 * Per ogni documento:
 * - la voce di questa lingua deve esistere in un giro aperto, nostra, non saltata e non pubblicata;
 * - la bozza deve esistere, e la sua `_rev` deve essere la firma di un giro aperto: altrimenti l'ha
 *   toccata una persona, e si salta;
 * - si patchano **solo** i campi di questa lingua che cambiano, con `ifRevisionId`;
 * - le voci che portavano la firma la passano alla `_rev` nuova, e si marcano `rifirmata`.
 *
 * ⚠️ **Mai creare, mai togliere, mai cancellare.** Le operazioni sono sempre e solo patch con
 * `set`: una bozza assente si salta, e nessun campo si toglie.
 *
 * ⚠️ **Tutto il modulo è puro, tranne le funzioni che riceve**: come `publish.ts`, così i test
 * esercitano lo stesso codice dello script.
 */

import { idBozza, idPubblicato, type VoceManifest } from "./manifest";
import {
  contentOf,
  deepEqual,
  readPath,
  writePath,
  type OpenRun,
  type Operation,
  type PublishIo,
  type SanityDocument,
} from "./publish";

export interface UpdatePlan {
  /** L'id del pubblicato. */
  id: string;
  lingua: string;
  action: "update" | "nothing" | "skip";
  reason: string;
  /** I soli campi che cambiano, percorso → valore. */
  set: Record<string, unknown>;
  /** La `_rev` della bozza letta: è la firma che si passa alla revisione nuova. */
  rev?: string;
  /** Le lingue la cui voce porta la firma attuale della bozza. */
  signers: string[];
  operations: Operation[];
  /** Il contenuto atteso della bozza dopo il commit, senza campi di sistema. */
  expected?: Record<string, unknown>;
}

const plan = (
  args: Pick<UpdatePlan, "id" | "lingua" | "action" | "reason"> & Partial<UpdatePlan>,
): UpdatePlan => ({ set: {}, signers: [], operations: [], ...args });

/** La voce di questo documento in ogni giro aperto, per lingua, nostra e non saltata. */
function entriesOf(runs: readonly OpenRun[], id: string): Map<string, VoceManifest> {
  const draftId = idBozza(id);
  const out = new Map<string, VoceManifest>();
  for (const run of runs) {
    if (run.manifest.chiuso) continue;
    const entry = run.manifest.voci.find((v) => idBozza(v.id) === draftId);
    if (entry?.nostra && !entry.saltata) out.set(run.lingua, entry);
  }
  return out;
}

/** Il motivo per cui la voce della lingua non si può aggiornare, o `null` se si può. */
function entryProblem(entry: VoceManifest | undefined): string | null {
  if (!entry)
    return "nessuna voce aperta di questa lingua: --aggiorna corregge solo quello che un giro ha scritto";
  if (entry.publishedAt) return "già pubblicata: si corregge sul pubblicato, non in bozza";
  return null;
}

/** I campi da scrivere, o l'errore che fa saltare il documento. */
function changedFields(
  draft: SanityDocument,
  entry: VoceManifest,
  lingua: string,
  values: Record<string, unknown>,
): { set: Record<string, unknown> } | { error: string } {
  const set: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(values)) {
    if (!path.endsWith(`.${lingua}`)) return { error: `campo fuori lingua: ${path}` };
    if (!entry.campi.includes(path)) return { error: `campo non scritto da questo giro: ${path}` };
    if (!deepEqual(readPath(draft, path), value)) set[path] = value;
  }
  return { set };
}

/**
 * La decisione su un documento, **pura**.
 *
 * ⚠️ **La firma si cerca su TUTTI i giri aperti**, non solo su quello della lingua: le lingue scritte
 * in catena lasciano come firma valida l'ultima, e una correzione del tedesco su una bozza firmata
 * dallo spagnolo è il caso normale.
 */
export function planUpdate(args: {
  id: string;
  lingua: string;
  values: Record<string, unknown>;
  runs: readonly OpenRun[];
  draft: SanityDocument | undefined;
}): UpdatePlan {
  const id = idPubblicato(args.id);
  const base = { id, lingua: args.lingua };
  const entries = entriesOf(args.runs, id);
  const entry = entries.get(args.lingua);
  const problem = entryProblem(entry);
  if (problem) return plan({ ...base, action: "skip", reason: problem });
  if (!args.draft) return plan({ ...base, action: "skip", reason: "bozza assente: non si crea" });

  const rev = args.draft._rev;
  const signers = [...entries]
    .filter(([, v]) => !v.publishedAt && v.revDopo === rev)
    .map(([lingua]) => lingua);
  if (signers.length === 0)
    return plan({
      ...base,
      action: "skip",
      reason: "modificata da altri: la _rev della bozza non è la firma di nessun giro aperto",
    });

  const changed = changedFields(args.draft, entry!, args.lingua, args.values);
  if ("error" in changed) return plan({ ...base, action: "skip", reason: changed.error });
  if (Object.keys(changed.set).length === 0)
    return plan({ ...base, action: "nothing", reason: "già uguale al file", rev, signers });

  const expected = contentOf(args.draft);
  for (const [path, value] of Object.entries(changed.set))
    writePath(expected, path, structuredClone(value));
  return plan({
    ...base,
    action: "update",
    reason: `cambiano: ${Object.keys(changed.set).join(", ")}`,
    set: changed.set,
    rev,
    signers,
    operations: [{ kind: "patch", id: idBozza(id), ifRevisionId: rev, set: changed.set }],
    expected,
  });
}

/**
 * Registra nei manifest l'esito di un lotto committato.
 *
 * ⚠️ **Si rifirmano SOLO le voci che portavano la firma**, e si marcano `rifirmata`. Rifirmare la
 * voce che ha creato la bozza senza marcarla la farebbe sembrare «nostra e intatta» al rollback,
 * che la cancellerebbe con dentro le altre lingue.
 */
export function recordUpdates(
  runs: readonly OpenRun[],
  plans: readonly UpdatePlan[],
  transactionId: string,
  now: string,
): void {
  for (const p of plans) {
    if (p.action !== "update") continue;
    const entries = entriesOf(runs, p.id);
    for (const lingua of p.signers) {
      const signer = entries.get(lingua)!;
      signer.revDopo = transactionId;
      signer.rifirmata = now;
    }
    const entry = entries.get(p.lingua)!;
    entry.aggiornamenti = [
      ...(entry.aggiornamenti ?? []),
      { quando: now, campi: Object.keys(p.set), revPrima: p.rev!, revDopo: transactionId },
    ];
  }
}

/**
 * Confronta la bozza riletta con quella attesa. Vuoto se torna.
 *
 * ⚠️ Confronta il documento **intero**: la prova che non si è toccato altro è che tutto il resto sia
 * rimasto com'era.
 */
export function verifyUpdate(p: UpdatePlan, draft: SanityDocument | undefined): string[] {
  if (p.action !== "update" || !p.expected) return [];
  if (!draft) return [`${p.id}: la bozza è sparita`];
  return deepEqual(contentOf(draft), p.expected) ? [] : [`${p.id}: la bozza non è quella attesa`];
}

/**
 * Il ciclo: lotto per lotto, legge, decide, committa, registra.
 *
 * ⚠️ **Su un conflitto di revisione la transazione intera fallisce, e si RILEGGE**: una bozza
 * toccata da una persona nel frattempo non ha più la firma, e alla rilettura si salta.
 */
export async function updateByFields(args: {
  ids: readonly string[];
  lingua: string;
  valuesFor: (id: string) => Record<string, unknown>;
  runs: readonly OpenRun[];
  io: Pick<PublishIo, "read" | "commit" | "isRevisionConflict" | "pause">;
  now: () => string;
  perBatch?: number;
  attempts?: number;
  onBatch?: (index: number, plans: UpdatePlan[], transactionId: string | undefined) => void;
  onConflict?: (index: number, attempt: number) => void;
}): Promise<UpdatePlan[]> {
  const perBatch = args.perBatch ?? 50;
  const attempts = args.attempts ?? 3;
  const ids = [...new Set(args.ids.map(idPubblicato))];
  const all: UpdatePlan[] = [];

  for (let start = 0, index = 0; start < ids.length; start += perBatch, index += 1) {
    const batch = ids.slice(start, start + perBatch);
    for (let attempt = 1; ; attempt += 1) {
      const docs = await args.io.read(batch.map(idBozza));
      const plans = batch.map((id) =>
        planUpdate({
          id,
          lingua: args.lingua,
          values: args.valuesFor(id),
          runs: args.runs,
          draft: docs.get(idBozza(id)),
        }),
      );
      const operations = plans.flatMap((p) => p.operations);
      if (operations.length === 0) {
        args.onBatch?.(index, plans, undefined);
        all.push(...plans);
        break;
      }
      try {
        const transactionId = await args.io.commit(operations);
        recordUpdates(args.runs, plans, transactionId, args.now());
        args.onBatch?.(index, plans, transactionId);
        all.push(...plans);
        break;
      } catch (e) {
        if (!args.io.isRevisionConflict(e) || attempt >= attempts) throw e;
        args.onConflict?.(index, attempt);
        await args.io.pause?.();
      }
    }
  }
  return all;
}
