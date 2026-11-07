/**
 * Sfumatura in fondo agli hero full-bleed: dall'immagine all'inchiostro della sezione
 * che segue, sul 45% inferiore. È quella nata su /finiture (giugno 2026), estratta qui
 * perché Marco la vuole IDENTICA anche su home, collezione, chi siamo, contatti e produzione
 * (set 2026): una quota, un gradiente, un token, scritti una volta sola.
 *
 * Misurata prima di estrarla: su /finiture era un `div` con `height: 45%` e
 * `linear-gradient(180deg, rgba(11,18,21,0) 0%, #0b1215 100%)`, cioè 285 px su 633 a 390 e
 * 405 su 900 a 1440. `transparent` al posto di `rgba(11,18,21,0)` dipinge gli stessi pixel,
 * perché i browser interpolano i gradienti in alfa premoltiplicata.
 *
 * ⚠️ NON è l'overlay di /blog, che è un'altra cosa: un velo su tutta l'altezza (.72 in
 * cima, .55 a metà, pieno in fondo) che fa anche da scrim di lettura. Quello resta suo.
 *
 * Si SOMMA agli scrim di lettura di ogni hero, non li sostituisce: scurisce soltanto,
 * quindi il contrasto del testo bianco può solo salire. Va messo DOPO gli strati di sfondo
 * e PRIMA del contenuto; dove l'hero numera gli strati con `z-index`, lo si passa.
 */
const SFUMATURA = "linear-gradient(180deg, transparent 0%, var(--fa-ink) 100%)";
const ALTEZZA = "45%";

export function HeroFade({ zIndex }: { zIndex?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0"
      style={{ height: ALTEZZA, background: SFUMATURA, zIndex }}
    />
  );
}
