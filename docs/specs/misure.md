# Misure dei prodotti — spec del cantiere

> Aperta il 2 novembre 2026 (Marco). **Resta aperta finché Alma non ci invia le schede tecniche**: fino ad allora è
> al presente, e si corregge qui con data quando una sua affermazione smette di essere vera. Nasce dal § B di
> `docs/specs/contenuti-per-lingua.md` (schema, chiavi, misura principale, formati), che resta la fonte di quelle
> regole; qui c'è cosa vale oggi, cosa si aggiorna all'arrivo delle schede e come. Gli elenchi datati stanno in
> `docs/specs/misure-elenchi.md`.

## Stato oggi (2/11/2026)

- **Schema**: `specs` (`specsMisure`) su `model` e `concealedBody`, con la PR #344: famiglia, misure in mm con chiave da
  un elenco chiuso, attacchi, `fonte` (documento e pagina stampata, interna), `stato` (`daVerificare` · `verificata`) e
  `verificataCon`.
- **Dati**: estratti a vista dai disegni del listino Edition V / R4 (06-002) e del listino ILLE REV_07-001, in
  `tmp/misure/` (sola lettura, fuori da git): 612 articoli, 585 con misure (552 con almeno una misura dal nome certo,
  33 con sole quote senza nome), 27 senza. ⚠️ **Su Sanity non sono ancora scritti**: 0 documenti su 612 hanno `specs`
  (contato il 2/11 sera). Si caricano con la sezione `misure` di `contenuti:carica` (PR #344), che scrive `specs`
  intero su 552 articoli, con la fonte e lo stato «da verificare»; i 60 senza misure con nome (33 con sole quote
  senza nome, 27 senza quote) restano senza `specs`. Le quote senza un nome certo non si caricano; una chiave che
  compare due volte nello stesso articolo non si scrive (9 articoli del listino ILLE: «Ø 60 / 34», «Ø placca
  60 / 65»); P22 e P9 (tipo «altro») non hanno famiglia, quindi nessuna misura principale. I nomi restano quelli
  dell'estrazione, non uniformati fra i sei file (es. W010 ha «Ø placca 65», altri gruppi a parete «quota (65)»):
  li uniforma la scheda tecnica, punto a.
- **Sul sito**: solo la misura principale, dentro l'alt composto della foto («‹descrizione› ‹codice›, ‹misura
  principale›, ‹collezione›», `src/lib/alt-composto.ts`, `src/lib/misure.ts`); finché `specs` è vuoto, l'alt esce
  senza misura. **Nessuna sezione Misure nella scheda, nessuna misura nel JSON-LD** (Marco, 2/11/2026; regola in
  `CLAUDE.md`).
- **Nelle descrizioni** restano le misure già scritte (es. «Ø300 mm», «220x110 mm», «altezza 80cm»): il confronto del
  2/11 sulle coppie «soffione + Ø» le ha trovate uguali al listino (139 in EN, 27 nelle altre lingue).

## Cosa chiude il cantiere

**Alma ci invia le schede tecniche.** All'arrivo si capisce la forma (un PDF per articolo, per famiglia, un archivio
CAD) e si scrive qui, con data, prima di qualunque scrittura.

## Cosa si aggiorna quando arrivano

a. **`specs` su Sanity**: ogni valore confrontato con la scheda; dove coincide, `stato` → `verificata` e
   `verificataCon` = la scheda (nome del file e data); dove non coincide, vale la scheda, e la differenza va nel verbale
   della scrittura. Le quote senza nome che la scheda chiarisce prendono la loro chiave; una misura che manca dall'elenco
   delle chiavi è una decisione di schema, non un campo libero.

b. **L'alt composto nelle cinque lingue: basta la revalidazione, `altI18n` non va riscritto.** L'alt dei prodotti si
   compone a ogni render dai `specs` che le query della collezione, dei corpi e del modello già proiettano, con i nomi
   delle misure dai messaggi `immagini.misure`: cambiato il dato, cambia la frase. `altI18n` vince sulla
   composizione, ma nessun prodotto ce l'ha (0 su 612 il 2/11 sera) e nessun caricatore lo scrive sui prodotti. ⚠️ Due
   condizioni, da controllare prima di chiudere: il conteggio di `altI18n` sulle immagini dei prodotti è ancora 0 (uno
   scritto in Studio nel frattempo si riscrive a mano); se la scheda cambia una `famiglia`, cambia anche quale misura è
   la principale, e la frase va riletta. La revalidazione: il webhook rivalida `model`, `concealedBody` e
   `‹tipo›:‹slug›` a ogni documento scritto; con il webhook spento durante la scrittura in blocco, ~~la fa il deploy
   di produzione che segue~~ ⚠️ (corretto il 2/11/2026 sera, dopo il carico della #344) si fa invalidando gli stessi
   tag a mano, procedura punto 5: il deploy da solo non basta.

c. **Le misure già scritte nelle descrizioni**, nelle cinque lingue: si cercano i numeri con unità (mm, cm, Ø, «x»)
   in `description` di modelli e corpi, si confrontano con la scheda, e le correzioni passano dalla sezione
   `descrizioni` di `contenuti:carica`, lingua per lingua.

d. **I 33 articoli con sole quote senza nome e i 27 senza misure** (`docs/specs/misure-elenchi.md` § 1 e § 2): per i
   primi la scheda dà i nomi, e da lì la misura principale; per i secondi, se la scheda ha le quote, entrano come gli
   altri. Le 623 quote senza nome del listino (§ 3 degli elenchi) si chiudono nello stesso giro.

e. **Le differenze fra listino, catalogo e sito** (§ 4 degli elenchi: W3MBP con doccetta, FLX02 ottone lucido,
   refusi del listino): ognuna si chiude con la scheda, correggendo il sito (sezione `descrizioni`) o segnalando ad
   Andrea la correzione del listino.

f. **`docs/content/catalog-reference.md`**, se le schede cambiano un dato del catalogo (descrizione, articolo,
   variante).

g. **Decisione aperta di Marco**: con le misure verificate, se pubblicare la sezione Misure nella scheda e le misure
   nel JSON-LD. Oggi no (§ B.6 di `contenuti-per-lingua.md`); se sì, è una PR a sé, e il principio resta: nel JSON-LD
   solo ciò che la pagina mostra.

## Procedura

1. **Confronto scheda ↔ `specs` in dry-run**: uno script che legge le schede (nella forma che avranno) e i `specs`
   pubblicati, e stampa per articolo le misure uguali, diverse, nuove e mancanti, più le descrizioni con misure da
   correggere; dettaglio in un file, nessuna scrittura.
2. **GO di Marco** sul dettaglio.
3. **Scrittura per campi** con `contenuti:carica` (sezioni `misure` e `descrizioni`): export del dataset del giorno
   (`pnpm sanity:export`), webhook spento da Marco, scrittura sul pubblicato dei soli campi con `ifRevisionId`,
   verbale in `tmp/contenuti-scritture/`, ripristino per sezione.
4. **Controllo** sullo stile di `faq:verifica`: rilegge da Sanity i campi scritti e li confronta con le schede, zero
   differenze; conteggio di `altI18n` sui prodotti a 0.
5. **Webhook riacceso e ~~deploy di produzione come revalidazione finale~~** ⚠️ corretto il 2/11/2026 sera, dopo il
   carico della #344: un carico col webhook spento si chiude invalidando, per ogni documento scritto, il tipo e
   `<tipo>:<slug>` (come il webhook), al massimo 16 tag per chiamata; il deploy da solo non basta (rule `cache-isr`).
   Per le misure vuol dire `model`, `concealedBody` e i `model:<slug>` e `concealedBody:<slug>` scritti: la scheda
   modello porta solo `model:<slug>`. Stato del deploy dall'API di GitHub, o da Vercel per un Redeploy.
6. Questa spec diventa un verbale; la riga di `CLAUDE.md` e quella di `ARCHITECTURE.md` § Orizzonte si aggiornano nel
   `chore(docs)` di chiusura.
