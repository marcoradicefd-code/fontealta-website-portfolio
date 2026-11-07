# Guida contenuti — manuale dell'operatore

> Per chi mette mano ai contenuti dallo Studio, non al codice. Nessuna riga di questa
> guida richiede di aprire un editor di testo o il terminale.
>
> **Lo Studio è su `/studio`** — in produzione `fontealta-website-sigma.vercel.app/studio`,
> in locale `localhost:3000/studio`.

**Documento gemello:** [`docs/procedura-nuova-collezione-passo-passo.md`](./procedura-nuova-collezione-passo-passo.md)
copre il caso «Andrea comunica una **collezione nuova** e la lista dei modelli»: dalla
checklist delle informazioni da farsi dare fino alla verifica in produzione.

**Come si dividono il lavoro:**

| se devi… | vai a |
|---|---|
| creare una **collezione** nuova e associarle dei modelli | la procedura passo passo |
| creare o modificare un **singolo documento** — corpo, articolo, immagini | questa guida |
| capire cosa succede **dopo il Publish** e perché non vedi le modifiche | questa guida, capitolo 6 |

**Un passo, una fonte.** Se una procedura è scritta di là, qui c'è solo il rimando, mai
una seconda copia che poi diverge. Vale anche al contrario: la procedura rimanda a questa
guida per il caso «Corpi a incasso», che non segue il suo flusso.

---

## 1 · Corpi a incasso — un corpo nuovo, campo per campo

Studio → **Concealed body** → «Create new».

> ⚠️ «Corpi a incasso» **non è una collezione come le altre** e non segue la procedura
> passo passo: è una vetrina senza modelli associati, e l'indice interroga direttamente
> i corpi. Un corpo nuovo compare da solo, senza che tu lo agganci a niente.

| campo | obbligatorio | cosa scrivere |
|---|---|---|
| **Code** | sì | Il codice di catalogo, esattamente come sul listino: `CW.1`, `ST.INC`, `W2MP.INC`. Maiuscole e punti compresi. |
| **Slug** | sì | Premi «Generate»: si scrive da solo dal codice (`W2MP.INC` → `w2mp-inc`). **Non modificarlo a mano** — è l'indirizzo della pagina, e cambiarlo dopo la pubblicazione rompe i link già in giro. |
| **Name** | sì | Oggi si scrive **uguale al codice**, in italiano e inglese. Non compare sul sito (il titolo della scheda è il codice): serve a far leggere la lista nello Studio. |
| **Description** | no | Una frase, non un paragrafo. Compare sotto il titolo della scheda. Esempio reale: «Corpo incassato per sistema MX-TC». |
| **Ambienti serviti** | sì, almeno 1 | Le macro-categorie che il corpo serve. Si spuntano dalla griglia. |
| **Water supply** | no | Le gocce del catalogo: acqua fredda, oppure fredda e calda. |
| **Image** | no | Se resta vuoto la scheda mostra il monogramma grigio, come le schede modello senza foto. Nessuna fretta. |
| **Order** | no | Posizione nell'indice. Se lo lasci vuoto il corpo si ordina alfabeticamente per codice, in fondo a quelli che hanno un ordine. |

### «Ambienti serviti» è una scelta tua, non un dato che si deduce

È il campo dove si sbaglia più facilmente, perché sembra derivabile dagli articoli e
non lo è. **CW.1 e CW.2 non sono richiesti da nessun articolo**, eppure servono lavabo,
doccia e vasca: lo sai tu, non lo sa il database.

Un corpo può servirne più di uno, e in quel caso **compare sotto ognuno** nel filtro
dell'indice. È voluto: per questo la somma dei tre filtri (7 + 12 + 5) fa 24 su 17 corpi.

### Cosa succede da solo, senza che tu faccia niente

- Il corpo **compare nell'indice** `/collezioni/corpi-a-incasso` appena pubblicato.
- Il **conteggio** nell'hero della sezione si aggiorna: nessun numero è scritto a mano.
- La sezione **«Usato da»** della sua scheda si popola dagli articoli che lo
  richiedono — vedi capitolo 3.

---

## 2 · Un articolo nuovo

Studio → **Model** → «Create new». I campi sono raggruppati in schede in alto:
Identity, Taxonomy, Media, Specs, Links.

**Identity**

| campo | obbligatorio | note |
|---|---|---|
| **Code** | sì | Codice di listino. |
| **Name** | sì | Nome commerciale, IT ed EN. È il titolo della scheda. |
| **Slug** | sì | «Generate» dal nome. Vale la stessa regola del corpo: non si tocca dopo la pubblicazione. |
| **Description** | no | Una frase. |

**Taxonomy**

| campo | obbligatorio | note |
|---|---|---|
| **Macro-categoria** | sì | Prima metà dell'etichetta che si legge sul sito. |
| **Sottotipo** | sì | Seconda metà. **Non tutte le combinazioni esistono**: «Batteria 3 fori» vale solo per Lavabo, «Pannello» solo per Doccia. Se sbagli l'accoppiata compare un errore che ti elenca i valori ammessi — leggilo, contiene già la risposta. |
| **Tags** | no | Suggeriti a tendina, ma puoi scriverne di nuovi. |
| **Includes concealed body 🔒** | no | Marcatore del catalogo stampato: l'articolo **include** il corpo. Diverso dal campo sotto. |
| **Required concealed body** | no | Il corpo che l'articolo **richiede, venduto a parte**. Vedi capitolo 3. |
| **Available finishes** | consigliato | Da 1 a 8. Vuoto solo per i materiali naturali tipo ORIGO RAME: lo Studio ti avvisa ma ti lascia salvare. |
| **Water supply** | no | Le gocce. |

**Links**

| campo | obbligatorio | note |
|---|---|---|
| **Collections** | sì, almeno 1 | A quale collezione appartiene. Un articolo può stare in più collezioni: è così che i 23 articoli condivisi compaiono in due sezioni senza essere duplicati. |

---

## 3 · Legare un corpo a un articolo

**Si fa da una parte sola: sull'ARTICOLO.** Campo **Required concealed body**, scheda
Taxonomy. Cerchi il corpo per codice e lo selezioni.

**Sul corpo non devi fare niente.** La sezione «Usato da» della sua scheda si costruisce
al contrario, chiedendo al database quali articoli lo richiedono. Se leghi dieci
articoli a `MX.INC`, la sua scheda ne elencherà dieci senza che tu la apra.

Due conseguenze pratiche:

- **Se un corpo non è richiesto da nessuno**, la sezione «Usato da» della sua scheda non
  compare — non compare vuota, proprio non c'è. È il caso di CW.1 e CW.2, ed è corretto.
- **Togliere il legame** da un articolo lo fa sparire dalla lista del corpo, sempre da
  solo.

E dalla scheda dell'articolo, la riga «Corpo incasso» col codice **è cliccabile** e porta
alla scheda del corpo.

---

## 4 · Immagini

Ogni campo immagine chiede, oltre al file:

- **Alt** — la descrizione per chi non vede l'immagine e per i motori di ricerca.
  Descrivi **cosa si vede**, non il nome del prodotto: «doccia da esterno in acciaio
  satinato su fondo blu» dice qualcosa, «Boss MX2.CD» no.
- **Hotspot / Crop** — trascina il cerchietto sul punto che deve restare visibile quando
  l'immagine viene ritagliata. Le card usano un ritaglio verticale 3:4: senza hotspot il
  taglio parte dal centro geometrico, che quasi mai è il punto giusto.

**Formato:** carica il file più grande che hai, non ridimensionarlo prima. Il sito genera
da solo le versioni piccole, in WebP e AVIF, e sceglie la giusta per ogni schermo. Se
carichi un'immagine già rimpicciolita, quella qualità è persa per sempre.

**Se lasci vuoto:** compare il monogramma grigio. Non è un errore ed è meglio di un
riquadro vuoto — puoi pubblicare senza foto e aggiungerle dopo.

---

## 5 · Cosa non fare

- **Non cambiare uno slug dopo la pubblicazione.** È l'indirizzo della pagina: i link
  condivisi, i preferiti e i motori di ricerca puntano a quello vecchio.
- **Non scrivere numeri a mano** («17 corpi», «21 collezioni») nei testi. Ovunque
  compaia un conteggio sul sito, è calcolato: un numero scritto a mano diventa falso al
  primo articolo aggiunto, e nessuno se ne accorge.
- **Non mettere prezzi.** Non ce ne sono da nessuna parte, è una scelta di tutto il
  catalogo.
- **Non creare il gemello inglese di una collezione.** Le collezioni sono documenti
  unici in italiano; l'inglese arriva dai campi tradotti dentro lo stesso documento.
- **Non toccare il campo «Language»** dove lo vedi: lo imposta il selettore di lingua in
  cima al documento.
- **Non pubblicare una collezione prima che la sua pagina esista.** Vale per le sezioni
  con una pagina fatta apposta, come i corpi a incasso: comparirebbe nella griglia con un
  link a una pagina vuota, e i motori di ricerca la archivierebbero come pagina povera —
  un giudizio che si porta dietro anche dopo. Per una collezione normale invece non è un
  problema: nasce vuota e si riempie associando i modelli, ed è esattamente quello che
  descrive la [procedura passo passo](./procedura-nuova-collezione-passo-passo.md) al
  passo 4.
- **Apostrofi:** usa quello curvo `’`, non quello dritto `'`. Su Mac è `⌥ + ù`.
  Il punto elenco che separa le voci è `·` (`⌥ + ⇧ + 9`), non un trattino.

---

## 6 · Dopo il Publish — cosa aspettarsi, e in quanto

Quando premi **Publish**, il sito viene avvisato in automatico e rigenera le pagine che
dipendono da quel documento. **Non serve chiedere a nessuno di fare niente.**

**Tempi realistici:** qualche secondo per la notifica, più circa tre secondi di attesa
tecnica che il sito si prende per essere sicuro di leggere il dato aggiornato e non
quello di un istante prima. In pratica: **ricarica dopo dieci secondi e c'è.**

**Cosa si aggiorna:** la pagina del documento che hai toccato e tutte quelle che lo
mostrano. Se pubblichi un articolo, si aggiornano la sua scheda, la pagina della sua
collezione e — se ha un corpo — la lista «Usato da» di quel corpo.

### Se dopo un minuto non vedi ancora niente

Nell'ordine, prima di allarmarti:

1. **Ricarica saltando la cache del browser**: `⌘ + ⇧ + R`. Nove volte su dieci è questo.
2. **Controlla di aver premuto Publish e non solo salvato.** Lo Studio salva da solo
   mentre scrivi, ma finché non pubblichi resta una bozza, e le bozze il sito non le vede.
3. **Guarda se il documento ha errori di validazione**: un campo obbligatorio vuoto
   impedisce la pubblicazione, e lo Studio lo segnala in rosso in cima.

Se hai fatto tutti e tre e ancora non si vede, **allora è una cosa da sviluppatore** —
segnalalo, non insistere col Publish.

### Il caso raro che vale la pena conoscere

C'è una situazione in cui il sito continua a mostrare il vecchio contenuto anche facendo
tutto giusto: quando **una pagina nuova viene messa in linea nella stessa finestra in cui
si pubblica il documento che le serve**. Il sito può aver memorizzato la risposta «quel
documento non esiste» da prima della pubblicazione, e continuare a servirla.

Il sintomo è particolare: la pagina risponde **«non trovata»**, esattamente come se il
documento fosse ancora una bozza. Nessun errore da nessuna parte.

Non è una cosa che puoi risolvere tu dallo Studio: si risolve rimettendo in linea il sito
**senza riusare la memoria del build precedente**. Se ti capita, la frase da riportare è:
«serve un redeploy senza build cache». È successo davvero, il 29 luglio 2026, con la
sezione dei corpi a incasso.

---

*Guida scritta il 29/07/2026. Se un campo dello Studio non corrisponde a quanto scritto
qui, ha ragione lo Studio: segnalalo e si aggiorna questa pagina.*
