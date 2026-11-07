/**
 * Un'intestazione di sezione che c'è **per la struttura e non per l'occhio**.
 *
 * Le pagine di collezione e dei corpi avevano un H1 e **zero H2**, misurato sul
 * build: un documento con un titolo e poi solo `h3` non ha gerarchia, e chi lo
 * legge a macchina — un motore, un assistente, uno screen reader — non sa dove
 * comincia il contenuto vero.
 *
 * ⚠️ **`sr-only` e non un titolo visibile**, perché qui un titolo visibile non
 * c'è mai stato: aggiungerne uno cambierebbe la pagina, e il vincolo era che a
 * contenuti invariati i campioni restassero identici al pixel. Non è un trucco
 * per i motori: uno screen reader lo annuncia, ed è proprio a chi naviga per
 * intestazioni che serve di più.
 *
 * ⚠️ **Il testo arriva già tradotto, non una chiave.** Il componente non chiama
 * `useTranslations`: le due sezioni che lo usano hanno namespace diversi
 * (`dettaglio.statArticoli` per i modelli, `dettaglio.statCorpi` per i corpi) e
 * traduttori già in mano. Passare la chiave costringerebbe a scegliere qui un
 * namespace, cioè a spostare una decisione nel posto che ne sa meno.
 *
 * ⚠️ **Le stringhe esistono già**: sono le stesse delle statistiche nell'hero.
 * Nessuna voce nuova da tradurre, e la parola è quella che il sito usa già per
 * questo contenuto.
 *
 * Nato estraendo il blocco che `models-section` e `bodies-section` ripetevano
 * riga per riga. ⚠️ **Delle diciassette righe, quattordici erano il commento qui
 * sopra**: il valore duplicato era la spiegazione, non il markup — che è una riga
 * — e il posto giusto di una spiegazione ripetuta due volte è un posto solo.
 */
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="sr-only">{children}</h2>;
}
