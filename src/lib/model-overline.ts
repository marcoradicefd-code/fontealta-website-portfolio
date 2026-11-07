/**
 * Riga 1 («soprattitolo») della card modello: il nome dell'articolo **meno** il suo
 * codice, quando il codice ne è il suffisso esatto.
 *
 * Il campo `name` di Sanity è già «linea di prodotto + codice» concatenato
 * («Origo C50AS.YCWS.ME.D», «Boss Wide BW76.AST»). Serve la sola prima parte.
 *
 * ⚠️ NON è uno split sul primo spazio: quattro titoli sono multi-parola — Boss Wide,
 * Club Large, Origo Rame, Corpi a incasso — e lo split darebbe «Boss» / «Wide BW76.AST».
 * Togliere il codice come SUFFISSO ESATTO è deterministico: qualunque cosa resti prima
 * è il prefisso, spazi inclusi, senza doverne indovinare il numero di parole.
 *
 * Il confronto è esatto e case-sensitive apposta. Un match allentato (case-insensitive,
 * o «contiene») farebbe passare per suffisso un codice che compare a metà nome e
 * taglierebbe la stringa nel punto sbagliato: meglio ricadere sulla collezione, che è
 * un dato vero, che restituire un prefisso plausibile e falso.
 *
 * Ordine delle fonti — la seconda è una rete, non un pari grado:
 *  1. `name` senza il suffisso `code`
 *  2. `collectionTitle` (proiettato dalle query card) se il nome non finisce col codice
 *  3. `null` → la card resta di una riga sola. È il caso dei corpi a incasso, che non
 *     appartengono a nessuna collezione: meglio una riga in meno che una inventata.
 */
export function modelOverline(
  name: string | null | undefined,
  code: string | null | undefined,
  collectionTitle: string | null | undefined,
): string | null {
  const n = name?.trim() ?? "";
  const c = code?.trim() ?? "";

  if (n && c && n.length > c.length && n.endsWith(c)) {
    const prefix = n.slice(0, n.length - c.length).trim();
    if (prefix) return prefix;
  }

  return collectionTitle?.trim() || null;
}
