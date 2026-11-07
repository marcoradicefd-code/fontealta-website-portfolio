# Contenuti per lingua e misure — spec del cantiere

> Aperta il 2 novembre 2026. Decisioni di Marco del 2/11/2026, prese sull'audit di Cowork e sulle analisi in
> `tmp/contenuti-lingua/` e `tmp/misure/` (sola lettura). Fa fede finché il cantiere è aperto; le voci di history
> dicono com'è andata, PR per PR.

## Da dove viene

Su Sanity ogni immagine ha un solo `alt`, in italiano, e le pagine EN, DE, FR, ES lo servono così: le 53 card di
`/de/kollektionen/boss`, la foto della scheda modello, del corpo, la cover del post. L'alt di `team-teaser` è
italiano scritto nel codice, e la card dell'autore usa il nome al posto dell'alt della foto. Le misure dei prodotti
stanno solo nei disegni del listino; il campo `specs` è vuoto su 595 modelli su 595.

## Le decisioni

### A. L'alt delle immagini (strada B, Marco, 2/11/2026)

1. `imageWithMeta` ha `altI18n` (le cinque lingue, facoltative), **letto per primo su tutte le immagini**: in Studio
   si può forzare un alt in una lingua anche su un prodotto.
2. Senza `altI18n` nella lingua della pagina, l'alt si **compone** nella lingua della pagina dai dati che ci sono già:
   «‹descrizione› ‹codice›, ‹misura principale›, ‹collezione›», con le parole e l'ordine dai messaggi della lingua
   («Boss collection», «Kollektion Boss») e la maiuscola iniziale. Anche in italiano, dalla descrizione italiana.
   La misura principale non si aggiunge quando la descrizione porta già **lo stesso valore** (S09 «250x140 mm»;
   `misuraGiaNelTesto` in `src/lib/alt-composto.ts`). ⚠️ Corretto il 3/11/2026 (Marco, #348): dalla #346 bastava
   una misura qualsiasi, e 121 articoli perdevano una principale diversa da quella scritta: 72 colonne e 46 gruppi
   l'altezza (col Ø o i «200 mm» del soffione nella descrizione), 3 incassi il Ø della placca (col Ø della S03).
3. Se non si può comporre, resta l'`alt` italiano, con `lang="it"` sull'immagine.
4. L'`alt` salvato non cambia: `card-image.ts` lo usa come chiave per scegliere la composizione della collezione.
5. Nella stessa PR: la card dell'autore legge l'alt della foto; l'alt di `team-teaser` va nei messaggi;
   `og:image:alt` della cover di collezione è composto, in tutte le lingue.

### B. Le misure (Marco, 2/11/2026; regola in `CLAUDE.md`)

1. Dal listino Edition V / R4 (06-002) e dal listino ILLE REV_07-001, con la fonte (pagina) e lo stato «da
   verificare con scheda tecnica»; mai inventate né nel testo libero nuovo. Le schede tecniche, che invia Alma, le
   verificano: il cantiere delle misure resta aperto fino ad allora, spec `docs/specs/misure.md`.
2. **Schema `specs`** su `model` e, nuovo, su `concealedBody`. Sostituisce `heightMm`, `widthMm`, `depthMm`,
   `weightKg`, `materials` (0 documenti li usano, contato il 2/11):

   | Campo | Forma |
   |---|---|
   | `famiglia` | `colonna` · `piano` · `incasso` · `gruppoParete` · `kitDoccia` · `soffione` · `accessorio` · `corpoIncasso` |
   | `misure[]` | `chiave` (elenco chiuso, § B.4) e una sola forma: `valore`, oppure `min` + `max` (con `regolabile`), oppure `valore` + `tolleranza`, oppure `lati` (due numeri); tutto in mm |
   | `attacchi[]` | `G1/2"`, `G3/4"`: dato a parte, mai una misura |
   | `fonte` | `documento` (`listinoEditionV-06-002`, `listinoIlle-REV07-001`) e `pagina` stampata. Interno: non si mostra |
   | `stato` | `daVerificare` · `verificata`, più `verificataCon` |

3. **Misura principale per famiglia** (approvata): colonna, piano, gruppo a parete → `altezzaTotale`; incasso →
   `diametroPlacca` o `placca`, per le bocche senza placca `sporgenzaBocca`; soffione → `diametroSoffione` o
   `soffione`; accessorio → `lunghezza`, poi `diametro`, poi `base`; corpo a incasso → `profondita`; **kit doccia →
   nessuna**.
4. Chiavi: `altezzaTotale`, `altezzaBocca`, `altezzaSoffione`, `altezzaComando`, `altezzaDoccetta`, `altezza`,
   `sporgenza`, `sporgenzaBocca`, `diametroTubo`, `diametroBase`, `base`, `spessorePianoMax`, `diametroPlacca`,
   `placca`, `interasseAttacchi`, `diametroSoffione`, `soffione`, `lunghezza`, `larghezza`, `profondita`, `diametro`.
   Le quote dei disegni senza un nome certo **non si caricano e non si pubblicano**; restano nell'elenco per Andrea.
5. **Formato nell'alt** (la sola misura a video): cm esatti (`2300 mm` → «230 cm», `1217 mm` → «121,7 cm»); EN
   mm col separatore e i pollici a una cifra decimale («2,300 mm (90.6 in)»); di un intervallo solo il minimo, mai
   l'intervallo; di una tolleranza solo il valore. Aggiunto il 2/11/2026 sera (#346): se la descrizione porta già una
   misura («250x140 mm», «Ø300 mm», «80cm»), la principale non si aggiunge; i due lati escono col lato lungo prima,
   come nel listino.
6. **Le misure NON si mostrano nella scheda e NON vanno nel JSON-LD** (Marco, 2/11/2026, correzione della
   proposta: la sezione «Misure» e le misure nel `Product` sono tolte prima del commit). Stanno su Sanity, con la
   fonte e lo stato; **a video entra solo la misura principale, dentro l'alt composto**. Resta il principio del
   10/09/2026: niente markup di contenuto non visibile, quindi nessuna misura nei dati strutturati. Il `Product`
   della scheda, che usciva solo con misure visibili e non è mai uscito (0 modelli su 595), è tolto con lui.
7. I nomi delle misure principali, nella forma in cui entrano nella frase dell'alt (minuscolo; in tedesco i
   sostantivi maiuscoli), stanno nei messaggi `immagini.misure`.

### C. I testi (Cowork, poi Alma) e il carico

- Tagline, `metaTitle` e `metaDescription` delle 22 collezioni nelle cinque lingue (title servito, campo da 38 a 48
  caratteri, obiettivo 39-43; description da 140 a 155; nessun doppione); alt delle 21 cover del blog e delle 2 foto
  degli autori; correzioni delle descrizioni (glossario v2 del 14/09 approvato da Alma, che vale anche dove il listino
  usa un'altra parola; errori dell'EN contro il listino; AISI, apostrofi, maiuscole; le misure nelle descrizioni
  restano).
  ⚠️ **Corretto il 4/11/2026 (#356, decisione di Marco): le tagline scritte il 2/11 sono tolte** da Sanity su tutte
  le 22 collezioni, com'era prima del carico; title e description restano. I testi di prima sono nel verbale del carico
  del 4/11 (`--ripristina`), nell'export dello stesso giorno e nella copia dei file (handoff del 4/11).
- Uno script solo, `contenuti:carica`, con le sezioni `collezioni`, `alt-blog`, `alt-autori`, `descrizioni` e
  `misure` (dall'estrazione dei disegni, spec `docs/specs/misure.md`; dalla #353 anche `pagine-uso`, e dalla #356 del 4/11/2026 una `tagline:` vuota nella sezione `collezioni` toglie il campo), come `faq:carica`: dry-run, GO, scrittura con blocco sulla revisione, verifica, verbale, ripristino
  per sezione e per lingua; la parte comune estratta da `faq-carica.ts`.
- **Ordine:** la PR del codice prima (questa), poi i testi, poi il carico **prima del merge**, col webhook di Sanity
  spento da Marco durante il carico; ~~il deploy del merge fa da revalidazione finale~~. ⚠️ **Corretto il 2/11/2026
  sera, dopo il carico della #344:** un carico col webhook spento si chiude invalidando, per ogni documento scritto,
  il tipo e `<tipo>:<slug>` (come il webhook), al massimo 16 tag per chiamata; il deploy da solo non basta, perché la
  cache dati di Vercel sopravvive ai deploy e rinfresca solo le query cambiate (rule `cache-isr`). Il 2/11 le pagine
  dei post sono rimaste all'alt italiano fino all'invalidazione dei 26 tag.

## Criteri di successo della PR del codice

- Nessuna pagina mostra misure, se non la principale dentro l'alt; nessun `Product` e nessuna misura nel JSON-LD.
  Con `altI18n` vuoto gli alt sono composti nella lingua della pagina dove i dati lo permettono.
- Test di unità: misura principale per famiglia, formati dell'alt (cm, EN mm e pollici, il minimo di un
  intervallo), alt con e senza misura principale; controprova (il difetto reintrodotto in locale fa diventare rossi
  i test).
- Provini dell'alt, cinque lingue, su B76, CD35, W010 (intervallo) e un articolo senza misure, con le misure del
  listino iniettate in locale (patch non committata), perché su Sanity non ci sono ancora.
