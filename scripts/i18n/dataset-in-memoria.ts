/**
 * Il Sanity in memoria e lo scenario dei tre giri, condivisi dai test del publish e dell'aggiorna.
 * Non è codice dello script: vive qui perché due file di test lo usano, e due copie divergerebbero.
 */

import { decidiDocumento, idBozza, registra, type Manifest } from "./manifest";
import {
  removePath,
  writePath,
  type OpenRun,
  type Operation,
  type SanityDocument,
} from "./publish";

/**
 * Sanity in memoria, fedele sui due punti che contano qui: `ifRevisionId` che non combacia fa
 * fallire la transazione INTERA con un 409, e ogni documento toccato prende come `_rev` il
 * `transactionId`.
 */
export class Dataset {
  docs = new Map<string, SanityDocument>();
  private n = 0;
  /** Chiamata una volta, fra la lettura e il commit: è la persona che salva nel frattempo. */
  beforeCommit?: () => void;

  read = async (ids: readonly string[]) =>
    new Map(
      ids
        .filter((id) => this.docs.has(id))
        .map((id) => [id, structuredClone(this.docs.get(id)!)] as const),
    );

  commit = async (operations: readonly Operation[]) => {
    const hook = this.beforeCommit;
    this.beforeCommit = undefined;
    hook?.();
    const copy = new Map([...this.docs].map(([k, v]) => [k, structuredClone(v)] as const));
    const tx = `tx-${++this.n}`;
    const touched = new Set<string>();
    for (const op of operations) {
      if (op.kind === "delete") {
        copy.delete(op.id);
        touched.delete(op.id);
        continue;
      }
      const doc = copy.get(op.id);
      if (!doc) throw Object.assign(new Error(`assente: ${op.id}`), { statusCode: 404 });
      if (doc._rev !== op.ifRevisionId)
        throw Object.assign(new Error(`revisione inattesa: ${op.id}`), { statusCode: 409 });
      for (const [path, value] of Object.entries(op.set ?? {}))
        writePath(doc, path, structuredClone(value));
      for (const path of op.unset ?? []) removePath(doc, path);
      touched.add(op.id);
    }
    for (const id of touched) copy.get(id)!._rev = tx;
    this.docs = copy;
    return tx;
  };

  io(extra: { pause?: () => Promise<void> } = {}) {
    return {
      read: this.read,
      commit: this.commit,
      isRevisionConflict: (e: unknown) => (e as { statusCode?: number })?.statusCode === 409,
      ...extra,
    };
  }
}

export const LINGUE = ["de", "fr", "es"] as const;
export const blocco = (testo: string) => [
  { _key: "k1", _type: "block", children: [{ _key: "s1", _type: "span", text: testo }] },
];

/** Tre pubblicati, poi i tre giri di traduzione con le funzioni vere dell'import. */
export function scenario(quanti = 120) {
  const ds = new Dataset();
  const ids = Array.from({ length: quanti }, (_, i) => `model-m${String(i).padStart(3, "0")}`);
  for (const id of ids)
    ds.docs.set(id, {
      _id: id,
      _type: "model",
      _rev: `pub-${id}`,
      name: { _type: "localizedString", it: `Nome ${id}`, en: `Name ${id}` },
      description: { it: blocco(`Descrizione ${id}`), en: blocco(`Description ${id}`) },
      primaryImage: { _type: "imageWithMeta", asset: { _ref: "foto-vecchia" } },
    });

  const runs: OpenRun[] = [];
  for (const lingua of LINGUE) {
    const manifest: Manifest = { lingua, iniziato: "x", aggiornato: "x", voci: [] };
    for (const id of ids) {
      const draftId = idBozza(id);
      const firme = runs.flatMap((r) =>
        r.manifest.voci
          .filter((v) => v.id === draftId && v.nostra && v.revDopo)
          .map((v) => ({ lingua: r.lingua, revDopo: v.revDopo! })),
      );
      const esito = decidiDocumento({
        id,
        tipo: "model",
        campi: [`name.${lingua}`, `description.${lingua}`],
        bozzaEsiste: ds.docs.has(draftId),
        revBozza: ds.docs.get(draftId)?._rev,
        otherRuns: firme,
        pubblicatoEsiste: true,
      });
      const rev = `rev-${lingua}`;
      if (esito.azione === "crea") {
        ds.docs.set(draftId, { ...structuredClone(ds.docs.get(id)!), _id: draftId, _rev: rev });
      }
      if (esito.azione !== "salta") {
        const bozza = ds.docs.get(draftId)!;
        writePath(bozza, `name.${lingua}`, `Name ${lingua} ${id}`);
        writePath(bozza, `description.${lingua}`, blocco(`Beschreibung ${lingua} ${id}`));
        bozza._rev = rev;
        esito.voce.revDopo = rev;
      }
      registra(manifest, esito.voce);
    }
    runs.push({ lingua, manifest });
  }

  // Dopo i giri, sul pubblicato arrivano le foto nuove: il caso del 15/09.
  for (const id of ids) {
    const pub = ds.docs.get(id)!;
    pub.primaryImage = { _type: "imageWithMeta", asset: { _ref: "foto-nuova" } };
    pub._rev = `pub2-${id}`;
  }
  return { ds, ids, runs };
}
