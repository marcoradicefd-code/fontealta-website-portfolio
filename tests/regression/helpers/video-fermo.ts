import type { Page } from "@playwright/test";

/**
 * Ferma il video degli hero sul suo POSTER, per misurare una barra o un menu sopra un fondo
 * che non cambia (22/10/2026).
 *
 * Bastava `pause()` finché il video partiva da 0. Dal #292 quello della home parte da 8,5 s
 * (`#t=8.5`): il salto iniziale toglie il poster, e fermato a metà salto WebKit dipingeva il
 * fondo vuoto e il fotogramma solo più tardi, fra il riposo e le misure (riposo 24,9 e 25,5,
 * poi 117,7 e 74,7). Aspettare che il video abbia un fotogramma non regge: nella suite intera
 * WebKit non ci arrivava in 2 minuti. Senza sorgenti e con `load()` l'elemento torna a
 * mostrare il poster, che sulla home è proprio il fotogramma da cui il video parte.
 */
export async function fermaVideoSulPoster(page: Page) {
  await page.evaluate(() =>
    document.querySelectorAll("video").forEach((v) => {
      v.pause();
      v.autoplay = false;
      v.querySelectorAll("source").forEach((s) => s.remove());
      v.removeAttribute("src");
      v.load();
    }),
  );
  // Il poster è già in cache: un attimo di tempo vero perché si dipinga.
  await page.waitForTimeout(300);
}
