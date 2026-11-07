import { afterEach, describe, expect, it } from "vitest";

import { siteUrl } from "@/lib/seo";

/**
 * ⚠️ Questi test esistono per un difetto che **nessun test poteva vedere**: su
 * Vercel `NEXT_PUBLIC_SITE_URL` è scritta con lo slash finale, mentre in locale
 * la variabile non è impostata e il fallback non ce l'ha. La guardia girava su
 * una base sana mentre la produzione ne serviva una malformata, e il difetto è
 * uscito solo leggendo l'HTML servito. Qui la variabile si impone a mano,
 * proprio per misurare la forma che il banco non incontra da sé.
 */

const ORIGINALE = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (ORIGINALE === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINALE;
});

describe("siteUrl", () => {
  it("toglie lo slash finale, che è la forma scritta su Vercel", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fontealta.it/";
    expect(siteUrl()).toBe("https://fontealta.it");
  });

  it("lascia intatta una base già senza slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fontealta.it";
    expect(siteUrl()).toBe("https://fontealta.it");
  });

  it("toglie anche più slash di seguito", () => {
    // Un incollaggio distratto nel pannello di Vercel non deve poter produrre
    // un URL storto: la variabile la scrive una persona.
    process.env.NEXT_PUBLIC_SITE_URL = "https://fontealta.it///";
    expect(siteUrl()).toBe("https://fontealta.it");
  });

  it("non tocca lo slash che sta DENTRO un percorso", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://esempio.it/sotto/cartella";
    expect(siteUrl()).toBe("https://esempio.it/sotto/cartella");
  });

  it("senza variabile ricade sul dominio di produzione, senza slash", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe("https://fontealta.it");
  });

  it("la base normalizzata non produce doppi slash quando viene concatenata", () => {
    // È il difetto misurato in produzione: il logo dell'Organization usciva
    // `…app//brand/…png` e rispondeva 308, e al cutover `robots.txt` avrebbe
    // dichiarato `Sitemap: https://fontealta.it//sitemap.xml`.
    process.env.NEXT_PUBLIC_SITE_URL = "https://fontealta.it/";
    expect(`${siteUrl()}/sitemap.xml`).toBe("https://fontealta.it/sitemap.xml");
    expect(`${siteUrl()}/brand/logo.png`).toBe("https://fontealta.it/brand/logo.png");
  });
});
