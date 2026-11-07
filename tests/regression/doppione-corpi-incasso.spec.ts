import { expect, test } from "@playwright/test";

/**
 * Regressione «un indirizzo, una pagina» (settembre 2026).
 *
 * `/en/collections/corpi-a-incasso` rispondeva **200** con il contenuto
 * dell'indice dei corpi, cioè lo stesso contenuto di
 * `/en/collections/concealed-bodies` sotto un indirizzo che non è il suo. Nasce
 * dall'incrocio di due comportamenti corretti: il documento `collection` con
 * slug `corpi-a-incasso` esiste, quindi il path combacia con la rotta dinamica
 * nella sua forma inglese `/collections/[slug]`; e una volta riscritto nel path
 * interno, Next dà precedenza al segmento statico sul dinamico fratello.
 *
 * ⚠️ Il redirect NON sta nella pagina `collezioni/[slug]`: per quello slug non
 * viene invocata mai, in nessuna lingua, proprio per quella precedenza. Sta nei
 * `redirects()` di `next.config.ts`, che è l'unico gancio che gira **prima**
 * della riscrittura del proxy di next-intl. Questo test è ciò che tiene ferma
 * quella catena: se qualcuno spostasse il redirect dentro la pagina, il 308
 * sparirebbe e l'URL tornerebbe a rispondere 200.
 */

const DOPPIONE = "/en/collections/corpi-a-incasso";
const GIUSTO = "/en/collections/concealed-bodies";

test.describe("doppioni di rotta · corpi a incasso", () => {
  test("il doppione inglese risponde 308 verso l'indice dei corpi", async ({ request }) => {
    const res = await request.get(DOPPIONE, { maxRedirects: 0 });
    expect(
      res.status(),
      "deve essere permanente: un 307 direbbe ai motori di tenersi l'URL vecchio",
    ).toBe(308);
    expect(res.headers()["location"]).toBe(GIUSTO);
  });

  test("seguendolo si arriva alla pagina giusta, in un salto solo", async ({ page }) => {
    const res = await page.goto(DOPPIONE);
    expect(res?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(GIUSTO);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${GIUSTO}$`),
    );
  });

  test("l'italiano non è toccato: quel percorso è già quello canonico", async ({ request }) => {
    // In italiano la chiave dinamica e quella statica danno lo stesso path, quindi
    // non c'è niente da spostare. È la ragione per cui la lista dei redirect ha
    // una voce sola.
    const res = await request.get("/collezioni/corpi-a-incasso", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });

  test("le altre collezioni non sono toccate, `accessories` compresa", async ({ request }) => {
    for (const path of [
      "/collezioni/boss",
      "/en/collections/boss",
      "/collezioni/accessories",
      "/en/collections/accessories",
    ]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `${path} deve restare 200`).toBe(200);
    }
  });

  test("la sitemap non contiene il doppione", async ({ request }) => {
    // Controprova a runtime di ciò che `src/lib/sitemap.test.ts` asserisce sul
    // dato: la sitemap non deve annunciare un URL che redirige.
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).not.toContain(DOPPIONE);
    expect(xml).toContain(GIUSTO);
  });
});
