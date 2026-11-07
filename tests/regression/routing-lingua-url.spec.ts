import { expect, test } from "@playwright/test";

import { ACTIVE_LOCALES, ALL_LOCALES } from "../../src/i18n/routing";
import { NOMI_LINGUA } from "../../src/lib/lingue";

/**
 * Regressione «un URL è una lingua» (settembre 2026).
 *
 * Due default di next-intl, entrambi `true`, entrambi spenti nella PR SEO. Sono
 * il tipo di cosa che rientra da sola: basta che qualcuno riscriva
 * `defineRouting` guardando la documentazione, dove quei due campi non compaiono
 * perché sono i default.
 *
 *  1. `localeDetection: false`. Prima ogni URL italiano senza prefisso faceva
 *     **307** verso l'equivalente `/en` se la richiesta portava
 *     `Accept-Language: en`. Googlebot non manda quell'header e non lo vedeva;
 *     bingbot sì, verificato in produzione. E lo subiva ogni persona col browser
 *     in inglese che apriva un link italiano esplicito.
 *  2. `alternateLinks: false`. Il middleware metteva un header HTTP `Link` con
 *     gli hreflang su ogni pagina, con `x-default` verso l'italiano. Da questa PR
 *     `x-default` è l'inglese e sta in `alternates`: due sorgenti che dicono cose
 *     diverse sulla stessa pagina sono peggio di una sorgente sola.
 *
 * ⚠️ Il test NON asserisce che gli hreflang non esistano: esistono, nell'HTML.
 * Asserisce che non arrivino DUE VOLTE per due strade diverse.
 */

const URL_ITALIANI = ["/", "/collezioni", "/modello/b40l", "/blog", "/produzione"];
const INGLESE = { "Accept-Language": "en-US,en;q=0.9" };

test.describe("routing · un URL è una lingua", () => {
  for (const path of URL_ITALIANI) {
    test(`${path} risponde 200 in italiano anche a un browser inglese`, async ({ browser }) => {
      // Contesto nuovo per ogni test: `NEXT_LOCALE` sopravvive alle navigazioni e
      // una visita EN precedente falserebbe la misura.
      const context = await browser.newContext({ extraHTTPHeaders: INGLESE });
      const page = await context.newPage();

      const res = await page.goto(path);
      expect(res?.status(), `${path} deve rispondere 200, non un 307`).toBe(200);
      expect(new URL(page.url()).pathname, `${path} non deve essere rediretto`).toBe(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "it");

      await context.close();
    });
  }

  test("nessuna pagina emette un header Link con hreflang", async ({ request }) => {
    for (const path of [...URL_ITALIANI, "/en", "/en/collections", "/questa-non-esiste"]) {
      const res = await request.get(path, { headers: INGLESE, maxRedirects: 0 });
      const link = res.headers()["link"] ?? "";
      expect(link, `${path} non deve portare hreflang nell'header Link`).not.toContain("hreflang");
    }
  });

  /**
   * ⛔ **Accendere una lingua deve restare una riga sola.**
   *
   * Il selettore disegna tutte e cinque le lingue di `ALL_LOCALES` e spegne
   * quelle fuori da `ACTIVE_LOCALES`: il giorno dell'accensione non c'è niente
   * da aggiungere qui, né in `lingue.ts`, che i cinque nomi ce li ha già. Questo
   * test è ciò che tiene ferma quella promessa — se qualcuno cablasse due
   * lingue a mano nel nav, l'accensione tornerebbe a essere due modifiche, e la
   * seconda ce la si dimentica.
   *
   * ⚠️ Le voci spente hanno il `disabled` NATIVO, non `aria-disabled`: comunica
   * lo stato ma le toglie dal fuoco, ed è una scelta a registro da rivedere
   * insieme all'i18n. Qui si asserisce lo stato di fatto, non quello ideale.
   *
   * ⚠️ **Le attese si leggono da `ALL_LOCALES`, `ACTIVE_LOCALES` e `NOMI_LINGUA`,
   * non si scrivono a mano** (set 2026). Fino alla #207 il test aveva le cinque
   * lingue cablate con DE, FR ed ES spente, ed è rimasto rosso anche in produzione
   * dal giorno dell'accensione (#201): proprio la «seconda modifica» che questo
   * test doveva evitare, spostata dentro il test. Ora accendere o spegnere una
   * lingua resta una riga in `routing.ts`, e il test la segue da solo.
   */
  test("il selettore mostra le cinque lingue e spegne quelle non attive", async ({ page }) => {
    await page.goto("/");
    const attese = ALL_LOCALES.map(
      (codice) =>
        [NOMI_LINGUA[codice], (ACTIVE_LOCALES as readonly string[]).includes(codice)] as const,
    );
    for (const [nome, attiva] of attese) {
      const voce = page.locator(`button:has-text("${nome}")`).first();
      await expect(voce, `${nome} non compare nel selettore`).toHaveCount(1);
      const spenta = await voce.isDisabled();
      expect(spenta, `${nome}: atteso ${attiva ? "attivo" : "spento"}`).toBe(!attiva);
    }
  });

  test("il selettore di lingua continua a portare su /en", async ({ browser }) => {
    const context = await browser.newContext({ extraHTTPHeaders: INGLESE });
    const page = await context.newPage();
    const res = await page.goto("/en");
    expect(res?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await context.close();
  });
});
