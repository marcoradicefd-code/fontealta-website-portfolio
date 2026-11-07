import { defineConfig, devices } from "@playwright/test";

import { FINTO_BREVO, FINTO_ZAPIER } from "./tests/regression/helpers/finto-zapier";

/**
 * DEDICATED config for the scroll-Lenis regression e2e — separato dal
 * `playwright.config.ts` generale (che punta a `pnpm dev` + include WebKit).
 *
 * Perché dedicato:
 *  - SOLO Chromium: il throttling di rete usa il CDP (Chrome DevTools Protocol),
 *    disponibile SOLO su Chromium. WebKit/Firefox non hanno `Network.emulate*` →
 *    la condizione "cold + 3G" non è riproducibile lì.
 *  - Target PRODUZIONE (`pnpm start`), NON `pnpm dev`: il bug (limite Lenis stale
 *    a cache fredda) dipende dai chunk reali code-split + assenza di cache dev. Il
 *    dev server (HMR, no split di prod) ha comportamento diverso e non riproduce.
 *  - Il build va fatto con `NEXT_PUBLIC_E2E=1` per esporre `window.__lenis`
 *    (vedi LenisProvider). Lo fa lo script `pnpm test:e2e`.
 *
 * NON è nel four-check: è lento per natura (rete finta 3G) → gira solo via
 * `pnpm test:e2e`.
 */
const PORT = 3000;

/**
 * I worker della suite: 2 di serie, `E2E_WORKERS` per cambiarli (26/10/2026). Un valore che
 * non è un intero da 1 in su ferma la suite con un errore: un refuso non deve far girare a 2
 * chi voleva lasciare il Mac libero.
 */
function workersDaEnv(valore: string | undefined): number {
  if (valore === undefined || valore === "") return 2;
  const n = Number(valore);
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`E2E_WORKERS deve essere un intero da 1 in su, non «${valore}»`);
  return n;
}

export default defineConfig({
  testDir: "./tests/regression",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Un secondo tentativo SOLO con CI=true (decisione di Marco del 21/10/2026): il flake noto di
  // WebKit su barra-scorrimento.spec.ts:136 (2 su 30 anche su main) esce «flaky» e non rosso,
  // e il riepilogo lo elenca. In locale resta 0, così un flake si vede e si ripete a mano.
  // ⚠️ Dal 22/10/2026 nessun job della CI lancia l'e2e (gira sul Mac con `pnpm e2e:firma`):
  // questa riga e il reporter qui sotto restano perché non costano niente.
  retries: process.env.CI ? 1 : 0,
  // DUE worker dal 26/10/2026 (Marco, dopo la misura): 3 giri a 2 worker su `e1d7eab`, 390, 393
  // e 412 s, ogni volta 864 passati, 1 saltato, 0 rossi e 0 instabili, contro i 12,4-13,1 minuti
  // delle firme a 1 worker dello stesso giorno. `fullyParallel` resta false: le prove di un file
  // girano in fila nello stesso worker. I finti Zapier e Brevo sono condivisi, e ogni prova ha
  // un indirizzo suo (`unica()` con `testInfo.testId`). Playwright consiglia 1 worker sulle CI
  // condivise: questa config gira sul Mac, con la firma.
  // `E2E_WORKERS=1 pnpm e2e:firma` la fa girare a un worker, per quando Marco lavora sul Mac
  // durante la firma: la firma passa l'ambiente a `pnpm test:e2e` così com'è.
  workers: workersDaEnv(process.env.E2E_WORKERS),
  // Con CI=true anche il rapporto HTML (21/10/2026): era la cartella `playwright-report` che il
  // job `e2e` caricava come artifact quando falliva. In locale resta la sola lista.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // Rete finta 3G → il singolo test è lento: timeout per-test generoso.
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  // Chromium per tutto (CDP-only). ⚠️ UNA eccezione, set 2026: l'apertura del menu
  // gira ANCHE su WebKit, perché il `:hover` che resta attaccato dopo un tocco esiste
  // solo lì. Il progetto WebKit è ristretto a quel file con `testMatch`: le altre
  // spec usano il CDP e su WebKit morirebbero per il motivo sbagliato.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "webkit-menu",
      use: { ...devices["Desktop Safari"] },
      testMatch: /menu-apertura\.spec\.ts/,
    },
    /**
     * Il coverflow gira anche su WebKit, e qui il motore serve per quello che
     * SA fare: dire se sopra il contesto 3D è rimasto un livello di
     * composizione. Non per dire se il 3D si vede — quel WebKit la prospettiva
     * non la dipinge affatto, misurato il 21/09/2026 anche sul caso minimo.
     */
    {
      name: "webkit-coverflow",
      use: { ...devices["Desktop Safari"] },
      testMatch: /coverflow-composizione\.spec\.ts/,
    },
    /**
     * La barra della nav cambia di colpo alla soglia (16/10/2026): il colore dipinto al
     * primo fotogramma, come per l'apertura del menu, e `backdrop-filter` è il punto dove i
     * due motori differiscono di più.
     */
    {
      name: "webkit-barra",
      use: { ...devices["Desktop Safari"] },
      testMatch: /barra-scorrimento\.spec\.ts/,
    },
    /** Menu alti come i campi (14/10/2026): una misura di geometria, che WebKit sa fare. */
    {
      name: "webkit-campi",
      use: { ...devices["Desktop Safari"] },
      testMatch: /campi-allineati\.spec\.ts/,
    },
    /**
     * La pagina della tavola (27/10/2026): altezze con `100dvh` e `:has()`, la rotella
     * sopra un iframe e il fuoco che entra ed esce dall'iframe, dove i due motori
     * possono differire. Senza CDP.
     */
    {
      name: "webkit-officina",
      use: { ...devices["Desktop Safari"] },
      testMatch: /officina\.spec\.ts/,
    },
  ],
  webServer: [
    /**
     * Finto Zapier (13/10/2026): con `next start` il modulo non va in dry-run, quindi ogni
     * invio riuscito di una spec va a un webhook. Questo server lo riceve al posto di Zapier,
     * e `modulo-note-paese.spec.ts` FALLISCE se un invio non gli arriva.
     */
    {
      command: `node tests/regression/helpers/finto-zapier.mjs`,
      url: `${FINTO_ZAPIER}/`,
      reuseExistingServer: false,
      timeout: 10_000,
    },
    /**
     * Finto Brevo (19/10/2026): con la richiesta del catalogo il sito manda l'email via Brevo, e
     * qui la riceve questo server. `BREVO_API_URL` lo accetta solo perché l'host è locale.
     */
    {
      command: `node tests/regression/helpers/finto-brevo.mjs`,
      url: `${FINTO_BREVO}/`,
      reuseExistingServer: false,
      timeout: 10_000,
    },
    {
      command: "pnpm start",
      url: `http://localhost:${PORT}`,
      // ⛔ MAI riuso (13/10/2026): un `pnpm start` già acceso non ha l'`env` qui sotto, e
      // con un webhook vero un e2e del modulo manderebbe un lead ad Andrea prima di
      // fallire. Porta occupata → la suite non parte, che è l'errore giusto (e cura anche
      // la trappola del server senza `NEXT_PUBLIC_E2E`, rule `misure-e-test`).
      reuseExistingServer: false,
      timeout: 120_000,
      /**
       * ⛔ Il webhook si FORZA qui: le variabili già presenti nell'ambiente vincono sui file
       * `.env*` (`@next/env`), quindi anche con un webhook vero in `.env.local` le prove
       * vanno al finto. Mai un lead vero da un e2e.
       */
      // Lo stesso per Brevo: la chiave finta e l'indirizzo locale vincono su ogni `.env*`.
      env: {
        ZAPIER_CONTACT_WEBHOOK_URL: `${FINTO_ZAPIER}/hook`,
        BREVO_API_URL: FINTO_BREVO,
        BREVO_API_KEY: "chiave-finta-e2e",
      },
    },
  ],
});
