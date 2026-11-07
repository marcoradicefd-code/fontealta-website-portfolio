/**
 * L'ordine delle chiavi (nomi di file, codici di lingua, percorsi): per punto di codice, uguale su
 * ogni macchina, senza le regole di una lingua. Sonar S2871 vuole una funzione di confronto
 * esplicita in ogni `sort()`; questa è l'unica del repo per le stringhe da ordinare così (era in
 * `contenuti-carica.ts`, spostata qui il 5/11/2026 per `post-link.ts` e i test e2e).
 */
export const perPuntoDiCodice = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
