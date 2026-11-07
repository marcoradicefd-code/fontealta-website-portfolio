/**
 * Underline che nasce dal CENTRO e cresce verso l'esterno.
 *
 * Nato in `model-specs.tsx` come primo hover-underline animato del progetto — prima
 * c'erano solo `hover:underline` statici in error/not-found e `text-decoration` sui
 * link editoriali — con la nota «questo diventa il riferimento se ne serviranno
 * altri». Ne è servito un altro (il breadcrumb del catalogo), quindi la costante è
 * uscita dal componente: due copie divergono al primo ritocco, e una divergenza fra
 * due underline si vede solo passandoci sopra col mouse.
 *
 * Come è fatto: pseudo-elemento a larghezza piena, `origin-center` + `scale-x-0` a
 * riposo → `scale-x-100` all'hover. Scalare invece di animare la width tiene tutto
 * sul compositor, e la crescita è simmetrica per costruzione.
 *
 * Valori dalla scala esistente, nessun numero nuovo: `--dur-micro` (200ms) è la
 * durata degli hover di nav e footer, cioè la famiglia giusta per un elemento
 * piccolo — i 400ms + expo delle card sono per le superfici grandi. `-bottom-1`
 * (4px) è lo stesso offset di `underline-offset-4` già usato in error/not-found.
 * Colore `currentColor`: la linea eredita il colore del testo, niente token nuovi.
 *
 * ⚠️ `motion-safe:` su transizione E timing: una transizione CSS ignora
 * `prefers-reduced-motion` di suo. Senza il prefisso questo sarebbe movimento non
 * guardato. In reduced-motion la linea compare comunque all'hover, ma di scatto:
 * l'affordance resta, il movimento no.
 *
 * `focus-visible` accanto a `hover` perché da tastiera l'hover non esiste; l'anello
 * di focus del browser NON viene soppresso, la linea è in aggiunta.
 *
 * L'array sta in una costante sua e il `join` a parte (22/09/2026): la guardia
 * di lint sulle classi (eslint.config.mjs) legge le stringhe di un array, ma
 * non quelle di un array che è l'oggetto di `.join()`. La stringa finale è la
 * stessa di prima.
 */
const CENTER_UNDERLINE_CLASSES = [
  "relative inline-block",
  "after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-current after:content-['']",
  "after:origin-center after:scale-x-0",
  "hover:after:scale-x-100 focus-visible:after:scale-x-100",
  "motion-safe:after:transition-transform motion-safe:after:duration-(--dur-micro)",
  "motion-safe:after:ease-out-expo",
];

export const CENTER_UNDERLINE = CENTER_UNDERLINE_CLASSES.join(" ");
