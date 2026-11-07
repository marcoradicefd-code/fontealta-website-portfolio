/**
 * Freccia e spunta del bottone di invio (14/10/2026), da `lucide-react` 1.33.0 (`ArrowRight`,
 * `Check`), portate dal viewBox 24 al 16 (×⅔). Modulo senza dipendenze: lo usano il bottone e gli
 * e2e.
 */

/** Freccia a due tratti (asta + punta), come `ArrowRight`. */
export const FRECCIA_DUE_TRATTI = "M3.333 8h9.334M8 3.333 12.667 8 8 12.667";

/** La stessa freccia a tratto unico: punta, braccio basso, ritorno sul braccio, asta. */
export const FRECCIA_TRATTO_UNICO = "M8 3.333 12.667 8 8 12.667 12.667 8H3.333";

export const SPUNTA = "M13.333 4 6 11.333 2.667 8";

/** La freccia in uso. L'altra resta pronta: la sceglie Marco a vista (provino dello STOP 2). */
export const FRECCIA = FRECCIA_DUE_TRATTI;
