"use client";

import type { Flip as FlipPlugin } from "gsap/Flip";

/**
 * MorphSVGPlugin e Flip, caricati al PRIMO INVIO valido e mai prima (14/10/2026).
 *
 * Sono i soli plugin GSAP del sito fuori dal chunk condiviso di `LenisProvider`: con un import
 * statico finirebbero nel bundle di ogni pagina col modulo, cioè quasi tutte, per un'animazione
 * che parte solo dopo un invio. Qui stanno in un chunk a parte (circa 19 KB compressi), richiesto
 * una volta sola: la promessa vive a livello di modulo e i submit successivi la riusano.
 *
 * Se l'import fallisce la promessa risolve `null` e il bottone passa allo stato finale senza
 * animazione: l'esito dell'invio non dipende mai da questo file.
 */
export interface Animazioni {
  Flip: typeof FlipPlugin;
}

let promessa: Promise<Animazioni | null> | null = null;
let pronte: Animazioni | null = null;

export function caricaAnimazioni(): Promise<Animazioni | null> {
  promessa ??= Promise.all([import("gsap"), import("gsap/MorphSVGPlugin"), import("gsap/Flip")])
    .then(([{ gsap }, { MorphSVGPlugin }, { Flip }]) => {
      gsap.registerPlugin(MorphSVGPlugin, Flip);
      pronte = { Flip };
      return pronte;
    })
    .catch(() => null);
  return promessa;
}

/** I plugin, se sono già arrivati; altrimenti `null`, e si va diritti allo stato finale. */
export function animazioniPronte(): Animazioni | null {
  return pronte;
}
