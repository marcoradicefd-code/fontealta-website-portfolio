/**
 * La parte comune dei caricatori su Sanity (`faq-carica.ts`, `contenuti-carica.ts`).
 *
 * Estratta da `faq-carica.ts` il 2/11/2026 (spec `docs/specs/contenuti-per-lingua.md` § C): il
 * cancello dell'export del giorno, i nomi degli id, e la scrittura per campi sul PUBBLICATO con
 * blocco ottimistico, verbale e ripristino.
 *
 * ⚠️ **Si scrive sul pubblicato, campo per campo, con `ifRevisionId`.** Un 409 ferma quel documento
 * e non si riprova (`maxRetries: 0` sul client). Il verbale si scrive prima di ogni scrittura e dopo:
 * se il processo muore, dice cosa c'era.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Patch, SanityClient } from "@sanity/client";

import { percorsoSicuro } from "./manifest";
import { deepEqual } from "./publish";

export const pubblicato = (id: string) => !id.startsWith("drafts.") && !id.startsWith("versions.");
export const radiceId = (id: string) => id.replace(/^(drafts|versions\.[^.]+)\./, "");

/** L'export del dataset fatto oggi (`pnpm sanity:export`), o niente. */
export function exportDiOggi(): { perc: string; mb: string } | undefined {
  const d = new Date();
  const giorno = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const perc = join("tmp", "backup", `production-${giorno}.tar.gz`);
  if (!existsSync(perc) || statSync(perc).size === 0) return undefined;
  return { perc, mb: (statSync(perc).size / 1e6).toFixed(1) };
}

/** Legge un valore a un percorso «a.b.c» di un documento. */
export function leggiPercorso(doc: unknown, percorso: string): unknown {
  return percorso
    .split(".")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      doc,
    );
}

/** Una scrittura: i campi da mettere su un documento pubblicato letto alla revisione `rev`. */
export interface Operazione {
  id: string;
  rev: string;
  label: string;
  /** Percorso → valore. */
  set: Record<string, unknown>;
  /**
   * Percorsi da togliere (4/11/2026, Marco): una tagline vuota nel file la toglie da Sanity. Nel
   * verbale c'è il valore di prima, e `--ripristina` lo rimette.
   */
  unset?: string[];
  /** Oggetti da creare se mancano, prima del `set` (es. `{ seo: { _type: "seoFields" } }`). */
  setIfMissing?: Record<string, unknown>;
  /**
   * Il documento da creare, se non c'è (una pagina d'uso, c1a del 3/11/2026): `create` fallisce se
   * nel frattempo qualcuno l'ha creato, ed è il blocco ottimistico della creazione. `rev` è vuoto.
   */
  crea?: Record<string, unknown> & { _id: string; _type: string };
}

/**
 * Il codice che conferma un giro di scritture (manutenzione 3, c1a del 3/11/2026): lo stesso diff dà
 * lo stesso codice, e un documento cambiato nel frattempo (un'altra revisione) ne dà un altro.
 */
export function codiceConferma(operazioni: readonly Operazione[]): string {
  const h = createHash("sha256");
  for (const op of operazioni)
    h.update(
      // `unset` in coda e solo se c'è: un diff senza percorsi da togliere ha il codice di prima.
      `${op.id}|${op.rev}|${JSON.stringify(op.crea ?? null)}|${JSON.stringify(op.setIfMissing ?? null)}|${JSON.stringify(op.set)}${op.unset?.length ? `|${JSON.stringify(op.unset)}` : ""}\n`,
    );
  return h.digest("hex").slice(0, 8);
}

/** I percorsi che un'operazione tocca: quelli che mette e quelli che toglie. */
export const percorsiToccati = (op: Operazione) => [...Object.keys(op.set), ...(op.unset ?? [])];

/**
 * Le operazioni di una voce: solo i campi che cambiano, gli oggetti che mancano, e i percorsi da
 * togliere che sul documento ci sono ancora. Niente da cambiare → `null` (la voce è invariata, e un
 * carico rifatto con gli stessi file non scrive niente).
 */
export function operazione(
  doc: { _id: string; _rev: string },
  label: string,
  campi: Record<string, unknown>,
  mancanti: Record<string, unknown>,
  togli: readonly string[] = [],
): Operazione | null {
  const set = Object.fromEntries(
    // `deepEqual` e non `JSON.stringify`: Sanity restituisce le chiavi in un altro ordine, e il
    // confronto delle stringhe vedeva 552 `specs` uguali come diverse (verificatore del 2/11).
    Object.entries(campi).filter(([p, v]) => !deepEqual(leggiPercorso(doc, p), v)),
  );
  const unset = togli.filter((p) => leggiPercorso(doc, p) !== undefined);
  if (Object.keys(set).length === 0 && unset.length === 0) return null;
  // Un oggetto che manca nasce coi suoi figli dentro, in un'operazione sola: `seo` e
  // `seo.metaTitle` come due percorsi separati dipenderebbero dall'ordine in cui Sanity li applica.
  const setIfMissing: Record<string, Record<string, unknown>> = {};
  for (const [p, v] of Object.entries(mancanti)) {
    if (leggiPercorso(doc, p) !== undefined) continue;
    const padre = Object.keys(setIfMissing).find((q) => p.startsWith(`${q}.`));
    if (padre) setIfMissing[padre][p.slice(padre.length + 1)] = v;
    else setIfMissing[p] = { ...(v as Record<string, unknown>) };
  }
  return {
    id: doc._id,
    rev: doc._rev,
    label,
    set,
    ...(unset.length ? { unset } : {}),
    ...(Object.keys(setIfMissing).length ? { setIfMissing } : {}),
  };
}

/**
 * Se un'operazione toglie TUTTE le lingue rimaste di un campo per lingua (`tagline.it`… ), toglie
 * il campo intero: il documento torna com'era prima che il campo esistesse (la tagline prima del
 * 2/11/2026, Marco), senza un oggetto vuoto col solo `_type`. Altrimenti l'operazione resta com'è.
 */
export function compattaUnset(op: Operazione, doc: unknown, campo: string): Operazione {
  const valore = leggiPercorso(doc, campo);
  const prefisso = `${campo}.`;
  const tolti = (op.unset ?? []).filter((p) => p.startsWith(prefisso));
  if (!tolti.length || !valore || typeof valore !== "object") return op;
  const lingue = Object.keys(valore).filter((k) => !k.startsWith("_"));
  const restano = lingue.filter((k) => !tolti.includes(`${prefisso}${k}`));
  const rimesse = Object.keys(op.set).some((p) => p === campo || p.startsWith(prefisso));
  if (restano.length || rimesse) return op;
  return { ...op, unset: [...(op.unset ?? []).filter((p) => !tolti.includes(p)), campo] };
}

/**
 * Un'operazione sola per documento. Le operazioni sono lette tutte alla stessa revisione: due sullo
 * stesso documento (una collezione ha le sue cinque lingue) darebbero alla seconda un 409, perché la
 * prima ha già cambiato la revisione.
 */
export function unisciPerDocumento(operazioni: Operazione[]): Operazione[] {
  const perId = new Map<string, Operazione>();
  for (const op of operazioni) {
    const gia = perId.get(op.id);
    if (!gia) {
      perId.set(op.id, {
        ...op,
        set: { ...op.set },
        ...(op.unset ? { unset: [...op.unset] } : {}),
      });
      continue;
    }
    gia.label = `${gia.label} + ${op.label}`;
    Object.assign(gia.set, op.set);
    if (op.unset) gia.unset = [...(gia.unset ?? []), ...op.unset];
    if (op.setIfMissing) {
      const unito: Record<string, unknown> = { ...gia.setIfMissing };
      for (const [k, v] of Object.entries(op.setIfMissing))
        unito[k] = { ...(unito[k] as object | undefined), ...(v as object) };
      gia.setIfMissing = unito;
    }
  }
  return [...perId.values()];
}

/**
 * Gli asset mancanti, uno per ogni file che li usa (4/11/2026). Fino ad allora la mappa teneva per
 * ogni asset solo l'ultimo file letto, e l'errore finiva sull'ultima lingua anche se mancava in
 * tutte: il conteggio per lingua era falso.
 */
export function assetMancanti(
  usati: ReadonlyMap<string, readonly string[]>,
  esistono: ReadonlySet<string>,
): Array<{ asset: string; chiave: string }> {
  return [...usati].flatMap(([asset, chiavi]) =>
    esistono.has(asset) ? [] : [...new Set(chiavi)].map((chiave) => ({ asset, chiave })),
  );
}

/** Un documento scritto, quanto basta per i suoi tag: il tipo e lo slug, se ce l'ha. */
export interface DocScritto {
  _type: string;
  slug?: string | null;
}

/**
 * I tag che il webhook invaliderebbe per i documenti scritti: il tipo e `<tipo>:<slug>`
 * (`src/app/api/revalidate/route.ts`). Un carico col webhook spento si chiude invalidando questi
 * (rule `cache-isr`): la cache dati di Vercel sopravvive ai deploy.
 */
export function tagDaInvalidare(docs: readonly DocScritto[]): string[] {
  const tags = new Set<string>();
  for (const d of docs) {
    tags.add(d._type);
    if (d.slug) tags.add(`${d._type}:${d.slug}`);
  }
  return [...tags];
}

/** I tag che mancano all'elenco per qualcuno dei documenti scritti (vuoto = elenco completo). */
export function tagMancanti(docs: readonly DocScritto[], tags: readonly string[]): string[] {
  const have = new Set(tags);
  return tagDaInvalidare(docs).filter((t) => !have.has(t));
}

/** Al massimo 16 tag per chiamata (doc Vercel, purge: «Tags per bulk REST API call: 16»). */
export const TAG_PER_CHIAMATA = 16;
export const aGruppi = <T>(x: readonly T[], n = TAG_PER_CHIAMATA): T[][] =>
  Array.from({ length: Math.ceil(x.length / n) }, (_, i) => x.slice(i * n, (i + 1) * n));

/**
 * Il tipo e lo slug di ogni documento scritto. Si ferma se un id non si risolve o non ha tipo: un
 * tag perso non dà errori, la pagina resta vecchia e basta.
 */
export function risolviScritti(
  ids: readonly string[],
  trova: (id: string) => DocScritto | undefined,
): DocScritto[] {
  return ids.map((id) => {
    const d = trova(id);
    if (!d?._type) throw new Error(`documento scritto senza tipo, o non trovato: ${id}`);
    return d;
  });
}

/** Stampa i tag degli id scritti a gruppi da 16, pronti per il connettore Vercel o per `--invalida`. */
export function stampaTag(
  ids: readonly string[],
  trova: (id: string) => DocScritto | undefined,
): string[] {
  const docs = risolviScritti(ids, trova);
  const tags = tagDaInvalidare(docs);
  if (!tags.length) return tags;
  console.log(
    `\n■ tag da invalidare (${tags.length}, ${docs.length} documenti scritti; rule cache-isr):`,
  );
  aGruppi(tags).forEach((g, i) => console.log(`  gruppo ${i + 1}: ${JSON.stringify(g)}`));
  return tags;
}

const VERCEL_PROGETTO = "prj_fMgTM97G3YDgyJQqlVA4cPp8VeXr";
const VERCEL_TEAM = "team_9w0DCaCmgMWqaw7iAIgOZjNV";

/**
 * Invalida i tag in produzione con l'API di Vercel (`/v1/edge-cache/invalidate-by-tags`), a gruppi
 * da 16. Solo col flag `--invalida`, scritto apposta, e con `VERCEL_TOKEN`: senza, si ferma e dice
 * di usare il connettore coi gruppi stampati. Torna il numero di gruppi falliti.
 */
export async function invalidaTag(tags: readonly string[]): Promise<number> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.error(
      "✖ --invalida vuole VERCEL_TOKEN: senza, i tag si invalidano dal connettore Vercel coi gruppi qui sopra",
    );
    return 1;
  }
  let falliti = 0;
  for (const g of aGruppi(tags)) {
    const r = await fetch(
      `https://api.vercel.com/v1/edge-cache/invalidate-by-tags?projectIdOrName=${VERCEL_PROGETTO}&teamId=${VERCEL_TEAM}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ tags: g, target: "production" }),
      },
    );
    if (!r.ok) falliti++;
    console.log(
      `  ${r.ok ? "✔" : "✖"} ${g.length} tag invalidati${r.ok ? "" : ` (HTTP ${r.status})`}`,
    );
  }
  return falliti;
}

export interface Verbale {
  sezione: string;
  quando: string;
  voci: Array<{
    id: string;
    label: string;
    /** I valori di prima, per percorso: `null` = il campo non c'era. */
    prima: Record<string, unknown>;
    revDopo?: string;
    fermata?: string;
    /**
     * Il documento l'ha creato questa scrittura (5/11/2026): `--ripristina` lo cancella invece di
     * togliere i campi, che lascerebbero online un documento vuoto (un post con copertina e data).
     */
    creato?: true;
  }>;
}

/** Scrive le operazioni, con verbale e verifica. Torna il numero di problemi (0 = tutto bene). */
export async function scriviCampi(
  client: SanityClient,
  sezione: string,
  operazioni: Operazione[],
  radice: string,
  documentiLetti: Map<string, unknown>,
  /** Riempita a ogni scrittura riuscita: se il giro muore a metà, dice chi è già scritto. */
  scritti?: Map<string, string>,
): Promise<{ problemi: number; verbale: string; revisioni: Map<string, string> }> {
  const quando = new Date().toISOString();
  mkdirSync(radice, { recursive: true });
  const perc = join(radice, `${quando.replace(/[:.]/g, "-")}-${sezione}.json`);
  const verbale: Verbale = { sezione, quando, voci: [] };
  const salva = () => writeFileSync(perc, JSON.stringify(verbale, null, 1), "utf-8");
  let fermate = 0;
  for (const op of operazioni) {
    const doc = documentiLetti.get(op.id);
    const voce: Verbale["voci"][number] = {
      id: op.id,
      label: op.label,
      // Anche i percorsi da togliere, col valore che avevano: `--ripristina` lo rimette.
      prima: Object.fromEntries(percorsiToccati(op).map((p) => [p, leggiPercorso(doc, p) ?? null])),
      ...(op.crea ? { creato: true as const } : {}),
    };
    verbale.voci.push(voce);
    salva();
    try {
      // Gli oggetti che mancano (col loro `_type`) e poi i campi, in una transazione sola e in
      // quest'ordine: dentro una patch Sanity applica `set` prima di `setIfMissing`.
      const tx = client.transaction();
      // Un documento nuovo: `create` nella stessa transazione, poi i campi senza revisione da
      // confrontare (non ce n'è una). Se intanto è nato, `create` fallisce col 409.
      if (op.crea) tx.create(op.crea);
      const conRev = (p: Patch) => (op.crea ? p : p.ifRevisionId(op.rev));
      if (op.setIfMissing) tx.patch(op.id, (p) => conRev(p).setIfMissing(op.setIfMissing ?? {}));
      tx.patch(op.id, (p) => {
        let q = op.setIfMissing ? p : conRev(p);
        if (Object.keys(op.set).length) q = q.set(op.set);
        return op.unset?.length ? q.unset(op.unset) : q;
      });
      await tx.commit({ visibility: "sync" });
      const [letto] = await client.fetch<Array<{ _rev: string }>>(`*[_id == $id]{ _rev }`, {
        id: op.id,
      });
      voce.revDopo = letto?._rev;
      if (letto?._rev) scritti?.set(op.id, letto._rev);
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode !== 409) {
        salva();
        throw e;
      }
      voce.fermata = "409: il documento è cambiato dopo la lettura, non si riprova";
      fermate++;
    }
    salva();
  }
  // Verifica: si rilegge il pubblicato e si confronta campo per campo.
  const ids = verbale.voci.filter((v) => v.revDopo).map((v) => v.id);
  const letti = new Map(
    (await client.fetch<Array<{ _id: string }>>(`*[_id in $ids]`, { ids })).map((d) => [d._id, d]),
  );
  let diversi = 0;
  for (const op of operazioni.filter((o) => ids.includes(o.id))) {
    for (const [p, v] of Object.entries(op.set))
      if (!deepEqual(leggiPercorso(letti.get(op.id), p), v)) {
        diversi++;
        console.error(`  ✖ ${op.label}: ${p} su Sanity non è quello scritto`);
      }
    for (const p of op.unset ?? [])
      if (leggiPercorso(letti.get(op.id), p) !== undefined) {
        diversi++;
        console.error(`  ✖ ${op.label}: ${p} su Sanity c'è ancora`);
      }
  }
  // Le revisioni scritte: la sezione dopo, sugli stessi documenti, parte da queste.
  const revisioni = new Map(
    verbale.voci.filter((v) => v.revDopo).map((v) => [v.id, v.revDopo as string]),
  );
  return { problemi: diversi + fermate, verbale: perc, revisioni };
}

/** Rimette i campi di un verbale com'erano, solo dove la revisione è ancora la nostra. */
export async function ripristinaCampi(
  client: SanityClient,
  file: string,
  radice: string,
  esegui: boolean,
): Promise<number> {
  const verbale = JSON.parse(readFileSync(percorsoSicuro(file, radice), "utf-8")) as Verbale;
  const letti = new Map(
    (
      await client.fetch<Array<{ _id: string; _rev: string; _type: string; slug?: string }>>(
        `*[_id in $ids]{ _id, _rev, _type, "slug": slug.current }`,
        {
          ids: verbale.voci.map((v) => v.id),
        },
      )
    ).map((d) => [d._id, d]),
  );
  let lasciate = 0;
  const rimessi: string[] = [];
  for (const v of verbale.voci) {
    if (!v.revDopo || letti.get(v.id)?._rev !== v.revDopo) {
      lasciate++;
      console.log(`  · ${v.label}: toccato dopo la scrittura (o mai scritto), si lascia`);
      continue;
    }
    if (v.creato) {
      // Un documento referenziato (un «Approfondisci» che punta al post) Sanity non lo cancella: ci si
      // ferma prima, senza toccare niente, così il documento non resta a metà (Marco, 5/11/2026).
      const da = await client.fetch<string[]>(`*[references($id)]._id`, { id: v.id });
      if (da.length) {
        lasciate++;
        console.log(
          `  ✖ ${v.label}: lo referenziano ${da.length} documenti (${da.slice(0, 5).join(", ")}${da.length > 5 ? ", …" : ""}): non si cancella e non si tocca. Togli prima quei riferimenti, poi rilancia.`,
        );
        continue;
      }
      console.log(`  → ${v.label}: creato da questa scrittura, si cancella`);
      if (!esegui) continue;
      try {
        // La revisione si controlla nella stessa transazione della cancellazione, con una patch che
        // non cambia niente: se intanto qualcuno l'ha toccato, fallisce tutto col 409.
        await client
          .transaction()
          .patch(v.id, (p) => p.ifRevisionId(v.revDopo as string).unset(["_ripristino"]))
          .delete(v.id)
          .commit({ visibility: "sync" });
      } catch (e) {
        lasciate++;
        const { statusCode, message } = e as { statusCode?: number; message?: string };
        console.log(
          `  ✖ ${v.label}: Sanity non l'ha cancellato (${statusCode ?? "errore"}: ${message ?? e}); il documento resta com'era`,
        );
        continue;
      }
      rimessi.push(v.id);
      continue;
    }
    const daTogliere = Object.keys(v.prima).filter((p) => v.prima[p] === null);
    const daRimettere = Object.fromEntries(Object.entries(v.prima).filter(([, x]) => x !== null));
    console.log(
      `  → ${v.label}: rimette ${Object.keys(daRimettere).length}, toglie ${daTogliere.length}`,
    );
    if (!esegui) continue;
    let patch = client.patch(v.id).ifRevisionId(v.revDopo);
    if (Object.keys(daRimettere).length) patch = patch.set(daRimettere);
    if (daTogliere.length) patch = patch.unset(daTogliere);
    await patch.commit({ visibility: "sync" });
    rimessi.push(v.id);
  }
  console.log(
    `\n  ${esegui ? "ripristinate" : "DRY-RUN, si ripristinerebbero"} ${verbale.voci.length - lasciate} · lasciate ${lasciate}\n`,
  );
  // Un ripristino col webhook spento lascia la stessa cache vecchia di un carico (rule cache-isr).
  stampaTag(rimessi, (id) => letti.get(id));
  return lasciate;
}
