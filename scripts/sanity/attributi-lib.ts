/**
 * Il conteggio degli attributi di Sanity, puro (spec FAQ § 1.2).
 *
 * Un attributo è una coppia percorso + tipo di dato; un array conta uno per sé più uno per ogni
 * tipo che contiene (doc https://www.sanity.io/docs/content-lake/technical-limits). Qui il percorso
 * toglie gli indici degli array (`faq.it[].question`), e ogni nodo conta col suo tipo, oggetti e
 * array compresi.
 *
 * ⚠️ **La definizione è nostra finché non combacia con l'API**: l'unione dei percorsi di tutti i
 * documenti deve dare `fields.count` dell'endpoint delle statistiche. Se non combacia, il conteggio
 * per documento non fa fede (rule `misure-e-test`: una guardia si prova contro sé stessa).
 */

export const SOGLIE = { dataset: 1500, documento: 750 } as const;

const tipo = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

/** Gli attributi di un documento, come `percorso|tipo`. */
export function attributi(doc: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  const visita = (v: unknown, path: string) => {
    out.add(`${path}|${tipo(v)}`);
    if (Array.isArray(v)) for (const x of v) visita(x, `${path}[]`);
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) visita(x, `${path}.${k}`);
  };
  for (const [k, v] of Object.entries(doc)) visita(v, k);
  return out;
}

/** L'unione degli attributi di più documenti: il numero da confrontare con `fields.count`. */
export function unione(docs: Array<Record<string, unknown>>): number {
  const tutti = new Set<string>();
  for (const d of docs) for (const a of attributi(d)) tutti.add(a);
  return tutti.size;
}
