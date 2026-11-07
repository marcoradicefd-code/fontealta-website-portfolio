import { expect, test, type Page } from "@playwright/test";

import { decodificaPng } from "./helpers/png";

/**
 * Il testo degli hero con la barra trasparente sta SOPRA lo scrim della barra (22/10/2026).
 *
 * Dal 17/09/2026 (#207) lo scrim della barra è uno strato fisso a `z-index` 35, alto 320 px
 * sotto `xl`: sulla home, su /collezioni, /chi-siamo e /produzione dipingeva sopra occhiello
 * e titolo, e a 390 i glifi dell'H1 della home avevano luminanza 0,777 invece dello 0,957 del
 * bianco dichiarato. Il contenuto dell'hero ora è a 36: sopra lo scrim, sotto il pannello del
 * menu (40) e la barra (50).
 *
 * Due prove: la STRUTTURA (il blocco del testo ha uno `z-index` maggiore dello scrim, e fra
 * lui e la radice non c'è un contesto di sovrapposizione che lo rinchiuda) e il CONTRASTO dei
 * glifi dell'H1, p95 dei glifi contro p99 del fondo nei rettangoli di `Range.getClientRects`,
 * a DPR 2, col solo poster (movimento ridotto). Le soglie sono le misure del 22/10/2026
 * arrotondate per difetto al decimo.
 *
 * /collezioni ribasata il 23/10/2026 (5,0 → 4,7 a 390, 7,6 → 7,2 a 1440), dopo un cambio
 * approvato: la decisione 2 della spec token-fase-2 porta l'H1 dal bianco caldo #fcfaf5 al
 * crema #f6f4f0, luminanza −5%, e la misura cala dello stesso 5% (4,75 e 7,27). Controprova
 * col difetto del 22/10 reintrodotto in locale (testo di nuovo sotto lo scrim): la guardia torna
 * rossa a 390 e a 1440, ma per la STRUTTURA. Il contrasto dell'H1 intero resta 4,75 e 7,27: a
 * 390 lo scrim spegne le prime righe, ma il p95 prende l'ultima, che ne resta fuori (la prima
 * riga da sola scende da 6,07 a 4,37); a 1440 lo scrim non arriva all'H1. Sono soglie di
 * regressione, non di accessibilità: quella WCAG per il testo grande è 3:1, e non si tocca.
 *
 * /chi-siamo a 1440 ribasata il 23/10/2026 (10,4 → 10,1), con le altre «b» dei token:
 * l'interlinea di `--text-body-lg` da 1,65 a 1,6 accorcia di 2,7 px il paragrafo sotto il
 * titolo, il blocco centrato fa scendere l'H1 di 1,3 px sulla foto, e il p99 del fondo passa da
 * 10,42 a 10,17. Il colore del titolo e lo scrim non cambiano. Controprova col difetto del 22/10
 * reintrodotto in locale su /chi-siamo: rossa a 390 e a 1440. A 390 anche per il contrasto della
 * prima riga (8,10 contro 9,1); a 1440 per la struttura, perché sopra `xl` lo scrim non arriva
 * all'H1 e il contrasto resta 10,17.
 *
 * Terza prova, il contrasto RIGA PER RIGA (token, Fase 2, PR delle altre «b», 23/10/2026): i
 * rettangoli di `Range.getClientRects` raggruppati per riga, e per ogni riga p95 dei glifi contro
 * p99 del suo fondo. È la misura che vede il difetto anche quando una riga resta fuori dallo
 * scrim. Le righe vuote (gli `<br>`) non contano; un numero di righe diverso ferma il test,
 * perché i minimi sono di quelle righe. Minimi: le misure del ramo troncate al decimo; i valori
 * misurati stanno nelle annotazioni del test. Controprova su /collezioni col difetto: a 390 le
 * righe 1-3 scendono a 4,36, 6,63 e 4,33 contro 6,0, 7,9 e 4,5; a 1440 la guardia è rossa per la
 * struttura, come sopra.
 *
 * /collezioni a 1440 riga 1 ribasata il 30/10/2026 (7,2 → 7,1), con le spaziature del sito
 * approvate da Marco: l'H1 → paragrafo dell'hero passa a `--spacing-title-text-hero`, da 28 a 32
 * px; il blocco del testo è centrato in verticale, cresce di 4 px e porta l'H1 2 px più in alto
 * sulla foto, e il p99 del fondo della prima riga sale: misura 7,18, la stessa in due giri.
 * Le altre righe e l'H1 intero restano sopra i minimi (home a 1440 6,77 · 5,32, intero 5,44; a
 * 390 7,90 · 7,04, intero 7,14; /collezioni a 390 6,03 · 7,94 · 4,53 · 9,86, intero 4,73; a 1440
 * riga 2 7,31, intero 7,25). Controprova col difetto del 22/10 reintrodotto in locale (tolto
 * `z-36` dal testo di home e /collezioni, mai committato): rossa su 4 casi su 4. A 390 anche per
 * le righe (home 5,95 · 6,20 contro 7,8 · 7,0; /collezioni 4,33 · 6,60 · 4,32 contro 6,0 · 7,9 ·
 * 4,5), a 1440 per la struttura, perché sopra `xl` lo scrim non arriva all'H1.
 *
 * /chi-siamo ribasata il 5/11/2026 (#365), dopo un cambio approvato da Marco: l'H1 passa da «Una
 * materia sola.» a «L’acciaio marino.» (e le sue traduzioni), e i glifi cadono su un'altra parte
 * del poster. Colore del titolo, scrim e geometria non cambiano. Misure del ramo, uguali in due
 * giri: a 390 intero 10,09, righe 11,81 · 9,52; a 1440 intero e riga 8,89. Minimi nuovi: a 390
 * righe 11,8 · 9,5 (erano 9,1 · 12,8: la prima SALE, così il contrasto vede ancora il difetto);
 * a 1440 intero e riga 8,8 (erano 10,1); a 390 l'intero resta 9,1. Controprova col difetto del
 * 22/10 reintrodotto in locale (tolto `z-36` dal testo dell'hero, mai committato): rossa a 390 per
 * la struttura e per la riga 1 (10,88 contro 11,8), a 1440 per la struttura, perché sopra `xl` lo
 * scrim non arriva all'H1.
 */

const PAVIMENTO: Record<string, Record<number, number>> = {
  "/": { 390: 5.8, 1440: 4.7 },
  "/collezioni": { 390: 4.7, 1440: 7.2 },
  "/chi-siamo": { 390: 9.1, 1440: 8.8 },
  "/produzione": { 390: 9.6, 1440: 9.7 },
};

const luminanza = (r: number, g: number, b: number) => {
  const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const percentile = (valori: number[], p: number) =>
  [...valori].sort((a, b) => a - b)[Math.floor((p / 100) * (valori.length - 1))];

const PAVIMENTO_RIGHE: Record<string, Record<number, number[]>> = {
  "/": { 390: [7.8, 7.0], 1440: [6.7, 5.3] },
  "/collezioni": { 390: [6.0, 7.9, 4.5, 9.8], 1440: [7.1, 7.3] },
  "/chi-siamo": { 390: [11.8, 9.5], 1440: [8.8] },
  "/produzione": { 390: [9.9, 9.4], 1440: [9.3, 10.0] },
};

// Il contrasto di un insieme di rettangoli: p95 dei glifi contro p99 del fondo, a DPR 2.
function contrastoNei(
  rettangoli: number[][],
  acceso: ReturnType<typeof decodificaPng>,
  spento: ReturnType<typeof decodificaPng>,
) {
  const glifi: number[] = [];
  const fondo: number[] = [];
  for (const [x0, y0, w, h] of rettangoli)
    for (let y = Math.round(y0 * 2); y < Math.round((y0 + h) * 2); y++)
      for (let x = Math.round(x0 * 2); x < Math.round((x0 + w) * 2); x++) {
        const i = (y * acceso.larghezza + x) * 3;
        const a = luminanza(acceso.rgb[i], acceso.rgb[i + 1], acceso.rgb[i + 2]);
        const s = luminanza(spento.rgb[i], spento.rgb[i + 1], spento.rgb[i + 2]);
        fondo.push(s);
        if (a - s > 0.02) glifi.push(a);
      }
  if (glifi.length < 20) return null;
  return (percentile(glifi, 95) + 0.05) / (percentile(fondo, 99) + 0.05);
}

async function contrastoH1(page: Page) {
  const rettangoli = await page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("h1")!);
    return [...range.getClientRects()]
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => [r.x, r.y, r.width, r.height]);
  });
  const acceso = decodificaPng(await page.screenshot());
  await page.evaluate(() => (document.querySelector("h1")!.style.color = "transparent"));
  const spento = decodificaPng(await page.screenshot());
  await page.evaluate(() => (document.querySelector("h1")!.style.color = ""));
  // Una riga = i rettangoli con lo stesso bordo superiore (più nodi di testo sulla stessa riga).
  const perRiga = new Map<number, number[][]>();
  for (const r of rettangoli)
    perRiga.set(Math.round(r[1]), [...(perRiga.get(Math.round(r[1])) ?? []), r]);
  const righe = [...perRiga.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, r]) => contrastoNei(r, acceso, spento))
    .filter((c): c is number => c !== null);
  return { intero: contrastoNei(rettangoli, acceso, spento)!, righe };
}

test.use({ deviceScaleFactor: 2 });

for (const percorso of Object.keys(PAVIMENTO))
  for (const larghezza of [390, 1440]) {
    test(`${percorso} a ${larghezza}: il testo dell'hero sta sopra lo scrim della barra`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: larghezza, height: 900 });
      await page.goto(percorso);
      await page.addStyleTag({ content: "*{transition:none!important}" });
      await page.waitForFunction(() =>
        [...document.images]
          // Solo quelle visualizzate: un’immagine nascosta (la facciata di /produzione sotto 1024 px, 27/10/2026)
          // ha il rettangolo a zero, quindi «in cima», e non si carica mai.
          .filter(
            (i) => i.getClientRects().length > 0 && i.getBoundingClientRect().top < innerHeight,
          )
          .every((i) => i.complete && i.naturalWidth > 0),
      );

      const strati = await page.evaluate(() => {
        const scrim = document.querySelector(".fa-nav-scrim");
        let blocco: Element | null = document.querySelector("h1");
        while (blocco && getComputedStyle(blocco).zIndex === "auto") blocco = blocco.parentElement;
        // Fra il blocco e la radice nessun contesto di sovrapposizione: altrimenti il suo
        // z-index varrebbe solo lì dentro.
        const rinchiusi: string[] = [];
        for (
          let e = blocco?.parentElement;
          e && e !== document.documentElement;
          e = e.parentElement
        ) {
          const cs = getComputedStyle(e);
          if (
            (cs.zIndex !== "auto" && cs.position !== "static") ||
            cs.opacity !== "1" ||
            cs.transform !== "none" ||
            cs.filter !== "none" ||
            cs.isolation === "isolate" ||
            cs.willChange.includes("transform")
          )
            rinchiusi.push(e.tagName);
        }
        return {
          scrim: scrim ? Number(getComputedStyle(scrim).zIndex) : null,
          blocco: blocco ? Number(getComputedStyle(blocco).zIndex) : null,
          rinchiusi,
        };
      });
      expect.soft(strati.scrim).toBe(35);
      expect.soft(strati.blocco).toBeGreaterThan(strati.scrim!);
      expect.soft(strati.blocco).toBeLessThan(40); // il pannello del menu resta sopra
      expect.soft(strati.rinchiusi).toEqual([]);

      const { intero, righe } = await contrastoH1(page);
      test.info().annotations.push({
        type: "contrasto",
        description: `intero ${intero.toFixed(2)} · righe ${righe.map((c) => c.toFixed(2)).join(" ")}`,
      });
      expect.soft(intero).toBeGreaterThanOrEqual(PAVIMENTO[percorso][larghezza]);
      const minimi = PAVIMENTO_RIGHE[percorso][larghezza];
      expect(righe.length, "righe dell'H1").toBe(minimi.length);
      minimi.forEach((minimo, i) =>
        expect.soft(righe[i], `riga ${i + 1} dell'H1`).toBeGreaterThanOrEqual(minimo),
      );
    });
  }
