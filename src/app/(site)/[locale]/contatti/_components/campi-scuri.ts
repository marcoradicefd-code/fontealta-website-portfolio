/**
 * I campi del modulo su fondo SCURO (`.fa-contact-input`): stile condiviso dal modulo dei contatti
 * (`contact-form.tsx`, che ci aggiunge menu e note) e da quello della newsletter nel piè di pagina
 * (20/10/2026). Stava nel `<style>` di `contact-form.tsx`, spostato senza cambiare una regola.
 *
 * ATTENZIONE: niente backtick nel CSS qui sotto, nemmeno nei commenti: chiuderebbe il template.
 */
export const CAMPI_SCURI_CSS = `
  .fa-contact-input {
    width: 100%;
    background: transparent;
    border: 0;
    border-bottom: var(--fa-field-border) solid var(--fa-border-dark-medium);
    padding: var(--fa-field-pad-y) 0;
    font-size: var(--fa-field-font-1);
    line-height: var(--fa-field-leading-2);
    color: var(--fa-text-on-dark);
    transition: border-color var(--dur-micro, 200ms) var(--ease-out-expo, ease);
    border-radius: 0;
  }
  .fa-contact-input::placeholder { color: var(--fa-text-on-dark-tertiary); }
  .fa-contact-input:focus {
    outline: none;
    border-bottom-color: var(--fa-navy-bright);
  }
  /* ATTENZIONE: il bordo che cambia colore NON e' un indicatore di fuoco su
     questo fondo. Misurato sul servito: a riposo il bordo compone
     rgb(70,74,76) sull'inchiostro, a fuoco vale rgb(61,95,153), e fra i due
     stati corrono 1,41:1 - contro il 3:1 che WCAG 2.2 SC 2.4.11 chiede fra
     stato a fuoco e stato a riposo. Il navy-bright sull'inchiostro vale
     2,96:1 contro lo sfondo: praticamente invisibile. Sul modulo della home,
     che sta su fondo chiaro, lo stesso trattamento misura 7,16:1 e non ha
     questo problema: per questo li' non si tocca niente.

     L'anello e' il bianco della traccia, il focus del design system su fondo
     scuro, lo stesso delle card di produzione: nasce dalla constatazione che
     il navy-bright sull'inchiostro non si vede. Fino al 20/10/2026 era oro, e
     l'oro non fa parte del design system (Marco, 19/10).

     ATTENZIONE: focus-visible e non focus, e DOPO la regola qui sopra.
     Hanno la stessa specificita', quindi vince l'ultima, e outline:none va
     lasciato al focus perche' e' lui a spegnere l'anello che il browser
     disegna anche al clic del mouse. Chi arriva col dito o col puntatore non
     vede niente di nuovo; chi arriva da tastiera vede dove si trova.

     ATTENZIONE: in questo blocco NIENTE BACKTICK. Il CSS vive dentro un
     template literal di JSX, e un backtick in un commento lo chiude: il file
     smette di compilare con un errore che parla di parentesi graffe e non
     dice da dove viene. E' la stessa trappola gia' annotata per queries.ts. */
  .fa-contact-input:focus-visible {
    outline: 2px solid var(--fa-stroke-color);
    outline-offset: 3px;
    border-radius: 2px;
  }
  /* In errore il filo passa a 1,5 px col rosso su scuro (28/10/2026); il mezzo pixel si toglie dal
     padding, cosi' il campo non cresce. */
  .fa-contact-input[aria-invalid="true"] {
    border-bottom: 1.5px solid var(--fa-error-on-dark);
    padding-bottom: calc(var(--fa-field-pad-y) - 0.5px);
  }
  /* Dopo l'invio (14/10): bloccati ma con l'aspetto di sempre, si legge cosa si e' mandato. */
  .fa-contact-input[readonly] { cursor: default; }
`;
