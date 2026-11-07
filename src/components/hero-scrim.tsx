const INK = "11, 18, 21";

/**
 * Scrim degli hero full-bleed. Due varianti, scelte da DOVE sta il testo:
 *
 *  - `centrato` — radiale sul centro + verticale su tutta l'altezza. È la
 *    taratura nata su /produzione: il radiale scurisce il bacino centrale dove
 *    stanno occhiello, H1 e sottotitolo, il verticale chiude in basso.
 *  - `sinistra` — un diagonale a 100° che pesa a sinistra e si alleggerisce a
 *    destra, per gli hero col testo allineato a sinistra e un soggetto da
 *    tenere leggibile sull'altro lato.
 *
 * Il componente rende SOLO gli strati, senza contenitore: va messo dentro un
 * `relative`/`absolute inset-0` insieme al media. Si SOMMA a quello che c'è
 * già — home e collezioni conservano sotto i loro tre strati storici, che
 * fanno un lavoro diverso (lo stacco in alto sotto la nav e il fondo scuro in
 * basso verso la sezione seguente).
 */
export type VarianteScrim = "centrato" | "sinistra";

/** Scala dei passi ammessi, in ordine dal più chiaro al più scuro. L'ordine non
 *  è cosmetico: ci si appoggia il vincolo `passiMobile >= passi`. */
type Scala = readonly [-4, -3, -2, -1, 0, 1, 2, 3];
export type Passo = Scala[number];

/** Coda della scala a partire da `P`. `[H] extends [P]` e non `H extends P`:
 *  senza le tuple il condizionale distribuirebbe sull'unione e tornerebbe
 *  sempre la scala intera. */
type Coda<T extends readonly unknown[], P> = T extends readonly [infer H, ...infer R]
  ? [H] extends [P]
    ? T
    : Coda<R, P>
  : never;

/** I passi consentiti sotto `sm` quando sopra `sm` si sta a `P`: solo uguali o
 *  più scuri. Un mobile più CHIARO del desktop è quasi sempre uno sbaglio — sul
 *  telefono il testo copre più foto, non meno — e qui è un errore di typecheck,
 *  non una convenzione che fra sei mesi nessuno ricorda. */
export type PassiMobileConsentiti<P extends Passo> = Coda<Scala, P>[number];

/** Fermi a passo 0. `centrato` è la taratura di /produzione e non si muove:
 *  quella pagina è misurata a 0,000 di scarto, ed è l'unico modo di sapere che
 *  un domani il componente non l'ha cambiata di nascosto. */
const FERMI: Record<VarianteScrim, number[]> = {
  centrato: [0.8, 0.55, 0, 0.6, 0.34, 0.46, 0.86],
  sinistra: [0.84, 0.58, 0.3, 0.24],
};

/** Un PASSO di taratura = +.06 su ogni fermo. Si sale di un passo per volta e
 *  si rimisura: la foto sotto cambia da pagina a pagina, quindi lo stesso scrim
 *  non dà lo stesso contrasto e non esiste un valore giusto a priori. */
const PASSO = 0.06;

/** Dove siamo arrivati, misurando sui provini (ago 2026):
 *  /produzione   passo 0   — la taratura di riferimento, invariata
 *  /finiture    −1 / −1
 *  /collezioni  −2 / −2
 *  home          non usa HeroScrim: dal set 2026 ha il suo scrim direzionale
 *                sulla fascia del testo, in `home-hero.tsx`.
 *  Il criterio: si parte dal MINIMO che regge la soglia, perché sotto c'è una
 *  foto e alzare lo scrim la spegne, e poi si sale di UN passo. Il minimo è il
 *  minimo su quattro fotogrammi campionati, non su tutti quelli che esistono:
 *  un passo di margine è il prezzo di quella differenza. */

// La scala va anche all'INDIETRO: se una foto è già scura, un passo negativo
// alleggerisce. Il `max(0)` non è un vezzo: un alpha negativo rende invalida
// l'intera dichiarazione `background` e lo strato sparisce in silenzio, senza
// che nessun controllo statico se ne accorga.
const fermo = (variante: VarianteScrim, i: number, passi: number) =>
  Math.min(1, Math.max(0, FERMI[variante][i] + PASSO * passi)).toFixed(2);

function strati(variante: VarianteScrim, passi: number): string[] {
  const v = (i: number) => `rgba(${INK},${fermo(variante, i, passi)})`;
  if (variante === "centrato") {
    return [
      `radial-gradient(52% 46% at 50% 48%, ${v(0)} 0%, ${v(1)} 55%, ${v(2)} 100%)`,
      `linear-gradient(180deg, ${v(3)} 0%, ${v(4)} 30%, ${v(5)} 70%, ${v(6)} 100%)`,
    ];
  }
  return [`linear-gradient(100deg, ${v(0)} 0%, ${v(1)} 42%, ${v(2)} 72%, ${v(3)} 100%)`];
}

interface HeroScrimProps<P extends Passo> {
  variante: VarianteScrim;
  /** Passi di taratura da `sm` in su. 0 = i fermi base. */
  passi?: P;
  /** Passi sotto `sm`. Omesso = come desktop. Non può essere più CHIARO di
   *  `passi`: il tipo lo impedisce. */
  passiMobile?: PassiMobileConsentiti<P>;
  /** Rende gli strati SOLO sotto `sm`. Serve alla home, dove sopra `sm` il
   *  diagonale a tutta larghezza lascia il posto a un'ellisse ancorata al blocco
   *  di testo: quella vive in `home-hero.tsx`, perché solo lì si conosce la
   *  geometria del blocco, e da qui non si potrebbe rendere. */
  finoASm?: boolean;
}

export function HeroScrim<P extends Passo = 0>({
  variante,
  passi,
  passiMobile,
  finoASm,
}: HeroScrimProps<P>) {
  const base = (passi ?? 0) as number;
  const separati = passiMobile !== undefined && passiMobile !== base;
  const desktop = strati(variante, base);
  const mobile = strati(variante, (passiMobile as number | undefined) ?? base);
  // Stringhe INTERE, non un ternario dentro un template: `prettier-plugin-tailwindcss`
  // riordina le classi anche dentro le interpolazioni e si mangia lo spazio
  // iniziale, saldando `inset-0hidden` — l'inset sparisce e il div collassa a
  // dimensione zero. Il difetto si vede solo in pagina, mai in typecheck o lint.
  const classeDesktop = finoASm
    ? "absolute inset-0 sm:hidden"
    : separati
      ? "absolute inset-0 hidden sm:block"
      : "absolute inset-0";

  return (
    <>
      {desktop.map((background, i) => (
        <div key={`d${i}`} aria-hidden="true" className={classeDesktop} style={{ background }} />
      ))}
      {separati &&
        !finoASm &&
        mobile.map((background, i) => (
          <div
            key={`m${i}`}
            aria-hidden="true"
            className="absolute inset-0 sm:hidden"
            style={{ background }}
          />
        ))}
    </>
  );
}
