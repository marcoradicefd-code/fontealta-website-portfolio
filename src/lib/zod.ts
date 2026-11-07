import { z } from "zod";

/**
 * Zod si importa da qui, mai da `"zod"`: lo impone `no-restricted-imports` in
 * `eslint.config.mjs`. La ragione è l'ORDINE.
 *
 * Zod decide alla COSTRUZIONE di ogni `z.object` (non al parse) se compilarne la
 * validazione, e per deciderlo prova `new Function("")` (`zod/v4/core/schemas.js`,
 * 4.4.3, righe 970-972). Sotto la CSP del sito il browser segnala quella prova come
 * violazione `script-src` `eval`, anche se Zod intercetta l'errore: misurato il
 * 15/10/2026, una per ogni pagina col modulo. Zod lo scrive nel suo sorgente
 * (`zod/v4/core/util.js`): «strict CSPs report the caught `new Function` as a
 * `securitypolicyviolation` even though the throw is swallowed». E la sua guida
 * (https://zod.dev/compile, «Content Security Policy»): «Global mode stands down
 * when `jitless` is set».
 *
 * Un modulo ES viene eseguito per intero prima di chi lo importa: passando tutti
 * da qui, `jitless` è attivo prima che esista un solo schema. Una `z.config` messa
 * dentro un file di schemi varrebbe solo se nessun altro modulo costruisse uno
 * schema prima di lui. Senza il compilatore la validazione resta identica.
 */
z.config({ jitless: true });

export { z };
