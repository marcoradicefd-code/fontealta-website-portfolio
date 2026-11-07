/**
 * Cantiere INCASSI — predicato del filtro «Ambiente» sull'indice dei corpi.
 *
 * ⚠️ SEMANTICA ARRAY, non uguaglianza. Un corpo dichiara N macro servite in
 * `servesMacros` e deve comparire sotto OGNI ambiente che serve. Il predicato delle
 * collezioni è `activeTypes.has(resolveMacro(m))` — un valore SINGOLO — e ricopiarlo
 * qui farebbe sparire ogni corpo multi-ambiente da tutti i filtri tranne uno.
 *
 * La firma della regressione è aritmetica, ed è il motivo per cui i conteggi stanno
 * nei test: con la semantica giusta la somma dei tre gruppi è 24 su 17 corpi (sette
 * corpi ne servono più d'uno); con l'uguaglianza stretta tornerebbe esattamente 17,
 * cioè il totale — un numero che sembra sano proprio perché è il totale.
 *
 * Composizione OR fra i gruppi attivi, identica alle collezioni: nessun filtro attivo
 * → passano tutti.
 */
export function matchesActiveMacros(
  body: { servesMacros?: string[] | null },
  active: ReadonlySet<string>,
): boolean {
  if (active.size === 0) return true;
  return body.servesMacros?.some((macro) => active.has(macro)) === true;
}
