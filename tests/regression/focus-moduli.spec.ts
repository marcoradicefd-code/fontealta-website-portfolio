import { expect, test, type Page } from "@playwright/test";

/**
 * Chi compila un modulo da tastiera deve vedere dove si trova (settembre 2026).
 *
 * Sul modulo di `/contatti`, su fondo inchiostro, l'`outline` era spento e
 * l'unico indicatore era il bordo inferiore che cambiava colore: misurato sul
 * servito, da rgb(70,74,76) a rgb(61,95,153), cioè **1,41:1 fra i due stati**,
 * contro il 3:1 che WCAG 2.2 SC 2.4.11 chiede. Il colore a fuoco valeva 2,96:1
 * contro lo sfondo: un indicatore che di fatto non si vedeva.
 *
 * ⚠️ **Il modulo della home NON aveva questo difetto e non è stato toccato.**
 * Stesso trattamento, ma su fondo chiaro misura 7,16:1 fra gli stati. È la stessa
 * regola con due fondi diversi, e questo test misura tutti e due proprio per
 * impedire che un domani si «uniformino» al ribasso.
 *
 * ⚠️ **Si misura il contrasto fra STATO A FUOCO e STATO A RIPOSO, non fra testo
 * e sfondo.** È quello che chiede il criterio, ed è l'unico numero che dice se un
 * cambiamento si nota. Un test che confrontasse l'anello con l'inchiostro
 * risponderebbe a una domanda diversa.
 */

const srgb = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminanza = ([r, g, b]: number[]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrasto = (a: number[], b: number[]) => {
  const [hi, lo] = [luminanza(a), luminanza(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** `rgb()`/`rgba()` composto sul fondo dato: un bordo semitrasparente non è il suo colore. */
function componi(css: string, fondo: number[]): number[] {
  const n = css.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  const [r, g, b, a = 1] = n;
  return [r, g, b].map((c, i) => Math.round(c * a + fondo[i] * (1 - a)));
}

interface Stato {
  bordo: string;
  outline: string;
  outlineColore: string;
  fondo: string;
}

async function stati(page: Page, selettore: string): Promise<{ riposo: Stato; fuoco: Stato }> {
  const campo = page.locator(selettore).first();
  await campo.scrollIntoViewIfNeeded();
  const leggi = () =>
    campo.evaluate((e) => {
      const cs = getComputedStyle(e);
      let p: HTMLElement | null = e as HTMLElement;
      let fondo = "rgba(0, 0, 0, 0)";
      while (p) {
        const c = getComputedStyle(p).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) {
          fondo = c;
          break;
        }
        p = p.parentElement;
      }
      return {
        bordo: cs.borderBottomColor,
        outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
        outlineColore: cs.outlineColor,
        fondo,
      };
    });
  const riposo = await leggi();
  // Il fuoco arriva da TASTIERA: `:focus-visible` non scatta col click del mouse,
  // ed è esattamente la distinzione che questa regola sfrutta.
  await page.keyboard.press("Tab");
  await campo.focus();
  await page.waitForTimeout(200);
  const fuoco = await leggi();
  return { riposo, fuoco };
}

/**
 * Il primo campo, e i due nati il 13/10/2026: il menu del Paese e le note. Devono avere lo
 * stesso fuoco degli altri, perché usano la stessa classe.
 */
const CAMPI = ["", "select[name='paese']", "textarea[name='note']"];

test.describe("il fuoco sui campi dei moduli si vede", () => {
  for (const campo of CAMPI) {
    test(`/contatti${campo ? ` · ${campo}` : ""}: l'anello a fuoco stacca dallo stato a riposo di almeno 3:1`, async ({
      page,
    }) => {
      await page.goto("/contatti", { waitUntil: "load" });
      const { riposo, fuoco } = await stati(page, `${campo}.fa-contact-input`);

      const fondo = componi(riposo.fondo, [255, 255, 255]);
      expect(fuoco.outline, "a fuoco l'outline deve esserci").not.toContain("none");

      const anello = componi(fuoco.outlineColore, fondo);
      const bordoARiposo = componi(riposo.bordo, fondo);

      const controLoSfondo = contrasto(anello, fondo);
      const controIlRiposo = contrasto(anello, bordoARiposo);
      expect(
        controLoSfondo,
        `anello vs sfondo: ${controLoSfondo.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        controIlRiposo,
        `anello vs bordo a riposo: ${controIlRiposo.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(3);
    });
  }

  /**
   * La home resta com'è, e il test lo dice invece di lasciarlo implicito: su
   * fondo chiaro il bordo che cambia colore È un indicatore, e misurarlo qui
   * impedisce che si «uniformi» al trattamento scuro senza averlo verificato.
   */
  for (const campo of CAMPI) {
    test(`home${campo ? ` · ${campo}` : ""}: il bordo che cambia colore basta, perché il fondo è chiaro`, async ({
      page,
    }) => {
      await page.goto("/", { waitUntil: "load" });
      const { riposo, fuoco } = await stati(page, `${campo}.fa-home-input`);
      const fondo = componi(riposo.fondo, [255, 255, 255]);
      const cambio = contrasto(componi(fuoco.bordo, fondo), componi(riposo.bordo, fondo));
      expect(cambio, `cambio di stato sulla home: ${cambio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        3,
      );
    });
  }
});
