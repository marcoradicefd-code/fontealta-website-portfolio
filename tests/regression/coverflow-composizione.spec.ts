import { expect, test } from "@playwright/test";

/**
 * Il coverflow della home deve avere la **prospettiva applicata** su Safari, e
 * il modo in cui ce l'ha è un livello di composizione sul contenitore.
 *
 * Marco vedeva il carosello nascere piatto su Safari desktop e raddrizzarsi
 * ridimensionando la finestra. Il sintomo non era «3D appiattito» ma
 * **prospettiva assente**: `rotateY(45deg)` senza `perspective` è esattamente
 * `scaleX(0,707)` ad altezza invariata, e la `translateZ(-240px)` non
 * rimpicciolisce nulla — i rapporti misurati sulla schermata di Safari,
 * **0,709 e 0,992**, sono quella firma.
 *
 * Il meccanismo, dal sorgente di WebKit: un livello con `perspective` diventa
 * composito solo se `has3DTransformedDescendant()` è vero, e quel flag lo
 * aggiorna `RenderLayer::dirty3DTransformedDescendantStatus()`, che dal
 * discendente sale **finché** l'antenato è `preserve-3d`. Arriva a `.swiper`,
 * che è `transform-style: flat`, e si ferma senza marcarlo. Da noi il primo
 * disegno è l'HTML del server, senza trasformazioni: le scrive Swiper dopo
 * l'idratazione, quindi il flag nasce falso e resta falso. Il resize lo
 * «ripara» perché i livelli si ricreano. Con un backing proprio la prospettiva
 * viene applicata comunque.
 *
 * ⛔ **QUESTA GUARDIA MISURA LA STRUTTURA, NON IL RESO, e la differenza è il
 * punto.** Il WebKit che Playwright installa **non dipinge la prospettiva
 * nemmeno nel caso di controllo** — quattro scene identiche in cui cambiava
 * solo quando arriva il 3D uscivano piatte tutte e quattro, compresa quella col
 * 3D già nell'HTML, mentre su Chromium erano tutte e quattro in prospettiva e
 * su **Safari vero** solo quella col 3D tardivo era piatta. Quindi nessun test
 * su questo motore può dire se il carosello si vede in 3D: può dire se la leva
 * che lo fa vedere è ancora al suo posto, e questo lo dice in modo netto.
 *
 * ⚠️ **Il rapporto fra le slide non è una guardia del 3D**, ed è misurato:
 * `getBoundingClientRect` restituisce la geometria **proiettata** anche quando
 * il compositor dipinge in ortogonale, quindi vale 0,753 e 0,920 su tutti e due
 * i motori sia col codice giusto sia con quello rotto. Resta come guardia della
 * **geometria** — se qualcuno cambia `rotate` o `depth`, questi numeri si
 * muovono — e il commento dice cosa non prova, così nessuno lo legge come una
 * prova del reso.
 *
 * ⚠️ **Una PR intera è stata spesa su una causa sbagliata** (il `div` di
 * `Reveal`, che teneva `will-change` e una `transform` a zero sopra il
 * sottoalbero 3D): era plausibile, ma era stato misurato che quelle proprietà
 * **sparivano**, non che **servisse** toglierle. Quella pulizia resta perché è
 * igiene giusta, e il suo test è il secondo qui sotto.
 */

const LATERALE_SU_CENTRALE_LARGHEZZA = 0.753;
const LATERALE_SU_CENTRALE_ALTEZZA = 0.92;

test.describe("il coverflow della home tiene la prospettiva", () => {
  test("il contenitore con la prospettiva ha un livello proprio", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.locator(".fa-coverflow .swiper-slide-active").waitFor();

    // La leva è `will-change: transform` sul contenitore che porta la
    // `perspective`, e va letta DOPO l'idratazione, perché è lì che il difetto
    // nasceva: l'HTML del server non ha trasformazioni.
    const contenitore = await page.evaluate(() => {
      const el = document.querySelector(".fa-coverflow .swiper");
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { perspective: cs.perspective, willChange: cs.willChange };
    });

    expect(contenitore, "il contenitore del coverflow esiste").not.toBeNull();
    expect(contenitore!.perspective, "la prospettiva è dichiarata").not.toBe("none");
    expect(
      contenitore!.willChange,
      "senza un livello proprio Safari non applica la prospettiva (v. il commento in testa)",
    ).toContain("transform");
  });

  test("a rivelazione finita nessun antenato porta transform o will-change", async ({ page }) => {
    // Igiene, non la cura del coverflow: `will-change` è un suggerimento per
    // l'animazione in corso, e lasciarlo acceso costa un livello su ogni
    // `Reveal` della pagina.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.locator(".fa-coverflow .swiper-slide-active").waitFor();

    await page.evaluate(() => {
      const el = document.querySelector(".fa-coverflow");
      if (el)
        window.scrollTo({
          top: window.scrollY + el.getBoundingClientRect().top - 60,
          behavior: "instant",
        });
    });

    // La CONDIZIONE, non un cronometro: la rivelazione è finita quando il padre
    // ha smesso di essere un livello.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const padre = document.querySelector(".fa-coverflow")?.parentElement;
            if (!padre) return null;
            const cs = getComputedStyle(padre);
            return { transform: cs.transform, willChange: cs.willChange };
          }),
        { timeout: 10_000 },
      )
      .toEqual({ transform: "none", willChange: "auto" });

    // E nessun ALTRO antenato, fino a <html>, ne porta di suoi.
    const sporchi = await page.evaluate(() => {
      const out: string[] = [];
      let el = document.querySelector(".fa-coverflow")?.parentElement ?? null;
      while (el && el !== document.documentElement) {
        const cs = getComputedStyle(el);
        if (cs.transform !== "none" || cs.willChange !== "auto") {
          out.push(
            `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/)[0] : ""}: transform=${cs.transform} will-change=${cs.willChange}`,
          );
        }
        el = el.parentElement;
      }
      return out;
    });
    expect(sporchi, "antenati che creano un livello sopra il contesto 3D").toEqual([]);
  });

  test("la geometria del coverflow non è cambiata", async ({ page }) => {
    // ⚠️ Geometria, NON reso: v. il commento in testa. Serve a prendere una
    // modifica involontaria a `rotate`/`depth`, non a dire che il 3D si vede.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.locator(".fa-coverflow .swiper-slide-active").waitFor();
    await page.evaluate(() => {
      // Swiper appende la sua istanza all'elemento, e il DOM non lo sa.
      const nodo = document.querySelector(".fa-coverflow .swiper") as
        (Element & { swiper?: { autoplay?: { stop?: () => void } } }) | null;
      nodo?.swiper?.autoplay?.stop?.();
    });

    const rapporti = await page.evaluate(() => {
      const box = (r: string) => {
        const n = document.querySelector(`.fa-coverflow .swiper-slide-${r}`);
        return n ? n.getBoundingClientRect() : null;
      };
      const prev = box("prev");
      const active = box("active");
      if (!prev || !active) return null;
      return {
        larghezza: +(prev.width / active.width).toFixed(3),
        altezza: +(prev.height / active.height).toFixed(3),
      };
    });

    expect(rapporti, "le tre slide centrali esistono").not.toBeNull();
    expect(rapporti!.larghezza).toBeCloseTo(LATERALE_SU_CENTRALE_LARGHEZZA, 2);
    expect(rapporti!.altezza).toBeCloseTo(LATERALE_SU_CENTRALE_ALTEZZA, 2);
    // ⛔ E soprattutto NON è il caso appiattito senza prospettiva, che darebbe
    // 0,707 in larghezza (il coseno di 45°) e 1,0 in altezza.
    expect(rapporti!.altezza, "altezza uguale = nessuna proiezione").toBeLessThan(0.99);
  });
});
