/**
 * Stato dei filtri di collezione, letto e scritto nell'URL. Chiude M13.
 *
 * UNICA SORGENTE, per desktop e mobile. Prima lo stato viveva in due `useState`
 * dentro `ModelsSection`: invisibile a un refresh, a un link condiviso e al
 * tasto indietro. Ora la query string È lo stato, e le due interfacce leggono
 * dallo stesso posto — un doppio stato che si sincronizza è il modo sicuro per
 * vederli divergere.
 *
 * FORMA: `?finitura=MX,BX&ambiente=lavabo,doccia`. **Codici, non `_id`**: un
 * `_id` di Sanity in un link condiviso è illeggibile e cambia se il documento
 * viene ricreato, mentre `MX` è il codice di listino e sta anche sulle pill.
 *
 * ORDINE STABILE: i valori escono nell'ordine delle OPZIONI (listino per le
 * finiture, `MACRO_ORDER` per gli ambienti), non in quello dei clic. Così lo
 * stesso insieme di filtri produce sempre la stessa URL, e due utenti che
 * scelgono le stesse cose in ordine diverso si scambiano lo stesso link.
 *
 * VALORI SCONOSCIUTI SCARTATI: un `?finitura=PIPPO` scritto a mano non deve
 * dare una griglia vuota inspiegabile. Si tiene solo ciò che esiste fra le
 * opzioni, e il resto sparisce anche dall'URL al primo cambio.
 */

export interface OpzioneFiltro {
  /** Il valore che finisce nell'URL: codice finitura (`MX`) o macro (`lavabo`). */
  valore: string;
  etichetta: string;
  /** URL dello swatch, solo per le finiture. */
  swatch?: string | null;
}

export interface GruppoFiltro {
  /** Nome del parametro nella query string. */
  chiave: string;
  etichetta: string;
  opzioni: OpzioneFiltro[];
}

export type StatoFiltri = Record<string, Set<string>>;

/** Insieme vuoto condiviso. Un `new Set()` per render romperebbe le dipendenze
 *  dei `useMemo` a valle a ogni giro, e due copie sarebbero due occasioni per
 *  scriverne una diversa. */
export const INSIEME_VUOTO: ReadonlySet<string> = new Set<string>();

/** Un gruppo si mostra solo con almeno DUE opzioni: con una sola, selezionarla
 *  equivale a non filtrare, e il controllo occupa spazio senza offrire scelte.
 *  12 collezioni su 22 hanno un solo ambiente, Yacht una sola finitura. */
export const MIN_OPZIONI = 2;

export function gruppiVisibili(gruppi: GruppoFiltro[]): GruppoFiltro[] {
  return gruppi.filter((g) => g.opzioni.length >= MIN_OPZIONI);
}

export function leggiFiltri(
  params: { get(name: string): string | null },
  gruppi: GruppoFiltro[],
): StatoFiltri {
  const stato: StatoFiltri = {};
  for (const g of gruppi) {
    const ammessi = new Set(g.opzioni.map((o) => o.valore));
    const grezzi = (params.get(g.chiave) ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    stato[g.chiave] = new Set(grezzi.filter((v) => ammessi.has(v)));
  }
  return stato;
}

/** La query string per uno stato. Vuota se nessun filtro: `?` da solo in un
 *  link condiviso è rumore, e «nessun filtro» deve dare l'URL nuda della pagina. */
export function scriviFiltri(stato: StatoFiltri, gruppi: GruppoFiltro[]): string {
  const parti: string[] = [];
  for (const g of gruppi) {
    const attivi = stato[g.chiave];
    if (!attivi?.size) continue;
    // ordine delle opzioni, non dei clic
    const ordinati = g.opzioni.map((o) => o.valore).filter((v) => attivi.has(v));
    if (ordinati.length) parti.push(`${encodeURIComponent(g.chiave)}=${ordinati.join(",")}`);
  }
  return parti.join("&");
}

export function contaAttivi(stato: StatoFiltri): number {
  return Object.values(stato).reduce((n, s) => n + s.size, 0);
}

/** Lo stato con un valore ribaltato. Non muta: lo stato è quello dell'URL, e
 *  mutarlo in loco lascerebbe React e query string a raccontare due storie. */
export function ribalta(stato: StatoFiltri, chiave: string, valore: string): StatoFiltri {
  const prossimo: StatoFiltri = {};
  for (const [k, v] of Object.entries(stato)) prossimo[k] = new Set(v);
  const insieme = prossimo[chiave] ?? new Set<string>();
  if (insieme.has(valore)) insieme.delete(valore);
  else insieme.add(valore);
  prossimo[chiave] = insieme;
  return prossimo;
}

export function svuota(gruppi: GruppoFiltro[]): StatoFiltri {
  const stato: StatoFiltri = {};
  for (const g of gruppi) stato[g.chiave] = new Set<string>();
  return stato;
}
