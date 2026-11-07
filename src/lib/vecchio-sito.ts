/**
 * Gli indirizzi `.aspx` del vecchio sito (20/10/2026): `/COLLEZIONE-CODICE.aspx`, una scheda per
 * codice. Nelle quattro settimane fra il 21/09 e il 19/10 ne sono arrivati 215 diversi, e dal 14/10
 * davano 500 (verbale `docs/history/2026-10-20-locale-404.md`).
 *
 * L'ordine delle prove:
 * 1. **il codice è una scheda viva** → la scheda. Vince il codice, non la collezione scritta
 *    nell'indirizzo: nel vecchio sito i prodotti erano raggruppati in altro modo (IDRA e LARES oggi
 *    stanno in Community, la serie W10 in Spring, i K35 in Kitchen), e il codice è l'identità;
 * 2. **la collezione si riconosce** → la collezione: codici fuori produzione, varianti `MIX` ed
 *    `EXTRA`, finiture ritirate;
 * 3. **una collezione che non esiste più** → dove ha detto Marco il 20/10 (`COLLEZIONI_RITIRATE`);
 * 4. altrimenti niente, e la pagina risponde 404.
 *
 * Funzione pura: gli slug vivi arrivano da fuori, letti da Sanity con la cache per tag, così un
 * modello pubblicato domani funziona senza deploy.
 */

/** Lo slug di una scheda è il codice in minuscolo con «.» → «-»: vero su 591 schede su 591. */
export function slugDalCodice(codice: string): string {
  return codice.toLowerCase().replace(/\./g, "-");
}

/** I nomi del vecchio sito scritti come gli slug di oggi: `ORIGO_RAME` → `origo-rame`, `INeOUT` → `in-out`. */
function slugCollezione(nome: string): string {
  return nome
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/^ineout$/, "in-out");
}

/**
 * Collezioni del vecchio sito che oggi non esistono (Marco, 20/10/2026): LARES stava in Community
 * (P60 è fuori produzione da luglio); Zenit non ha una collezione, quindi l'indice.
 */
const COLLEZIONI_RITIRATE: Record<string, string> = {
  lares: "/collezioni/community",
  zenit: "/collezioni",
};

/** La destinazione di un vecchio `.aspx`, o `null` se non ce n'è una. */
export function destinazioneVecchioSito(
  file: string,
  modelli: ReadonlySet<string>,
  collezioni: ReadonlySet<string>,
): string | null {
  let nome: string;
  try {
    nome = decodeURIComponent(file);
  } catch {
    return null;
  }
  if (!/\.aspx$/i.test(nome)) return null;
  const pezzi = nome.replace(/\.aspx$/i, "").split("-");
  if (pezzi.length < 2 || pezzi.some((p) => p === "")) return null;

  // 1. Ogni taglio collezione|codice, dal nome di collezione più corto al più lungo.
  for (let i = 1; i < pezzi.length; i++) {
    const slug = slugDalCodice(pezzi.slice(i).join("-"));
    if (modelli.has(slug)) return `/modello/${slug}`;
  }
  // 2 e 3. Il prefisso più lungo che sia una collezione, viva o ritirata.
  for (let i = pezzi.length - 1; i >= 1; i--) {
    const collezione = slugCollezione(pezzi.slice(0, i).join("-"));
    if (collezioni.has(collezione)) return `/collezioni/${collezione}`;
    if (Object.hasOwn(COLLEZIONI_RITIRATE, collezione)) return COLLEZIONI_RITIRATE[collezione];
  }
  return null;
}
