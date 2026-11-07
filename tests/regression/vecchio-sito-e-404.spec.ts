import { expect, test } from "@playwright/test";

/**
 * Nessun percorso deve dare 500 (20/10/2026).
 *
 * Dal 14/10 (#248) ogni percorso di un solo segmento col punto (`/apple-touch-icon.png`, gli
 * indirizzi `.aspx` e `.html` del vecchio sito, le sonde dei bot) arrivava a `[locale]` con la
 * lingua «apple-touch-icon.png», perché il proxy di next-intl salta i percorsi col punto; la home
 * la passava a `Intl.DisplayNames` e rispondeva 500. Cura: la rewrite `afterFiles` di
 * `rewriteDopoIFile` (`src/lib/redirects.ts`). Il verbale è `docs/history/2026-10-20-locale-404.md`.
 *
 * ⚠️ Le destinazioni delle schede `.aspx` dipendono dal catalogo vivo (Sanity): i campioni sono
 * schede che esistono da mesi (`c50r-me`, `q120`). Se un giorno una esce di produzione, il suo
 * indirizzo vecchio porterà alla collezione, ed è giusto: si cambia il campione, non la regola.
 */

const NON_TROVATA_IT = "Questa pagina non esiste, o non esiste più.";

/** Il percorso di un `Location`, relativo o assoluto. */
const percorso = (location: string | undefined) =>
  location ? new URL(location, "http://x").pathname : null;

test.describe("i percorsi dei bot e i vecchi indirizzi senza corrispondenza danno 404, mai 500", () => {
  for (const p of [
    "/xyz.php",
    "/.env",
    "/ads.txt",
    "/secrets.json",
    "/foo.bar/collezioni",
    "/foo.bar/modello/b40l",
    "/career.aspx",
    "/PIPPO-XYZ.aspx",
    "/wp-sitemap.xml",
    "/a/b/Telerik.Web.UI.DialogHandler.aspx",
    "/IT/xyz.php",
  ]) {
    test(`${p} → 404`, async ({ request }) => {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status()).toBe(404);
    });
  }

  test("la 404 si vede in italiano, con la barra e il footer", async ({ page }) => {
    for (const p of ["/xyz.php", "/foo.bar/modello/b40l", "/career.aspx"]) {
      const res = await page.goto(p);
      expect(res?.status(), p).toBe(404);
      await expect(page.locator("h1"), p).toHaveText(NON_TROVATA_IT);
      await expect(page.locator("html"), p).toHaveAttribute("lang", "it");
      await expect(page.locator("header").first(), p).toBeVisible();
      await expect(page.locator("footer").first(), p).toBeVisible();
    }
  });

  test("con la lingua nel percorso la 404 resta nella sua lingua", async ({ page }) => {
    const res = await page.goto("/en/xyz.php");
    expect(res?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  // Il <title> nella lingua della pagina (22/10/2026): prima era il `title.default` del
  // layout, in inglese, in tutte le lingue. DE, FR ed ES sono da far vedere ad Alma.
  for (const [p, titolo] of [
    ["/xyz-che-non-esiste", "Pagina non trovata | Fontealta"],
    ["/en/xyz", "Page not found | Fontealta"],
    ["/de/xyz", "Seite nicht gefunden | Fontealta"],
    ["/fr/xyz", "Page introuvable | Fontealta"],
    ["/es/xyz", "Página no encontrada | Fontealta"],
  ]) {
    test(`${p}: il titolo della 404 è «${titolo}»`, async ({ page }) => {
      const res = await page.goto(p);
      expect(res?.status()).toBe(404);
      await expect(page).toHaveTitle(titolo);
    });
  }
});

test.describe("le icone Apple alla radice danno l'icona che c'è già", () => {
  for (const p of ["/apple-touch-icon.png", "/apple-touch-icon-precomposed.png"]) {
    test(`${p} → 200, PNG`, async ({ request }) => {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toBe("image/png");
      const icona = await request.get("/apple-icon.png");
      expect(Buffer.compare(await res.body(), await icona.body())).toBe(0);
    });
  }
});

test.describe("i vecchi indirizzi danno 308 alla destinazione giusta", () => {
  for (const [vecchio, nuovo] of [
    // Scheda viva: vince il codice, anche quando la collezione del vecchio sito è un'altra.
    ["/ORIGO_RAME-C50R.ME.aspx", "/modello/c50r-me"],
    ["/IDRA-Q120.aspx", "/modello/q120"],
    // Codice fuori produzione o variante: la collezione.
    ["/WATERLINE-W60-E.aspx", "/collezioni/waterline"],
    ["/CLUB-C90-MIX.aspx", "/collezioni/club"],
    // Collezioni che non esistono più (Marco, 20/10/2026).
    ["/LARES-P60.aspx", "/collezioni/community"],
    ["/ZENIT-Q70.M.aspx", "/collezioni"],
    // Indirizzi fissi.
    ["/Landing-ITSkinny.html", "/collezioni/skinny"],
    ["/Landing-ITIWS.html", "/collezioni"],
    ["/home.aspx", "/"],
    ["/contatti.aspx", "/contatti"],
    ["/sitemap_it.xml", "/sitemap.xml"],
    ["/sitemap_index.xml", "/sitemap.xml"],
  ]) {
    test(`${vecchio} → 308 ${nuovo}`, async ({ request }) => {
      const res = await request.get(vecchio, { maxRedirects: 0 });
      expect(res.status()).toBe(308);
      expect(percorso(res.headers()["location"])).toBe(nuovo);
      const arrivo = await request.get(nuovo);
      expect(arrivo.status(), `${nuovo} deve rispondere 200`).toBe(200);
    });
  }
});

test.describe("il resto del sito non cambia", () => {
  for (const [p, lingua] of [
    ["/", "it"],
    ["/en", "en"],
    ["/de", "de"],
    ["/fr", "fr"],
    ["/es", "es"],
    // Schede generate su richiesta: le prime vittime di una cura sbagliata (`dynamicParams`).
    ["/modello/b40l", "it"],
    ["/en/model/b40l", "en"],
    ["/de/modell/b40l", "de"],
    ["/collezioni/boss", "it"],
  ] as const) {
    test(`${p} → 200 in ${lingua}`, async ({ request }) => {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status()).toBe(200);
      expect(await res.text()).toContain(`<html lang="${lingua}"`);
    });
  }

  for (const p of [
    "/robots.txt",
    "/sitemap.xml",
    "/llms.txt",
    "/apple-icon.png",
    "/og-default.jpg",
  ]) {
    test(`${p} → 200`, async ({ request }) => {
      expect((await request.get(p, { maxRedirects: 0 })).status()).toBe(200);
    });
  }
});
