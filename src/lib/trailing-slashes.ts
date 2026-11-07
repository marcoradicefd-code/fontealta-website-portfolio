/**
 * Toglie le `/` finali, come `s.replace(/\/+$/, "")` ma in tempo lineare (28/10/2026).
 *
 * ⚠️ **La regex è quadratica**: su una fila di `/` che non chiude la stringa il motore riparte da
 * ogni `/` e la scorre tutta fino alla fine. Misurato da Cowork: 8.000 → 34 ms, 16.000 → 125 ms,
 * 32.000 → 513 ms. In `deriveSource` la stringa viene dal `Referer`, cioè da chi chiama la Server
 * Action (Sonar S8786). Qui si scorre all'indietro una volta sola.
 *
 * ⚠️ Nessun import: la usa anche `seo.ts`, che `next.config.ts` carica prima del bundle, dove
 * l'alias `@/` non esiste (`urls.ts` spiega il perché).
 */
export function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s[end - 1] === "/") end--;
  return s.slice(0, end);
}
