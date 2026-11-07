import { expect, test } from "@playwright/test";

// Pin IT locale so /contatti renders IT (not the en-US browser default → /contact).
test.use({ locale: "it-IT" });

/**
 * Q2 a11y smoke — contact form happy path → success renders in the new <output>
 * element (Q2 changed the success <p role="status"> to a native <output>).
 *
 * Safe by construction: ZAPIER_CONTACT_WEBHOOK_URL is absent in dev, so
 * submitContact DRY-RUNS — no real Zapier lead is sent (validated by the unit
 * test "webhook assente in DEV → dry-run success, no fetch").
 *
 * ⚠️ **Lo zero della finestra anti-bot è l'IDRATAZIONE, non `goto`** (10/09/2026).
 * `_ts` non è un campo del DOM: è `mountedAt`, cioè `useState(() => Date.now())`
 * dentro `use-contact-submit.ts:24`, che nasce quando il componente client si
 * monta. Quindi i tre secondi si contano da lì. La versione precedente aspettava
 * `3200 ms` dal `goto`, cioè la finestra più duecento millisecondi di margine: su
 * un WebKit emulato l'idratazione può arrivare dopo quel margine, e il submit
 * cadeva dentro la trappola. Era la spiegazione più economica del rosso
 * permanente su `mobile-safari`, ed è quella che questa spec toglie di mezzo.
 *
 * L'idratazione si prova con un segnale **pubblico**, non con un interno di
 * React: `aria-invalid` sui campi è `false` nell'HTML servito e diventa `"true"`
 * solo quando react-hook-form valida in locale (`contact-form.tsx:64`). Un
 * tentativo di invio con una email non valida lo fa scattare **senza** toccare la
 * rete: da lì in poi sappiamo che `mountedAt` esiste già.
 *
 * ⚠️ Quel che questa spec NON può distinguere dal browser: un invio vero da uno
 * caduto nella trappola. Tutti e due rendono l'`<output>`, perché la trappola
 * risponde con un finto successo apposta (non si tippa un bot). La copertura di
 * quel ramo sta in `actions.test.ts`, lato server.
 *
 * ⛔ **SALTATA SU WEBKIT dal 10/09/2026, e non perché il sito abbia un difetto.**
 * Su Safari vero il modulo funziona: `POST / 200` alle 09:18:09Z e
 * `POST /it/contatti 200` alle 09:21:32Z nei log di produzione, da un iPhone in
 * mano a una persona. Sul WebKit che Playwright installa (26.5, build 2336, con
 * `@playwright/test` 1.62.1) la Server Action **non arriva a destinazione**, e il
 * verdetto **non è riproducibile**: 0 su 5, poi un passaggio isolato, poi 0 su 3
 * su quattro varianti diverse.
 *
 * Cosa è stato escluso, misurando e non ragionando:
 *   - **non è il tempo**: lo zero della finestra anti-bot è ancorato
 *     all'idratazione, e la validazione locale scatta (`aria-invalid` → `"true"`);
 *   - **non è il touch né il viewport**: Desktop Safari senza touch fallisce
 *     uguale, iPhone senza touch pure, e Pixel 7 (Chromium mobile) passa;
 *   - **non è un errore che qualcuno inghiotte**: zero errori in console, zero
 *     `unhandledrejection`, e la transizione **parte** (`isPending` osservato);
 *   - **non è il doppio invio** introdotto dalla prova dell'idratazione: fallisce
 *     anche con un invio solo.
 * Misurato contando le richieste vere, non patchando `window.fetch`: su WebKit
 * **zero POST** dopo il submit, su Chromium **uno** verso `/contatti`.
 *
 * Un verdetto che non si riproduce non è una guardia: è un rosso che insegna a
 * ignorare i rossi. Il progetto `mobile-safari` resta acceso per le altre due
 * spec di `tests/e2e/`, che su WebKit passano e coprono davvero.
 *
 * ⚠️ **La prossima prova, quando qualcuno ci tornerà**: `@playwright/test`
 * 1.63.0 (uscita, non ancora adottata: i minori li porta Dependabot) spedisce un
 * WebKit diverso. Se lì il POST parte, questo skip si toglie in una riga. È
 * un'ipotesi, non una diagnosi, e va provata prima di crederci.
 */

const FINESTRA_ANTIBOT_MS = 3000;

test("contact form submits and shows the success output", async ({ page, browserName }) => {
  test.skip(
    browserName === "webkit",
    "Il WebKit di Playwright non porta a termine la Server Action su questo form, e il verdetto non e' riproducibile. Vedi il cappello: il sito funziona su Safari vero.",
  );

  await page.goto("/contatti");

  await page.fill('input[name="nome"]', "Mario");
  await page.fill('input[name="cognome"]', "Rossi");
  await page.fill('input[name="telefono"]', "+39 333 3333333");
  await page.fill('input[name="azienda"]', "ACME Srl");
  await page.selectOption('select[name="richiesta"]', { index: 1 }); // 0 = segnaposto
  await page.selectOption('select[name="paese"]', "IT"); // obbligatorio dal 13/10/2026

  // 1. Prova dell'idratazione: email non valida → RHF valida in locale e alza
  //    `aria-invalid`. Nessuna richiesta parte: la validazione precede l'invio.
  const email = page.locator('input[name="email"]');
  await email.fill("non-una-email");
  await page.locator('button[type="submit"]').click();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  const idratatoA = Date.now();

  // 2. Da qui i tre secondi hanno uno zero noto: `mountedAt` è <= `idratatoA`.
  await email.fill("mario.rossi@example.com");
  const restano = FINESTRA_ANTIBOT_MS - (Date.now() - idratatoA);
  if (restano > 0) await page.waitForTimeout(restano + 100);

  /**
   * ⚠️ **Il corpo del POST, e non solo l'`<output>`** (7/10/2026). Dal 7/10 il server
   * scarta in silenzio, con un finto successo, ogni invio senza `_ts` o `_gotcha`: dal
   * browser un invio scartato e uno vero sono identici, quindi l'unico modo di sapere
   * che il modulo vero non cade nella trappola nuova è guardare cosa manda. La Server
   * Action si riconosce dall'header `Next-Action`.
   */
  const invio = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await page.locator('button[type="submit"]').click();
  const corpo = (await invio).postData() ?? "";
  expect(corpo, "il submit normale deve mandare _ts").toMatch(/"_ts":\d{13}/);
  expect(corpo, "il submit normale deve mandare _gotcha vuoto").toContain('"_gotcha":""');
  await expect(page.locator("output").first()).toBeVisible();
});
