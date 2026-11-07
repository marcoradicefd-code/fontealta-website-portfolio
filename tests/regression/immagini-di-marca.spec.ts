import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Regressione «immagini di marca servite» (settembre 2026).
 *
 * La guardia unitaria (`src/app/immagini-di-marca.test.ts`) dice che i file
 * COMMITTATI sono quelli approvati. Questa dice le altre due metà: che i file
 * committati sono anche quelli SERVITI, e che quello che si vede dentro è la
 * card di marca e non una fotografia.
 *
 * ⚠️ **Nessuna impronta scritta qui dentro.** L'atteso si calcola dal file su
 * disco al momento del test: un'impronta ripetuta in due posti ne ha una
 * vecchia, e questo test risponde a «server e repo dicono la stessa cosa?», non
 * a «qual è l'immagine giusta?».
 *
 * ⚠️ **Per questo da sola non basta, e il 10/09 si è visto perché.** Se il file
 * del repo fosse quello sbagliato, il confronto server-repo resterebbe verde: è
 * successo nella controprova, servendo la vecchia fotografia di prodotto messa
 * anche in `public/`. La domanda «che cosa c'è dentro» ha bisogno di guardare i
 * pixel, ed è l'ultimo test del file.
 *
 * ⚠️ **Si confrontano i PERCORSI, non gli URL interi.** Su un build locale la
 * base è `http://localhost:3000`, in produzione un altro host: un confronto
 * sull'URL intero sarebbe verde solo sulla macchina di chi l'ha scritto.
 */

const CARD_OG = "/og-default.jpg";

/** I tre file di marca, con il selettore del `<link>` che li dichiara. La card
 *  OG non ha un `<link>`: la dichiarano i meta, ed è il test dedicato. */
const ICONE = [
  {
    nome: "favicon.ico",
    selettore: 'link[rel="icon"][type="image/x-icon"]',
    percorso: "src/app/favicon.ico",
    misura: "256x256",
  },
  {
    nome: "icon.png",
    selettore: 'link[rel="icon"][type="image/png"]',
    percorso: "src/app/icon.png",
    misura: "512x512",
  },
  {
    nome: "apple-icon.png",
    selettore: 'link[rel="apple-touch-icon"]',
    percorso: "src/app/apple-icon.png",
    misura: "180x180",
  },
] as const;

function improntaFile(percorso: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(process.cwd(), percorso)))
    .digest("hex");
}

function improntaCorpo(corpo: Buffer): string {
  return createHash("sha256").update(corpo).digest("hex");
}

/**
 * Decodifica un'immagine NEL BROWSER e ne misura la composizione.
 *
 * È l'unico posto del progetto dove un JPEG e un PNG si leggono senza aggiungere
 * una dipendenza: `img.decode()` più un canvas. Le icone sono opache su tutta la
 * superficie (verificato sul canale alfa: zero pixel trasparenti), quindi non
 * c'è composizione col fondo del canvas da tenere in conto.
 */
async function composizione(page: import("@playwright/test").Page, src: string) {
  return page.evaluate(async (indirizzo) => {
    const img = new Image();
    img.src = indirizzo;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const px = (x: number, y: number) => {
      const i = (y * c.width + x) * 4;
      return [d[i], d[i + 1], d[i + 2]] as [number, number, number];
    };
    const vicino = (p: number[], r: number[], t: number) =>
      p.every((v, i) => Math.abs(v - r[i]) <= t);
    let ink = 0,
      chiaro = 0,
      altro = 0;
    for (let y = 0; y < c.height; y += 3)
      for (let x = 0; x < c.width; x += 3) {
        const p = px(x, y);
        if (vicino(p, [11, 18, 21], 18)) ink++;
        else if (vicino(p, [246, 244, 240], 22)) chiaro++;
        else altro++;
      }
    const tot = ink + chiaro + altro;
    return {
      larghezza: c.width,
      altezza: c.height,
      angolo: px(2, 2),
      ink: (ink / tot) * 100,
      chiaro: (chiaro / tot) * 100,
      altro: (altro / tot) * 100,
    };
  }, src);
}

test.describe("immagini di marca · servito", () => {
  test("la card OG servita è byte per byte quella del repo", async ({ request }) => {
    const res = await request.get(CARD_OG);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/jpeg");
    expect(improntaCorpo(await res.body())).toBe(improntaFile("public/og-default.jpg"));
  });

  /**
   * `twitter:image` non è dichiarato da nessuna parte nel progetto: il layout
   * dichiara solo `twitter: { card: "summary_large_image" }`, e Next ricava
   * l'immagine da `openGraph.images`. È comodo e invisibile, cioè esattamente il
   * genere di cosa che sparisce senza rumore il giorno che una pagina dichiara
   * un `twitter` proprio. Qui si guarda l'HTML servito, non l'intenzione.
   */
  test("og:image e twitter:image puntano alla stessa card", async ({ page }) => {
    await page.goto("/");

    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    const tw = await page.locator('meta[name="twitter:image"]').getAttribute("content");
    expect(og, "og:image assente").toBeTruthy();
    expect(tw, "twitter:image assente").toBeTruthy();

    expect(new URL(og as string).pathname).toBe(CARD_OG);
    expect(new URL(tw as string).pathname).toBe(CARD_OG);
  });

  /**
   * Le tre icone si seguono dall'href scritto nell'HTML invece di indovinarne
   * l'indirizzo: Next ci mette l'impronta del file nel query string, e se un
   * giorno il file convenzionale cambiasse nome il test seguirebbe il
   * cambiamento invece di diventare rosso per il motivo sbagliato.
   *
   * Il `sizes` non è decorativo: lo scrive Next leggendo il file, quindi è la
   * dichiarazione che il browser usa per scegliere. Un ICO con la sola 16
   * resterebbe verde su tutto il resto e sarebbe sgranato ovunque.
   */
  for (const icona of ICONE) {
    test(`${icona.nome}: servita byte per byte, e dichiarata a ${icona.misura}`, async ({
      page,
      request,
    }) => {
      await page.goto("/");

      const link = page.locator(icona.selettore).first();
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("sizes", icona.misura);

      const href = await link.getAttribute("href");
      expect(href, `nessun href su ${icona.nome}`).toBeTruthy();

      const res = await request.get(href as string);
      expect(res.status()).toBe(200);
      expect(improntaCorpo(await res.body())).toBe(improntaFile(icona.percorso));
    });
  }

  /**
   * L'impronta dice CHE FILE è, non CHE COSA c'è dentro. Se arrivasse un file
   * sbagliato e qualcuno riallineasse l'impronta senza guardare l'immagine,
   * tutte le guardie qui sopra resterebbero verdi.
   *
   * La firma delle immagini di marca è di essere **a due toni**: fondo
   * `--fa-ink` e glifi in bianco caldo, con pochissimo in mezzo. Misurato:
   *
   * | | ink | chiaro | altro | angolo |
   * |---|---|---|---|---|
   * | card OG | 94% | 4% | 2% | (10,18,21) |
   * | icon 512 | 80% | 18% | 1% | (11,18,21) |
   * | apple 180 | 79% | 18% | 2% | (11,18,21) |
   * | *fotografia di prodotto* | *41%* | *0%* | *58%* | *(5,18,35)* |
   *
   * Le quattro soglie qui sotto passano su tutte e tre le immagini di marca e
   * falliscono **su tutte e quattro le voci** con la fotografia.
   */
  const SOGLIE = { angoloBlu: 30, ink: 70, chiaro: 2, altro: 10 } as const;

  test("le tre immagini di marca sono a due toni, non fotografie", async ({ page }) => {
    await page.goto("/");

    const bersagli = [
      { nome: "card OG", src: CARD_OG, larghezza: 1200, altezza: 630 },
      ...(await Promise.all(
        ICONE.filter((i) => i.nome.endsWith(".png")).map(async (i) => ({
          nome: i.nome,
          src: (await page.locator(i.selettore).first().getAttribute("href")) as string,
          larghezza: Number(i.misura.split("x")[0]),
          altezza: Number(i.misura.split("x")[1]),
        })),
      )),
    ];

    for (const b of bersagli) {
      const m = await composizione(page, b.src);
      expect({ larghezza: m.larghezza, altezza: m.altezza }, b.nome).toEqual({
        larghezza: b.larghezza,
        altezza: b.altezza,
      });
      expect(m.angolo[2], `${b.nome}: angolo ${m.angolo.join(",")}, il blu del fondo`).toBeLessThan(
        SOGLIE.angoloBlu,
      );
      expect(m.ink, `${b.nome}: fondo near-black`).toBeGreaterThanOrEqual(SOGLIE.ink);
      expect(m.chiaro, `${b.nome}: monogramma e wordmark`).toBeGreaterThanOrEqual(SOGLIE.chiaro);
      expect(m.altro, `${b.nome}: niente mezzetinte diffuse`).toBeLessThanOrEqual(SOGLIE.altro);
    }
  });
});
