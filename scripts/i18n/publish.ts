/**
 * Il publish PER CAMPI: le lingue arrivano sul pubblicato com'è adesso, e nessuna bozza si
 * pubblica come tale.
 *
 * ⚠️ **Perché non `sanity.action.document.publish`.** Le bozze nostre sono copie del
 * pubblicato al momento della creazione più i campi delle lingue. Tutto ciò che cambia sul
 * pubblicato dopo — foto, cover, testi italiani — nella bozza non c'è, e pubblicarla intera lo
 * riporterebbe indietro. Misurato il 15/09/2026: 54 modelli con le foto nuove sul pubblicato e
 * le vecchie nelle bozze.
 *
 * Quindi, per ogni documento: si legge bozza e pubblicato; si verifica che la bozza sia ancora
 * firmata da un nostro giro aperto (altrimenti l'ha toccata una persona, e si salta); si
 * copiano sul pubblicato **solo** i campi delle lingue richieste, con `ifRevisionId` sul
 * pubblicato; la bozza si scarta se non porta più lingue nostre, o si riallinea al pubblicato
 * nuovo se ne porta ancora.
 *
 * ⚠️ **Tutto il modulo è puro, tranne le due funzioni che riceve**: leggere e scrivere. Così i
 * test esercitano lo stesso codice dello script, su un dataset in memoria.
 */

import { idBozza, idPubblicato, type Manifest, type VoceManifest } from "./manifest";

/** Un documento letto `raw`: i campi di sistema più il contenuto. */
export type SanityDocument = Record<string, unknown> & { _id: string; _rev: string };

/** Un giro aperto di una lingua, col suo manifest in memoria. */
export interface OpenRun {
  lingua: string;
  manifest: Manifest;
}

/** Una mutazione, nella forma minima che serve qui. */
export type Operation =
  | {
      kind: "patch";
      id: string;
      ifRevisionId: string;
      set?: Record<string, unknown>;
      unset?: string[];
    }
  | { kind: "delete"; id: string };

export interface DocumentPlan {
  /** L'id del pubblicato. */
  id: string;
  action: "publish" | "skip";
  reason: string;
  /** Le lingue che questo documento porta sul pubblicato. */
  languages: string[];
  /** Le lingue nostre che restano in bozza dopo il publish. */
  remaining: string[];
  draft: "discarded" | "realigned" | "untouched";
  operations: Operation[];
  /** Il contenuto atteso dopo il commit, senza campi di sistema: è ciò che la verifica confronta. */
  expected?: { published: Record<string, unknown>; draft?: Record<string, unknown> };
}

/**
 * Il campo che non esiste, e che si toglie per portare `ifRevisionId` sulla bozza.
 *
 * ⚠️ Una `delete` in una transazione non accetta `ifRevisionId`. Una patch sì, e un `unset` di un
 * campo assente non cambia il documento: messa prima della `delete` nella stessa transazione, fa
 * fallire tutto se la bozza è cambiata fra la lettura e il commit.
 */
export const REVISION_GUARD_FIELD = "__i18nPublishRevisionGuard";

const SYSTEM_FIELDS = new Set(["_id", "_type", "_rev", "_createdAt", "_updatedAt"]);

/** Il valore a un percorso a punti, o `undefined`. I percorsi del manifest non hanno array. */
export function readPath(doc: unknown, path: string): unknown {
  let current: unknown = doc;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Scrive a un percorso a punti, creando gli oggetti intermedi come fa `set` di Sanity. */
export function writePath(doc: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  const last = keys.pop()!;
  let current = doc;
  for (const key of keys) {
    const next = current[key];
    if (next === null || typeof next !== "object" || Array.isArray(next)) current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  current[last] = value;
}

/** Toglie il valore a un percorso a punti, come `unset` di Sanity. */
export function removePath(doc: Record<string, unknown>, path: string): void {
  const keys = path.split(".");
  const last = keys.pop()!;
  const parent = keys.length === 0 ? doc : readPath(doc, keys.join("."));
  if (parent !== null && typeof parent === "object")
    delete (parent as Record<string, unknown>)[last];
}

/** Uguaglianza profonda, indifferente all'ordine delle chiavi. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => deepEqual(x, bb[i]));
  }
  const ka = Object.keys(a as object).filter(
    (k) => (a as Record<string, unknown>)[k] !== undefined,
  );
  const kb = Object.keys(b as object).filter(
    (k) => (b as Record<string, unknown>)[k] !== undefined,
  );
  return (
    ka.length === kb.length &&
    ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}

/** Il contenuto di un documento, senza i campi di sistema, copiato in profondità. */
export function contentOf(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) if (!SYSTEM_FIELDS.has(k)) out[k] = structuredClone(v);
  return out;
}

/**
 * Le voci di un documento che contano per il publish, per lingua: nostre, non saltate, non
 * ancora pubblicate, nei giri aperti.
 */
export function openEntriesFor(runs: readonly OpenRun[], id: string): Map<string, VoceManifest> {
  const draftId = idBozza(id);
  const out = new Map<string, VoceManifest>();
  for (const run of runs) {
    if (run.manifest.chiuso) continue;
    const entry = run.manifest.voci.find((v) => idBozza(v.id) === draftId);
    if (entry && entry.nostra && !entry.saltata && !entry.publishedAt) out.set(run.lingua, entry);
  }
  return out;
}

const skip = (id: string, reason: string): DocumentPlan => ({
  id,
  action: "skip",
  reason,
  languages: [],
  remaining: [],
  draft: "untouched",
  operations: [],
});

/**
 * I campi di queste lingue, letti dalla bozza. Un errore è la ragione per saltare il documento.
 *
 * ⚠️ Un campo che manca non si salta in silenzio: pubblicare metà di una lingua è peggio che non
 * pubblicarla.
 */
function fieldsFromDraft(
  draft: SanityDocument,
  entries: Map<string, VoceManifest>,
  languages: readonly string[],
  missing: string,
): { values: Record<string, unknown> } | { error: string } {
  const values: Record<string, unknown> = {};
  for (const lingua of languages) {
    for (const path of entries.get(lingua)!.campi) {
      // Difensivo: un campo che non finisce con la sua lingua non si copia.
      if (!path.endsWith(`.${lingua}`))
        return { error: `campo fuori lingua nel manifest: ${path}` };
      const value = readPath(draft, path);
      if (value === undefined) return { error: `${missing}: ${path}` };
      values[path] = value;
    }
  }
  return { values };
}

/** Una copia del contenuto con questi campi scritti sopra. */
function withFields(
  base: Record<string, unknown>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out = structuredClone(base);
  for (const [path, value] of Object.entries(values)) writePath(out, path, value);
  return out;
}

/** La patch che porta la bozza a coincidere con `expected`, con `ifRevisionId` e la guardia. */
function realignDraftPatch(
  draftId: string,
  draft: SanityDocument,
  expected: Record<string, unknown>,
): Operation {
  const current = contentOf(draft);
  const set = Object.fromEntries(
    Object.entries(expected).filter(([k, v]) => !deepEqual(current[k], v)),
  );
  const unset = Object.keys(current).filter((k) => !(k in expected));
  return {
    kind: "patch",
    id: draftId,
    ifRevisionId: draft._rev,
    set,
    unset: [...unset, REVISION_GUARD_FIELD],
  };
}

/**
 * La decisione su un documento, **pura**.
 *
 * ⚠️ **La prova che la bozza è ancora nostra è la sua `_rev`**: deve essere il `revDopo` di una
 * voce di un giro aperto. Le lingue scritte in catena lasciano come firma valida l'ultima (lo
 * spagnolo dopo il francese dopo il tedesco); una persona che apre la bozza in Studio la cambia,
 * e allora non si pubblica niente di quel documento.
 */
export function planDocument(args: {
  id: string;
  languages: readonly string[];
  runs: readonly OpenRun[];
  draft: SanityDocument | undefined;
  published: SanityDocument | undefined;
}): DocumentPlan {
  const id = idPubblicato(args.id);
  const draftId = idBozza(args.id);
  const entries = openEntriesFor(args.runs, draftId);
  const toPublish = args.languages.filter((l) => entries.has(l));

  if (toPublish.length === 0) return skip(id, "nessuna lingua richiesta ha una voce nostra aperta");
  if (!args.published) return skip(id, "pubblicato assente");
  if (!args.draft) return skip(id, "bozza assente");
  const signatures = new Set([...entries.values()].map((v) => v.revDopo));
  if (!signatures.has(args.draft._rev))
    return skip(
      id,
      "modificata da altri: la _rev della bozza non è la firma di nessun giro aperto",
    );

  const published = fieldsFromDraft(args.draft, entries, toPublish, "campo assente nella bozza");
  if ("error" in published) return skip(id, published.error);
  const expectedPublished = withFields(contentOf(args.published), published.values);
  const publishPatch: Operation = {
    kind: "patch",
    id,
    ifRevisionId: args.published._rev,
    set: published.values,
  };
  const remaining = [...entries.keys()].filter((l) => !toPublish.includes(l));
  const base = { id, action: "publish" as const, languages: toPublish, remaining };

  if (remaining.length === 0) {
    return {
      ...base,
      reason: "pubblicate tutte le lingue nostre: la bozza si scarta",
      draft: "discarded",
      operations: [
        publishPatch,
        {
          kind: "patch",
          id: draftId,
          ifRevisionId: args.draft._rev,
          unset: [REVISION_GUARD_FIELD],
        },
        { kind: "delete", id: draftId },
      ],
      expected: { published: expectedPublished },
    };
  }

  // La bozza resta, con le lingue non pubblicate, sopra il pubblicato NUOVO: così non è più
  // stantia, e il publish successivo non ha niente da riportare indietro.
  const kept = fieldsFromDraft(
    args.draft,
    entries,
    remaining,
    "campo della lingua che resta assente",
  );
  if ("error" in kept) return skip(id, kept.error);
  const expectedDraft = withFields(expectedPublished, kept.values);
  return {
    ...base,
    reason: `restano in bozza: ${remaining.join(", ")}`,
    draft: "realigned",
    operations: [publishPatch, realignDraftPatch(draftId, args.draft, expectedDraft)],
    expected: { published: expectedPublished, draft: expectedDraft },
  };
}

/** Le voci di un documento in tutti i giri caricati, per lingua. */
function entriesByLanguage(runs: readonly OpenRun[], id: string): Map<string, VoceManifest> {
  const out = new Map<string, VoceManifest>();
  for (const run of runs) {
    const entry = run.manifest.voci.find((v) => idBozza(v.id) === idBozza(id));
    if (entry) out.set(run.lingua, entry);
  }
  return out;
}

function recordPublished(
  plan: DocumentPlan,
  entries: Map<string, VoceManifest>,
  transactionId: string,
  now: string,
): void {
  for (const lingua of plan.languages) {
    const entry = entries.get(lingua)!;
    entry.publishedAt = now;
    delete entry.publishSkipped;
  }
  for (const lingua of plan.remaining) {
    const entry = entries.get(lingua)!;
    entry.revDopo = transactionId;
    // ⚠️ Senza il segno, la voce che ha creato la bozza sembrerebbe «nostra e intatta» al rollback,
    // che la cancellerebbe con dentro le lingue che restano.
    entry.rifirmata = now;
  }
}

function recordSkipped(
  plan: DocumentPlan,
  entries: Map<string, VoceManifest>,
  requested: readonly string[],
): void {
  for (const lingua of requested) {
    const entry = entries.get(lingua);
    if (entry?.nostra && !entry.saltata && !entry.publishedAt) entry.publishSkipped = plan.reason;
  }
}

/**
 * Registra nei manifest l'esito di un lotto già committato.
 *
 * ⚠️ **Le lingue che restano prendono la `_rev` nuova come firma**: la bozza riallineata ha
 * quella, e senza aggiornarla il publish successivo la scambierebbe per toccata da una persona.
 */
export function recordPlans(
  runs: readonly OpenRun[],
  plans: readonly DocumentPlan[],
  transactionId: string,
  now: string,
  requested: readonly string[],
): void {
  for (const plan of plans) {
    const entries = entriesByLanguage(runs, plan.id);
    if (plan.action === "publish") recordPublished(plan, entries, transactionId, now);
    else recordSkipped(plan, entries, requested);
  }
}

/** Un giro è finito quando ogni sua voce nostra e non saltata è stata pubblicata. */
export function runIsComplete(manifest: Manifest): boolean {
  const ours = manifest.voci.filter((v) => v.nostra && !v.saltata);
  return ours.length > 0 && ours.every((v) => Boolean(v.publishedAt));
}

/**
 * Confronta lo stato riletto con quello atteso dal piano. Restituisce i problemi, vuoto se torna.
 *
 * ⚠️ Confronta il documento **intero**, non solo i campi scritti: la prova che il publish non ha
 * riportato indietro niente è che tutto il resto del pubblicato sia rimasto com'era.
 */
export function verifyPlan(
  plan: DocumentPlan,
  after: { published: SanityDocument | undefined; draft: SanityDocument | undefined },
): string[] {
  if (plan.action !== "publish" || !plan.expected) return [];
  const problems: string[] = [];
  if (!after.published) problems.push(`${plan.id}: pubblicato sparito`);
  else if (!deepEqual(contentOf(after.published), plan.expected.published))
    problems.push(`${plan.id}: il pubblicato non è quello atteso`);
  if (plan.draft === "discarded" && after.draft)
    problems.push(`${plan.id}: la bozza doveva essere scartata ed è ancora lì`);
  if (plan.draft === "realigned") {
    if (!after.draft) problems.push(`${plan.id}: la bozza riallineata è sparita`);
    else if (!deepEqual(contentOf(after.draft), plan.expected.draft))
      problems.push(`${plan.id}: la bozza riallineata non è quella attesa`);
  }
  return problems;
}

export interface PublishIo {
  /** Legge `raw` i documenti con questi id, nelle due forme. */
  read: (ids: readonly string[]) => Promise<Map<string, SanityDocument>>;
  /** Esegue le operazioni in una transazione sola e restituisce il `transactionId`. */
  commit: (operations: readonly Operation[]) => Promise<string>;
  /** Vero se l'errore è un conflitto di revisione (`ifRevisionId` non combacia). */
  isRevisionConflict: (e: unknown) => boolean;
  /** Pausa fra un lotto e l'altro, e fra un conflitto e la rilettura. */
  pause?: () => Promise<void>;
}

/**
 * Il ciclo: lotto per lotto, legge, decide, committa, registra.
 *
 * ⚠️ **Su un conflitto di revisione la transazione intera fallisce, e si RILEGGE**: mai
 * riscrivere con le `_rev` vecchie. Alla rilettura un pubblicato cambiato fa ripartire il piano
 * sul pubblicato nuovo, una bozza toccata da una persona fa saltare il suo documento.
 */
export async function publishByFields(args: {
  ids: readonly string[];
  languages: readonly string[];
  runs: readonly OpenRun[];
  io: PublishIo;
  now: () => string;
  perBatch?: number;
  attempts?: number;
  onBatch?: (index: number, plans: DocumentPlan[], transactionId: string | undefined) => void;
  onConflict?: (index: number, attempt: number) => void;
}): Promise<DocumentPlan[]> {
  const perBatch = args.perBatch ?? 50;
  const attempts = args.attempts ?? 3;
  const all: DocumentPlan[] = [];
  const ids = [...new Set(args.ids.map(idPubblicato))];

  for (let start = 0, index = 0; start < ids.length; start += perBatch, index += 1) {
    const batch = ids.slice(start, start + perBatch);
    for (let attempt = 1; ; attempt += 1) {
      const docs = await args.io.read(batch.flatMap((id) => [id, idBozza(id)]));
      const plans = batch.map((id) =>
        planDocument({
          id,
          languages: args.languages,
          runs: args.runs,
          draft: docs.get(idBozza(id)),
          published: docs.get(id),
        }),
      );
      const operations = plans.flatMap((p) => p.operations);
      if (operations.length === 0) {
        recordPlans(args.runs, plans, "", args.now(), args.languages);
        args.onBatch?.(index, plans, undefined);
        all.push(...plans);
        break;
      }
      try {
        const transactionId = await args.io.commit(operations);
        recordPlans(args.runs, plans, transactionId, args.now(), args.languages);
        args.onBatch?.(index, plans, transactionId);
        all.push(...plans);
        break;
      } catch (e) {
        if (!args.io.isRevisionConflict(e) || attempt >= attempts) throw e;
        args.onConflict?.(index, attempt);
        await args.io.pause?.();
      }
    }
    if (start + perBatch < ids.length) await args.io.pause?.();
  }
  return all;
}
