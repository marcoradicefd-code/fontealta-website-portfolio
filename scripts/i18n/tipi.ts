/**
 * I tipi di documento che portano campi localizzati: quelli che `export-content` esporta per i
 * traduttori.
 *
 * ⚠️ **Scritto a mano e non dedotto**, perché esportare per sbaglio un tipo di servizio
 * riempirebbe la cartella di file che nessuno deve tradurre. Ma scritto a mano **invecchia**, e il
 * 16/09/2026 è successo: `author` ha `role` e `bio` localizzati e non c'era, quindi ruolo e
 * biografia dei due autori sono rimasti senza tedesco, francese e spagnolo mentre tutto il resto
 * del dataset le aveva. Le pagine DE/FR/ES del blog servivano l'italiano sotto «Scritto da».
 *
 * La rete è `tipi.test.ts`: ricava dallo **schema vero** i tipi di documento con almeno un campo
 * localizzato, a qualunque profondità, e li confronta con questo elenco. Un tipo localizzato
 * nuovo che non entra qui fa cadere il test, e viceversa.
 *
 * Questo file non importa niente: lo carica `export-content`, che gira con `tsx` fuori dal bundle.
 */
export const LOCALIZED_DOCUMENT_TYPES = [
  "collection",
  "model",
  "concealedBody",
  "post",
  "category",
  "projectReference",
  "finish",
  "siteSettings",
  "author",
  "contentPage",
] as const;
