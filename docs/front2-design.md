# FRONT 2 — Ri-tassonomia productType → productMacro + productSubtype

> ⚠️ **CICLO CHIUSO a luglio 2026**: PR-A #60, migrazione #61, PR-B con la rimozione del
> contratto legacy e l'unset one-shot dei valori orfani. Resta la **fonte viva della
> tassonomia** (`productMacro` + `productSubtype`, label IT/EN dal listino), ma il piano
> di esecuzione e' storia: si legge al passato.

**Design doc. Sessione di sola lettura: nessuna modifica a file, nessun commit, nessuna scrittura su Sanity.**

- **Data:** 27 lug 2026
- **Fonte dati (verità unica per la migrazione):** `taxonomy-v2-2026-07-25.json`
  (`generated: 2026-07-25`, `source: Contenuti_Sito-002.xlsx + email Andrea 24/07`, **595 righe**)
  → da committare in **`scripts/data/`** con PR-A (decisione Cowork; precedente: `andrea-corrections-2026-07-23.json` in PR #54)
- **Fonte del lessico EN (dizionario delle label):** `02_Listini/Fontealta_PriceList_Edition_V-R4 update April 2026.xlsx`
- **Stato codice letto:** `main` @ `8993f63`
- **Destinazione di questo documento:** **`docs/front2-design.md`**, committato in PR-A (decisione Cowork)
- **Semantica bloccata da:** email cliente 24/07 (nuove macro CUCINA/GIARDINO, uniformazioni tipo `VASCA-MISCELATORE BORDO → VASCA-MISCELATORE`)

---

## 0 · Divergenze dal brief e assunzioni

Tre cose non tornano con il brief, e vanno fissate prima di progettare. Nessuna è bloccante.

### 0.1 «33 sottotipi» → sono 33 LABEL, 24 SOTTOTIPI

Il JSON contiene **33 `label` distinte** (le coppie `MACRO-SOTTOTIPO`, cioè le pill) ma **24 `subtype` distinti**, perché lo stesso sottotipo ricorre sotto più macro:

| sottotipo condiviso | macro in cui appare |
| --- | --- |
| `COLONNA` | LAVABO, VASCA, DOCCIA, GIARDINO |
| `MISCELATORE` | LAVABO, VASCA, DOCCIA, BIDET, CUCINA |
| `RUBINETTO PARETE` | DOCCIA, GIARDINO |
| `RUBINETTO` | DOCCIA, LAVABO |

Gli altri 20 sottotipi appartengono a una sola macro (18 dei quali solo a DOCCIA).

**Conseguenza sul design, ed è il motivo per cui l'approccio a due campi vince:** l'enum del sottotipo ha cardinalità **24**, non 33, e le 33 pill nascono per composizione. Un enum piatto a 33 valori duplicherebbe `COLONNA` quattro volte e `MISCELATORE` cinque.

### 0.2 «enum a 12 valori» → lo schema ne dichiara 14, i dati ne usano 12

`sanity/schemas/documents/model.ts:20-35` dichiara **14** opzioni. Due sono **morte**: `controllo-termostatico` e `accessory` hanno **zero** righe nel JSON e zero occorrenze in `productType_attuale`. Erano già segnalate come assorbite sotto "doccia" nel commento di `product-category.ts:13-14`.

→ In PR-B si rimuovono insieme al resto. Nessuna azione in PR-A.

### 0.3 L'audit FRONT 2 non è più su disco

`scratchpad/audit-correzioni-andrea.md` **non esiste** nel repo (né altrove sul disco): era un file dello scratchpad di sessione, perso. La cartella `scratchpad/` non esisteva prima di questo documento.

**Assunzione:** la raccomandazione dell'audit («due campi, non estensione dell'enum a ~44 valori») è quella riportata nel brief, e la adotto. **Alternativa se l'audit riemerge e diceva altro:** rileggerlo prima di aprire PR-A; questo documento resta valido come analisi dei dati e dei consumatori, cambierebbe solo §1.

### 0.4 Collocazione dei file — RISOLTA

`scratchpad/` non è gitignored, quindi lasciarci dei file li rende untracked e a rischio di perdita (è già successo: l'audit di §0.3 è svanito). **Decisione Cowork:** il JSON va in `scripts/data/`, questo documento in `docs/`, **entrambi committati in PR-A**, nessun `gitignore` su `scratchpad/`. Coerente col precedente di PR #54, dove il dato di migrazione è stato committato per riproducibilità.

### 0.5 Il listino È raggiungibile, e contiene cinque lingue

Il metodo «il dizionario è il listino» richiede il listino: al primo giro non ce l'avevo e non ho voluto inventare citazioni. **Trovato:** `02_Listini/Fontealta_PriceList_Edition_V-R4 update April 2026.xlsx` (versione R4, la stessa che è fonte del catalogo).

Un `.xlsx` è un archivio zip di XML, quindi è leggibile senza Excel:

```bash
unzip -p "<listino>.xlsx" xl/sharedStrings.xml   # tutte le stringhe
unzip -o -q "<listino>.xlsx" -d out xl/worksheets/ xl/sharedStrings.xml
# poi: risolvere gli indici <c t="s"><v>N</v></c> contro <si> di sharedStrings
```

Il foglio ha **4441 righe** e la struttura per articolo è: `A` sezione/collezione · `B` codice · `E` codice+finitura · `F` prezzo · **`G` descrizione IT · `H` EN · `I` FR · `J` ES · `K` DE**.

**Due conseguenze oltre l'EN:**

1. **FR / ES / DE esistono già, approvate dal cliente.** Il rollout i18n delle altre tre lingue non parte da zero: c'è un dizionario di prodotto pronto. Vale anche per il parcheggio FR/ES/DE delle **finiture**, che era rimasto aperto.
2. ⚠️ **Caveat per chi automatizzasse l'estrazione:** su alcune righe la descrizione lunga tracima nella colonna successiva e disallinea la mappatura (es. `RE10`: l'IT occupa `G`+`H` e l'EN finisce in `I`; idem `RE12.AST`). Una lettura per posizione fissa produrrebbe traduzioni sbagliate. Per le 24 label le ho verificate a mano una per una; per un'estrazione massiva serve una euristica di rilevamento lingua.

**Nota:** `WAX1` non è presente in questo file R4 pur essendo nella tassonomia (probabilmente è nella variante `Edition_V_plus_ILLE`); il suo gemello `W0X1` lo copre come citazione.

---

## 1 · SCHEMA

### 1.1 I due campi nuovi

Entrambi su `model`, gruppo `taxonomy` (già esistente), **accanto** a `productType` che **resta**.

```ts
// sanity/schemas/documents/model.ts

const PRODUCT_MACROS = [
  { title: "Lavabo", value: "lavabo" },
  { title: "Doccia", value: "doccia" },
  { title: "Vasca", value: "vasca" },
  { title: "Bidet", value: "bidet" },
  { title: "Cucina", value: "cucina" },
  { title: "Giardino", value: "giardino" },
] as const;

const PRODUCT_SUBTYPES = [
  { title: "Accessori", value: "accessori" },
  { title: "Accessori colonna", value: "accessori-colonna" },
  { title: "Batteria 3 fori", value: "batteria-3-fori" },
  { title: "Bocca", value: "bocca" },
  { title: "Bodyjet", value: "bodyjet" },
  { title: "Braccio", value: "braccio" },
  { title: "Braccio con soffione", value: "braccio-con-soffione" },
  { title: "Cascata", value: "cascata" },
  { title: "Colonna", value: "colonna" },
  { title: "Colonna divisibile", value: "colonna-divisibile" },
  { title: "Doccetta", value: "doccetta" },
  { title: "Erogazione parete", value: "erogazione-parete" },
  { title: "Flessibile", value: "flessibile" },
  { title: "Kit", value: "kit" },
  { title: "Miscelatore", value: "miscelatore" },
  { title: "Miscelatore parete", value: "miscelatore-parete" },
  { title: "Pannello", value: "pannello" },
  { title: "Ponte", value: "ponte" },
  { title: "Rubinetto", value: "rubinetto" },
  { title: "Rubinetto parete", value: "rubinetto-parete" },
  { title: "Saliscendi", value: "saliscendi" },
  { title: "Scarico", value: "scarico" },
  { title: "Soffione", value: "soffione" },
  { title: "Soffitto", value: "soffitto" },
] as const;
```

Campi:

```ts
defineField({
  name: "productMacro",
  title: "Macro-categoria",
  description:
    "Ambiente/famiglia del prodotto. Compone la prima metà della pill: «Doccia — Colonna». " +
    "Sostituisce progressivamente il campo Product type (legacy).",
  type: "string",
  group: "taxonomy",
  options: { list: [...PRODUCT_MACROS], layout: "dropdown" },
  // NON required in PR-A: la migrazione deve poter girare a campo vuoto.
}),
defineField({
  name: "productSubtype",
  title: "Sottotipo",
  description:
    "Seconda metà della pill. Attenzione: alcuni sottotipi valgono solo per certe macro " +
    "(es. «Batteria 3 fori» solo per Lavabo). Se la combinazione non è ammessa compare un errore.",
  type: "string",
  group: "taxonomy",
  options: { list: [...PRODUCT_SUBTYPES], layout: "dropdown" },
  validation: (Rule) =>
    Rule.custom((subtype, ctx) => {
      const macro = (ctx.document as { productMacro?: string } | undefined)?.productMacro;
      if (!subtype || !macro) return true; // coerenza verificata solo a coppia completa
      const ammessi = MACRO_SUBTYPES[macro] ?? [];
      return ammessi.includes(subtype as string)
        ? true
        : `«${subtype}» non è previsto per la macro «${macro}».`;
    }),
}),
```

### 1.2 `productSubtype`: enum o stringa libera? → **ENUM**, e il motivo è l'i18n

Il brief chiede di argomentare. La tentazione è la stringa libera: 24 valori oggi, ma il listino cresce e ogni nuovo sottotipo richiederebbe un deploy di schema.

**Quell'argomento non regge, e va detto chiaramente: la pill ha bisogno di una chiave i18n per ogni sottotipo.** Quindi un sottotipo nuovo richiede **comunque** una modifica di codice — la riga in `it.json`/`en.json`. Una stringa libera non elimina il passaggio di codice: permette solo ad Andrea di creare un sottotipo che il sito **non sa etichettare**, che ricadrebbe sul fallback «mostra il valore grezzo» e produrrebbe una pill tipo `Doccia — miscelatore-termostatico-2026`. Peggio: nessuno se ne accorgerebbe fino a che un cliente non lo vede.

Argomenti a favore dell'enum:

1. **Il costo che la stringa evita non esiste** (vedi sopra): la chiave i18n è obbligatoria in entrambi i casi.
2. **Superficie di inserimento sicura.** Oggi stesso, su un campo di testo libero (`finish.name`), tre valori su sedici sono arrivati con uno spazio iniziale invisibile da un incolla di Excel. Un dropdown rende quell'errore impossibile.
3. **Sicurezza a compilazione.** TypeGen trasforma l'enum in una union (`"lavabo" | "doccia" | …`), quindi i consumatori sbagliati non compilano. Con `string` ogni consumatore accetta qualunque cosa.
4. **Validazione della coppia** (§1.1): impossibile su testo libero senza duplicare la lista da qualche parte.

**Alternativa, se il churn dei sottotipi si rivelasse alto** (diciamo più di due revisioni l'anno): `type: "string"` **senza** `options.list`, ma con `Rule.custom` che valida contro la stessa costante condivisa `PRODUCT_SUBTYPES`. Si perde il dropdown, si tiene la validazione. Non la raccomando ora: 24 valori derivati da un listino stampato non sono un insieme volatile.

**Terza opzione scartata:** un campo unico `productLabel` a 33 valori. Duplicherebbe i sottotipi condivisi (§0.1), renderebbe la macro un dato derivato da parsing di stringa (esattamente il difetto di `categoryKey` che stiamo eliminando) e la crescita sarebbe moltiplicativa invece che additiva.

### 1.3 Mappa di coerenza macro↔sottotipo

Costante condivisa, sorgente unica per la validazione Studio e per i controlli-guardia dello script di migrazione. Derivata dal JSON:

```ts
// da mettere accanto a PRODUCT_SUBTYPES (schema) e riesportata per lo script
export const MACRO_SUBTYPES: Record<string, readonly string[]> = {
  lavabo: ["batteria-3-fori", "bocca", "colonna", "miscelatore", "rubinetto", "scarico"],
  vasca: ["colonna", "miscelatore"],
  doccia: [
    "accessori", "accessori-colonna", "bodyjet", "braccio", "braccio-con-soffione",
    "cascata", "colonna", "colonna-divisibile", "doccetta", "erogazione-parete",
    "flessibile", "kit", "miscelatore", "miscelatore-parete", "pannello", "ponte",
    "rubinetto", "rubinetto-parete", "saliscendi", "soffione", "soffitto",
  ],
  bidet: ["miscelatore"],
  cucina: ["miscelatore"],
  giardino: ["colonna", "rubinetto-parete"],
};
```

**Assunzione:** questa mappa è *chiusa* sui dati attuali. Se Andrea in futuro vuole `GIARDINO-DOCCETTA`, la mappa va estesa — è una riga. **Alternativa:** validazione solo a warning invece che a errore, se si preferisce non bloccarlo mai in Studio; sconsigliato, perché la pill di una coppia non prevista resta comunque corretta a schermo e l'errore passerebbe inosservato.

### 1.4 `productType` legacy: cosa fare

**Resta invariato in PR-A**, `Rule.required()` compreso. Motivo: è l'unica fonte del fallback (§3) e rimuoverne l'obbligo aprirebbe la porta ad articoli nuovi senza né vecchio né nuovo campo.

Marcatura della deprecazione — **RETTIFICA rispetto alla prima stesura.**

La prima stesura proponeva una `description` che diceva «*non usare per articoli nuovi*». **È una trappola**, e in fase di implementazione l'ho corretta: il campo resta `Rule.required()`, quindi dire ad Andrea di non compilarlo e poi bloccarlo con un errore di validazione lo manda contro un muro invisibile. La descrizione deve dire la verità:

> ⚠️ CAMPO SUPERATO da «Macro-categoria» + «Sottotipo». Per ora resta OBBLIGATORIO: il sito lo usa come rete di sicurezza per gli articoli non ancora convertiti, quindi su un articolo nuovo va compilato insieme agli altri due. Verrà rimosso a migrazione completata e verificata.

Titolo: `Product type (LEGACY)`.

In aggiunta, la proprietà nativa **`deprecated: { reason }`** su `defineField` (verificata sulla versione installata) dà la resa visiva nativa dello Studio, più esplicita di un semplice testo. **NON** si usano `readOnly` né `hidden` in questa fase: il campo va ancora compilato finché fa da rete. Quel pattern è da PR-B.

**Costo intermedio da accettare:** tra PR-A e PR-B, per un articolo nuovo Andrea compila **tre** campi invece di uno. Considerando che gli inserimenti arrivano a blocchi rari e guidati, è accettabile. **Alternativa:** rendere `productType` opzionale già in PR-A, così i nuovi articoli usano solo i campi nuovi — ma allora il fallback non li copre e restano invisibili ai filtri finché la migrazione non è completa. Sconsigliata.

---

## 2 · LABEL MAP

### 2.1 Composizione della pill

```
pill = productCategories[macro] + " — " + productSubtypes[subtype]
```

Separatore **` — `** (spazio, em dash U+2014, spazio): identico a quello che usano oggi le label `productTypes` (`"Lavabo — Miscelatore"`), quindi a schermo non cambia nulla nella forma.

**Namespace i18n: si riusa `productCategories`, non se ne crea uno nuovo per le macro.** Oggi `productCategories` ha 3 chiavi (`lavabo`/`doccia`/`vasca`) e alimenta già le label macro di filtro, hero collezione e card collezione. Le macro nuove sono lo stesso concetto: due namespace paralleli con lo stesso significato sarebbero debito immediato. → `productCategories` passa da 3 a **6 chiavi**; nasce **`productSubtypes`** con **24 chiavi**.

Totale chiavi nuove: **3 + 24 = 27** per lingua. (Contro le 33 di un enum piatto, e con crescita additiva.)

### 2.2 ⚠️ Trappola: le label i18n vanno scritte in caso normale, NON in MAIUSCOLO

Nel JSON i sottotipi sono tutti in maiuscolo (`MISCELATORE PARETE`) perché arrivano dall'Excel. **Le chiavi i18n devono contenere la forma di visualizzazione** (`Miscelatore parete`), mai la maiuscola del JSON.

Motivo tecnico preciso: `src/lib/sentence-case.ts` tratta come acronimo **ogni token interamente maiuscolo** e lo lascia intatto. `model-hero.tsx:102` applica `sentenceCase` alle voci meta. Quindi con un valore `"MISCELATORE PARETE"` l'hero renderebbe `Doccia — MISCELATORE PARETE` — testo urlato in pagina. Con `"Miscelatore parete"` renderizza `Doccia — miscelatore parete`, coerente con l'attuale `Doccia — colonna`.

Corollario: `PVD`, `RAL` e simili restano maiuscoli correttamente, ed è il comportamento che vogliamo. Il caso `BODYJET` va scritto **`Bodyjet`**, non `BODYJET`, altrimenti viene preso per acronimo.

### 2.3 Macro — IT (definitivo) + EN

`productCategories`:

| chiave | IT | EN | stato |
| --- | --- | --- | --- |
| `lavabo` | Lavabo | Basin | esistente, invariato |
| `doccia` | Doccia | Shower | esistente, invariato |
| `vasca` | Vasca | Bath | esistente, invariato |
| `bidet` | Bidet | Bidet | **nuovo** |
| `cucina` | Cucina | Kitchen | **nuovo** |
| `giardino` | Giardino | Garden | **nuovo** |

Le tre nuove seguono lo stile EN già in uso e sono indicate dal brief. Le considero **approvate**.

### 2.4 Sottotipi — IT (definitivo) + EN derivato dal listino

**Metodo (decisione Cowork): il dizionario è il listino.** Le descrizioni EN del listino sono traduzioni professionali già approvate dal cliente, quindi ogni label EN si deriva da lì, non dalle nostre preferenze. Fonte: `02_Listini/Fontealta_PriceList_Edition_V-R4 update April 2026.xlsx`, colonne descrizione IT/EN/FR/ES/DE (vedi §0.5 per il metodo di estrazione).

**Il listino ha corretto 9 delle 24 proposte della prima stesura.** Le correzioni sono segnate ⟲.

| chiave | IT | EN (dal listino) | citazione listino |
| --- | --- | --- | --- |
| `accessori` | Accessori | Accessories | ⚠️ nessuna descrizione: derivato dal **nome di sezione** `ACCESSORIES` (col. A) dei codici PS03-PS10 |
| `accessori-colonna` | Accessori colonna | Column accessories | ⚠️ nessuna descrizione unica: RE10 «External tap **for shower columns**» + sezione `ACCESSORIES` |
| `batteria-3-fori` | Batteria 3 fori | **Set 3-holes** ⟲ ✅ | «Basin **set 3-holes**», «Bathtub **set 3-holes**». **Deciso:** il listino vince sulla grammatica — coerenza col vocabolario export del cliente, zero invenzioni nostre. L'i18n attuale (`3-hole set`) viene sostituito |
| `bocca` | Bocca | Spout | «Wall-mounted **spout**» (bocche a parete) |
| `bodyjet` | Bodyjet | **Body-Jet** ⟲ | «Wall-mounted **Body-Jet** Spray», «Wall-mounted **Body-Jet** Rain» — grafia con trattino e J maiuscola |
| `braccio` | Braccio | Arm | «Shower **arm** with concealed showerhead» |
| `braccio-con-soffione` | Braccio con soffione | **Arm with showerhead** ⟲ | «Shower **arm with showerhead** S07», «Shower arm with Showerhead S06» |
| `cascata` | Cascata | Waterfall | «Overhead shower with central **waterfall** and concealed showerhead» |
| `colonna` | Colonna | Column | «Shower **column**», «Washbasin **column**», «Bathtub **column**» |
| `colonna-divisibile` | Colonna divisibile | **Divisible column** ⟲ | «**Divisible** shower **column** with mixer, showerhead S06 and handshower» — non `Split column` |
| `doccetta` | Doccetta | **Handshower** ⟲ | «Sliding rail with **handshower** and flexible hose» — parola unica |
| `erogazione-parete` | Erogazione parete | **Wall coupling** ⟲ ✅ | W0X1 «**Wall coupling**, with column and 200 mm showerhead S06»; PS03 «**Wall coupling**» (nudo). **Deciso:** coppia asimmetrica approvata — vedi §2.4.1 |
| `flessibile` | Flessibile | **Flexible hose** ⟲ | «**Flexible hose** 150 cm, double hemming, polished brass» |
| `kit` | Kit | Kit | «Wall-mounted mixer with shower **kit**», «Shower **kit** (handshower, flexible hose and wall coupling)» — la macro porta già «Shower» |
| `miscelatore` | Miscelatore | Mixer | «Washbasin **mixer**», «Bidet **mixer**», «Sink **mixer**» |
| `miscelatore-parete` | Miscelatore parete | Wall-mounted mixer | «**Wall-mounted mixer** with shower kit», «Wall-mounted shower mixer, with column…» |
| `pannello` | Pannello | Panel | «Wall-mounted shower **panel**, with 2 stop taps, handshower and footwash» |
| `ponte` | Ponte | Bridge | «Shower **bridge** with 2 stop taps, showerhead S07 and handshower» |
| `rubinetto` | Rubinetto | Tap | «Concealed **tap**», «stop **tap**», «Garden **tap** with hose connection», «External **tap**» — **mai** `Faucet` |
| `rubinetto-parete` | Rubinetto parete | Wall-mounted tap | «**Wall-mounted tap** with shower kit» |
| `saliscendi` | Saliscendi | **Sliding rail** ⟲ | «**Sliding rail** with handshower and flexible hose» — non `Slide rail` |
| `scarico` | Scarico | Waste | «Pushbutton **waste** for washbasin» |
| `soffione` | Soffione | **Showerhead** ⟲ | «concealed **showerhead**», «**Showerhead** S06», «Antiscale showerhead» — parola unica |
| `soffitto` | Soffitto | **Ceiling-mounted** ⟲ | «**Ceiling-mounted** shower arm, round / square» |

### 2.4.1 ✅ CHIUSA — `erogazione-parete`: coppia asimmetrica approvata

> **Decisione (Cowork):** IT «Erogazione parete» + EN «Wall coupling». L'asimmetria è **accettata consapevolmente** e va **annotata per Andrea**, così non venga letta come un errore di traduzione da chi rivede i contenuti.

Il ragionamento che ha portato lì, per il verbale:

Il termine di listino è accertato — i 22 articoli che portano questo sottotipo (`W0X1`, `W6X1`, `WAX1`, la serie `W*X*`, `W*49.E`…) sono descritti come **«Wall coupling»**, e `PS03` da solo è «Presa d'acqua» / «Wall coupling». Su questo non c'è dubbio.

Il problema è un altro, ed è editoriale: **l'IT di Andrea e l'IT del listino non coincidono.** Il listino dice «Presa d'acqua», la tassonomia di Andrea dice «EROGAZIONE PARETE». Se teniamo l'IT della tassonomia e l'EN del listino otteniamo una coppia che non è una traduzione di sé stessa:

> IT «Erogazione parete» ↔ EN «Wall coupling»

Tre strade valutate:

1. ✅ **ADOTTATA — tenere così** (IT dalla tassonomia, EN dal listino). La tassonomia è la spec del cliente per l'italiano, il listino è la spec del cliente per l'inglese: entrambe sono sue. L'asimmetria non è visibile a nessun utente, che vede una lingua per volta.
2. IT → «Presa d'acqua» per simmetria col listino. Contraddice però la label bloccata nella tassonomia. **Scartata.**
3. EN → «Wall-mounted outlet» / «Wall-mounted delivery» per simmetria con l'IT. **Scartata:** nessuno dei due termini compare nel listino (verificato: zero occorrenze di `outlet` e di `delivery`), sarebbe l'unica label inventata da noi in tutta la tabella.

**Azione residua, non bloccante:** annotare la coppia per Andrea nella comunicazione dei contenuti, così l'asimmetria risulti deliberata e non un errore da correggere.

### 2.4.2 ✅ CHIUSA — `accessori` / `accessori-colonna`: derivate, con dichiarazione

> **Decisione (Cowork):** approvate come **derivate dal nome di sezione `ACCESSORIES`**, con la derivazione dichiarata qui invece di spacciata per citazione.

`accessori` e `accessori-colonna` non hanno un termine EN nel listino: quegli articoli (PS03-PS10, RE*, XQ200, XT200) sono descritti individualmente («Wall-mounted handshower bracket», «External tap for shower columns», «Extension stem for installation on ground») e non esiste una descrizione-categoria. La fonte citabile è il **nome della sezione di listino**, `ACCESSORIES`, più il complemento «for shower columns» per la variante colonna. Le due label sono quindi **derivate, non citate**: le segno come tali per trasparenza, ma non le considero aperte — sono l'unica resa sensata.

### 2.5 Le 33 pill risultanti

Composte, in IT, con il conteggio articoli dal JSON:

| # | macro | sottotipo | pill IT | art. |
| --- | --- | --- | --- | --- |
| 1 | BIDET | MISCELATORE | Bidet — Miscelatore | 6 |
| 2 | CUCINA | MISCELATORE | Cucina — Miscelatore | 17 |
| 3 | DOCCIA | ACCESSORI | Doccia — Accessori | 5 |
| 4 | DOCCIA | ACCESSORI COLONNA | Doccia — Accessori colonna | 13 |
| 5 | DOCCIA | BODYJET | Doccia — Bodyjet | 2 |
| 6 | DOCCIA | BRACCIO | Doccia — Braccio | 7 |
| 7 | DOCCIA | BRACCIO CON SOFFIONE | Doccia — Braccio con soffione | 13 |
| 8 | DOCCIA | CASCATA | Doccia — Cascata | 2 |
| 9 | DOCCIA | COLONNA | Doccia — Colonna | 114 |
| 10 | DOCCIA | COLONNA DIVISIBILE | Doccia — Colonna divisibile | 12 |
| 11 | DOCCIA | DOCCETTA | Doccia — Doccetta | 6 |
| 12 | DOCCIA | EROGAZIONE PARETE | Doccia — Erogazione parete | 22 |
| 13 | DOCCIA | FLESSIBILE | Doccia — Flessibile | 4 |
| 14 | DOCCIA | KIT | Doccia — Kit | 2 |
| 15 | DOCCIA | MISCELATORE | Doccia — Miscelatore | 51 |
| 16 | DOCCIA | MISCELATORE PARETE | Doccia — Miscelatore parete | 58 |
| 17 | DOCCIA | PANNELLO | Doccia — Pannello | 7 |
| 18 | DOCCIA | PONTE | Doccia — Ponte | 2 |
| 19 | DOCCIA | RUBINETTO | Doccia — Rubinetto | 8 |
| 20 | DOCCIA | RUBINETTO PARETE | Doccia — Rubinetto parete | 40 |
| 21 | DOCCIA | SALISCENDI | Doccia — Saliscendi | 4 |
| 22 | DOCCIA | SOFFIONE | Doccia — Soffione | 13 |
| 23 | DOCCIA | SOFFITTO | Doccia — Soffitto | 7 |
| 24 | GIARDINO | COLONNA | Giardino — Colonna | 10 |
| 25 | GIARDINO | RUBINETTO PARETE | Giardino — Rubinetto parete | 8 |
| 26 | LAVABO | BATTERIA 3 FORI | Lavabo — Batteria 3 fori | 6 |
| 27 | LAVABO | BOCCA | Lavabo — Bocca | 6 |
| 28 | LAVABO | COLONNA | Lavabo — Colonna | 22 |
| 29 | LAVABO | MISCELATORE | Lavabo — Miscelatore | 38 |
| 30 | LAVABO | RUBINETTO | Lavabo — Rubinetto | 2 |
| 31 | LAVABO | SCARICO | Lavabo — Scarico | 2 |
| 32 | VASCA | COLONNA | Vasca — Colonna | 44 |
| 33 | VASCA | MISCELATORE | Vasca — Miscelatore | 42 |

Totale: **595**. Le macro pesano: DOCCIA 392, VASCA 86, LAVABO 76, GIARDINO 18, CUCINA 17, BIDET 6.

---

## 3 · CONSUMATORI

### 3.1 Inventario reale (verificato, non presunto)

| # | consumatore | file:riga | cosa fa oggi |
| --- | --- | --- | --- |
| C1 | pill card modello | `src/components/cards/model-card.tsx:123-125` | `tType.has(pt) ? tType(pt) : pt` |
| C2 | riga «Tipologia» scheda | `…/modello/[slug]/_components/model-specs.tsx:29-33` | idem, dentro `rows` |
| C3 | meta hero scheda | `…/modello/[slug]/_components/model-hero.tsx:44-47` | idem, poi `sentenceCase` |
| C4 | filtro categoria + predicato | `…/collezioni/[slug]/_components/models-section.tsx:63, 65-68, 78` | `categoryKey(pt)` per le facet **e** per il filtraggio |
| C5 | label macro hero collezione | `…/collezioni/[slug]/_components/collection-hero.tsx:35, 38` | `categoryKey(pt)` aggregato |
| C6 | label derivate card collezione | `src/components/cards/collection-card.tsx:75, 77` | `categoryKey` sui `productTypes` proiettati |
| C7 | sorgente ordine/classificazione | `src/lib/product-category.ts` | `CATEGORY_ORDER` (3) + `categoryKey` (prefisso stringa) |

**Verificato:** nessuno spec e2e tocca filtri o `productType` (`tests/e2e/*`, `tests/regression/*`) → **nessuna modifica agli e2e**. È un rischio in meno rispetto a quanto ipotizzava il brief.

### 3.2 Il fallback difensivo, e il suo limite misurato

Nuova sorgente unica, in `src/lib/product-category.ts`:

```ts
export const MACRO_ORDER = ["lavabo", "doccia", "vasca", "cucina", "giardino", "bidet"] as const;
export type MacroKey = (typeof MACRO_ORDER)[number];

/** Macro effettiva: il campo nuovo se c'è, altrimenti derivata dal legacy. */
export function resolveMacro(m: {
  productMacro?: string | null;
  productType?: string | null;
}): MacroKey | null {
  if (m.productMacro) return m.productMacro as MacroKey;
  if (m.productType) return categoryKey(m.productType); // legacy, 3 valori
  return null;
}
```

`categoryKey` e `CATEGORY_ORDER` **restano** durante la transizione (rimossi in PR-B). `MACRO_ORDER` è il nuovo ordine condiviso.

**Il fallback funziona, ma va detto quanto:** ho confrontato riga per riga la macro nuova con quella che `categoryKey(productType_attuale)` deriva oggi.

| | righe |
| --- | --- |
| macro coincidente → fallback **corretto** | **550 / 595** (92,4%) |
| macro divergente → fallback **sbagliato** | **45 / 595** (7,6%) |

Le divergenze:

| transizione | righe | esempi |
| --- | --- | --- |
| doccia → giardino | 17 | COL30, COL30.G, COL30.H, COL90 |
| lavabo → cucina | 17 | K1M.LT, K2M.CD, K2M.L, K2M.LT |
| lavabo → bidet | 6 | CD35B, F50B, I30B, W30B |
| doccia → lavabo | 3 | W100, W200, W35.M |
| lavabo → doccia | 1 | MRL |
| lavabo → giardino | 1 | W12.AST |

**Come leggerlo, che è il punto:** lo stato intermedio (PR-A deployata, migrazione non ancora eseguita) non è *rotto*, è **corretto-ma-incompleto**. Le tre macro nuove semplicemente **non esistono ancora**: i loro 41 articoli continuano a comparire sotto la vecchia macro, i filtri mostrano 3 pill invece di 6, e nessuna pagina va in errore. Le 4 righe che si spostano tra macro esistenti restano dove sono oggi. Tutto si sana da sé nel momento in cui i dati arrivano, senza un secondo deploy di codice.

Questo è esattamente ciò che rende sicuro l'ordine «codice prima, dati dopo».

### 3.3 Piano per consumatore

**Query GROQ** (`sanity/lib/queries.ts`) — proiezioni da aggiungere. ⚠️ **RETTIFICA: sono SETTE, non cinque.** La prima stesura contava cinque proiezioni e ometteva `FEATURED_COLLECTIONS_QUERY` — omissione che avrebbe rotto il `typecheck`, vedi sotto.

| query | aggiungere |
| --- | --- |
| `MODEL_DETAIL_QUERY` | `productMacro, productSubtype` |
| `COLLECTION_DETAIL_QUERY.models` | `productMacro, productSubtype` |
| `COLLECTION_BY_SLUG_QUERY.models` | `productMacro, productSubtype` |
| `MODEL_DETAIL.autoRelatedByCollection` | `productMacro, productSubtype` (ramo dormiente, ma alimenta il tipo union di `ModelCard`) |
| `COLLECTIONS_OVERVIEW_QUERY` | `"productMacros": array::unique(*[_type=="model" && references(^._id)].productMacro)` accanto a `productTypes` |
| **`FEATURED_COLLECTIONS_QUERY`** | idem — **mancava nella prima stesura** |
| `MODEL_DETAIL.collectionAffinities` | idem |

**Perché `FEATURED_COLLECTIONS_QUERY` è obbligatoria.** `FeaturedCollectionCard` (card della home) si **tipizza** su `COLLECTIONS_OVERVIEW_QUERY_RESULT` ma **riceve dati** da `FEATURED_COLLECTIONS_QUERY`, e `featured-collections.tsx:26` fonde le due sorgenti in un unico `items` col fallback «se 0 featured, prime 6 by order». La compatibilità strutturale fra le due è un **lock scritto nel codice** (commento in `featured-collections.tsx:19-20`): estendere solo `COLLECTIONS_OVERVIEW` avrebbe fatto divergere i tipi e rotto il `typecheck` su quella riga. Stesso motivo per cui `collectionAffinities` deve restare identica a `COLLECTIONS_OVERVIEW`.

Poi `pnpm typegen`. Le proiezioni `collectionAffinities` e `COLLECTIONS_OVERVIEW_QUERY` devono restare **identiche fra loro** (lock esistente: sono strutturalmente compatibili con `CollectionCard`).

**C1/C2/C3 — la pill.** Helper condiviso, un solo posto:

```ts
// src/lib/product-label.ts (nuovo)
export function productLabel(
  m: { productMacro?: string | null; productSubtype?: string | null; productType?: string | null },
  tMacro: Translator, tSub: Translator, tType: Translator,
): string | null {
  if (m.productMacro && m.productSubtype) {
    const a = tMacro.has(m.productMacro) ? tMacro(m.productMacro) : m.productMacro;
    const b = tSub.has(m.productSubtype) ? tSub(m.productSubtype) : m.productSubtype;
    return `${a} — ${b}`;
  }
  if (m.productType) return tType.has(m.productType) ? tType(m.productType) : m.productType;
  return null;
}
```

I tre consumatori chiamano questo. Nota: richiede tre hook `useTranslations` nei componenti chiamanti (sono già Client/Server component che usano `useTranslations`, quindi nessun cambio di natura). **Alternativa più snella:** passare la label già composta dal server; scartata perché `model-card` è usato da tre sorgenti diverse e complicherebbe l'union dei tipi.

**Caso `macro` presente ma `subtype` assente:** ricade sul legacy. **Assunzione:** la migrazione li scrive sempre in coppia, quindi non si verifica; il ramo esiste come rete.

**C4 — filtro.** `categoryKey(m.productType)` → `resolveMacro(m)` in entrambi i punti (facet a riga 63, predicato a riga 78) e `CATEGORY_ORDER` → `MACRO_ORDER` a riga 65. Le label restano `tCat` (= `productCategories`, esteso a 6). Nessun cambio di struttura: le pill compaiono solo per le macro presenti nella collezione, quindi finché i dati non arrivano restano 3.

**C5 — hero collezione.** Identico: `resolveMacro`, `MACRO_ORDER`, `tCat`.

**C6 — card collezione.** Qui il dato è aggregato in query, non per modello: si legge `productMacros` quando l'array è non vuoto, altrimenti si deriva da `productTypes` con `categoryKey` come oggi.

```ts
const present = new Set<MacroKey>(
  (productMacros ?? []).filter(Boolean).length
    ? (productMacros as MacroKey[]).filter(Boolean)
    : (productTypes ?? []).filter(Boolean).map(categoryKey),
);
labels = MACRO_ORDER.filter((c) => present.has(c)).map((c) => tCat(c));
```

⚠️ **Comportamento misto durante la migrazione**: se lo script procedesse a lotti, una collezione potrebbe avere alcuni modelli migrati e altri no. Con la logica sopra, `productMacros` non vuoto fa **ignorare** i `productTypes` dei modelli non ancora migrati → la card mostrerebbe meno macro del vero. **Soluzione adottata: migrare in una sola transazione** (`visibility: "sync"`), così lo stato misto non esiste in pratica.

⚠️ **RETTIFICA — l'alternativa «unire i due insiemi» è SBAGLIATA.** La prima stesura la proponeva come opzione più permissiva per il caso a lotti. In fase di implementazione è emerso il difetto: **`productType` resta popolato anche DOPO la migrazione** (si rimuove solo in PR-B), quindi l'unione non sarebbe una tolleranza temporanea — mostrerebbe **per sempre** anche le macro derivate dal legacy. La collezione Kitchen diventerebbe «Lavabo · Cucina» invece di «Cucina», cioè **esattamente l'errore che questa ri-tassonomia esiste per correggere**. La preferenza è la logica corretta, non un compromesso.

**C7 — `product-category.ts`.** Aggiungere `MACRO_ORDER`, `MacroKey`, `resolveMacro`; conservare `CATEGORY_ORDER`, `CategoryKey`, `categoryKey` con un commento che ne dichiara la natura transitoria.

### 3.4 `MACRO_ORDER` — CONFERMATO `lavabo, doccia, vasca, cucina, giardino, bidet`

**Confermo la proposta Cowork, e il motivo non è una preferenza: la differenza fra le due proposte è empiricamente invisibile.**

Al primo giro avevo proposto `…, bidet, cucina, giardino`, tenendo il bidet accanto al blocco bagno (i 6 articoli BIDET sono le varianti `B` dei miscelatori lavabo — `CD35B`, `F50B`, `I30B`, `W30B`, `W35B`, `W40B` — e il listino li chiama «Bidet mixer», nella stessa famiglia). Ragionamento semantico corretto ma **operativamente irrilevante**, perché l'ordine si vede solo fra le macro *effettivamente presenti* in una collezione.

Verificato incrociando le 21 collezioni Sanity con la tassonomia: **zero collezioni contengono BIDET insieme a CUCINA o GIARDINO.** Le due proposte producono quindi lo stesso output su **ogni pagina del sito**. A parità di risultato vince la proposta già decisa, e la questione è chiusa.

L'unico caso in cui riemergerebbe è una collezione futura che mescoli bidet e cucina/giardino — scenario che oggi non esiste e che, se arrivasse, costa una riga.

Macro presenti per collezione **dopo** la migrazione (e quindi le pill di filtro che compariranno):

| collezione | macro post-migrazione | cambia? |
| --- | --- | --- |
| boss · flamingo · ille · origo · skinny · twiggy | lavabo · doccia · vasca · **bidet** | **+BIDET** (6 collezioni) |
| community | lavabo · doccia · **giardino** | **+GIARDINO** |
| spring | lavabo · **giardino** | **+GIARDINO**, e perde «doccia» |
| kitchen | **cucina** | ⚠️ **da «lavabo» a «cucina»**: cambia, non si aggiunge |
| accessories | lavabo · doccia | invariato |
| arko · boss-wide · classy · club · club-large · in-out · onda · origo-rame · square · waterline · yacht | doccia | invariato (11 collezioni) |

Due cose che vale la pena notare, perché sono il beneficio visibile della migrazione:

- **`kitchen` oggi mostra «Lavabo»**, perché tutti i suoi 17 articoli sono `lavabo-miscelatore`. Dopo la migrazione mostra «Cucina». È l'errore più vistoso che questa ri-tassonomia corregge.
- **`spring` perde «doccia» e guadagna «giardino»**: i suoi `COL30`/`COL90` erano classificati come colonne doccia. Anche qui il filtro diventa veritiero.

---

## 4 · SEQUENZA

Ordine dettato dalla disciplina Sanity del progetto e dalle lezioni registrate in `docs/history.md`.

### PR-A — codice difensivo (nessun dato toccato)

1. Schema: `productMacro`, `productSubtype`, `MACRO_SUBTYPES`, validazione della coppia; `description` di deprecazione su `productType`.
2. i18n: `productCategories` 3 → 6 chiavi; nuovo `productSubtypes` × 24, IT + EN, in `it.json` e `en.json`.
3. Query: le proiezioni di §3.3 + `pnpm typegen` (tipi committati).
4. `product-category.ts`: `MACRO_ORDER`, `resolveMacro`; nuovo `product-label.ts`.
5. Consumatori C1-C6 con fallback.
6. Five-check + matrice visiva `tmp/visual-check-front2-prea/`: con **zero dati migrati** il sito deve risultare **pixel-identico a prima** su card, scheda, hero, filtri, card collezione, IT e EN. È l'unica asserzione che conta in questa fase.
7. Merge → deploy. Lo Studio prende i campi nuovi (vuoti) al deploy successivo, dato che è embedded.

### Migrazione dati — script one-shot

Segue il pattern migrazioni del progetto (`scripts/migrate-remove-ambient.ts`, `scripts/populate-water-supply.ts`), **non** MCP: c'è una lezione registrata secondo cui la scrittura via MCP fallisce quando esiste uno Studio locale con schema non deployato al registro MCP.

- Input: **il JSON, verbatim**, copiato in `scripts/data/taxonomy-v2-2026-07-25.json` e committato come dato immutabile (più `.prettierignore`, come per `andrea-corrections-2026-07-23.json`).
- **DRY-RUN di default** (read token); `--execute` gated su write token. Mai il write token in dry-run.
- Match per `code`. Guardie **prima** di scrivere: 595 righe nel JSON ↔ 595 model in Sanity, zero codici orfani per lato, ogni coppia `(macro, subtype)` presente in `MACRO_SUBTYPES`, ogni `productType_attuale` uguale a quello letto da Sanity (se differisce, il JSON è stale → **abort**).
- `tx.commit({ visibility: "sync" })` in **una transazione**, poi settle-delay ~1,5 s prima di ricontare (race read-after-write del Content Lake).
- Contatori-guardia per fase e **resume-by-state** (salta se il "prima" è già a target) → idempotente, rilanciabile.
- **Tripla rete di verifica:** (a) ri-lettura dello script, (b) GROQ indipendente via MCP/Cowork su `count(*[defined(productMacro)]) == 595` e distribuzione per macro uguale a `{doccia:392, vasca:86, lavabo:76, giardino:18, cucina:17, bidet:6}`, (c) controprova Cowork sull'Excel.
- ⚠️ **Poi: Redeploy WITHOUT build cache.** Lo script scrive **diretto** sul Content Lake, non pubblica da Studio: il webhook non scatta e Vercel ristora la fetch-cache dal build precedente. Un deploy normale **non basta** per le pagine SSG con `revalidate:false`. È la lezione del 23/07, confermata due volte.
- Verifica visiva post-deploy in produzione: comparsa delle 3 macro nuove nei filtri di una collezione che le contiene, pill nuove su card e scheda, IT + EN.

### PR-B — pulizia (DOPO, non subito)

Precondizioni, tutte e tre: Andrea ha confermato le 4 righe flaggate; periodo di rodaggio in produzione (**raccomando 1-2 settimane**); zero segnalazioni.

1. Rimuovere il ramo di fallback da C1-C6 e `resolveMacro` si riduce a leggere `productMacro`.
2. Rimuovere `categoryKey`, `CATEGORY_ORDER`, `CategoryKey`.
3. Rimuovere `productType` dallo schema (con i suoi 14 valori, `controllo-termostatico` e `accessory` inclusi) e dalle **7** proiezioni; togliere `productTypes` dalle 3 query collezione lasciando solo `productMacros`; `pnpm typegen`.
4. Rimuovere il namespace i18n `productTypes` (14 chiavi × 2 lingue).
5. `unset` di `productType` sui 595 documenti — **secondo script one-shot**, stessa disciplina, oppure lasciarlo come dato inerte (come si è fatto con `articleCountNative`: prima il ritiro dal codice, poi l'unset dei dati).
6. `Rule.required()` spostata su `productMacro` e `productSubtype`.

---

## 5 · RISCHI E CASI LIMITE

### 5.1 Le 4 righe flaggate → **migrarle con il default di famiglia**

| code | label proposta | `productType` attuale | macro dal fallback |
| --- | --- | --- | --- |
| COL90.AST | GIARDINO-COLONNA | doccia-colonna | doccia ❌ |
| COL90.AST.L | GIARDINO-COLONNA | doccia-colonna | doccia ❌ |
| W12.AST | GIARDINO-RUBINETTO PARETE | lavabo-miscelatore | lavabo ❌ |
| W12.AST.FS | GIARDINO-RUBINETTO PARETE | doccia-colonna | doccia ❌ |

**Raccomandazione: migrarle adesso**, non salterle. Il ragionamento:

Se le salti, quelle 4 righe restano sul fallback, che per tutte e quattro dà una macro **sbagliata** (doccia o lavabo invece di giardino). Cioè: saltarle non è prudenza, è **conservare uno stato noto-errato in produzione**. Migrandole, la macro diventa corretta (GIARDINO) e l'unico dubbio residuo è il **sottotipo**, che è un errore molto più piccolo: la macro guida filtri, hero e card collezione, il sottotipo guida solo la seconda metà del testo della pill.

Contorno operativo: lo script logga i 4 codici in una sezione dedicata del suo output, e restano tracciati qui e nel messaggio di commit come «da confermare». Se Andrea li corregge, sono 4 patch in Studio.

**Alternativa:** escluderle dallo script (`--skip-flagged`) e lasciarle sul fallback. Traccia di audit più pulita, ma quattro macro sbagliate live. Non la raccomando.

### 5.2 Pagine EN — rischio molto ridotto dopo l'adozione del listino

`en.json` per molti namespace è ancora un mirror dell'IT (strategia i18n: EN «best effort» fino a T1). La tabella EN dei sottotipi è invece **traduzione vera** — e adesso non è più una nostra bozza: **23 label su 24 sono derivate dal listino**, cioè da traduzioni professionali già approvate dal cliente (§2.4).

Le tre voci che restavano da decidere sono **tutte chiuse** (Cowork, 27/07):

| voce | esito |
| --- | --- |
| `erogazione-parete` | ✅ IT «Erogazione parete» + EN «Wall coupling». Asimmetria approvata, **da annotare per Andrea** (§2.4.1) |
| `batteria-3-fori` | ✅ «Set 3-holes» — il listino vince sulla grammatica, coerenza col vocabolario export del cliente (§2.4) |
| `accessori`, `accessori-colonna` | ✅ derivate da sezione `ACCESSORIES`, con derivazione dichiarata (§2.4.2) |

**Prerequisito di PR-A: soddisfatto.** Tutte e 24 le label EN sono definite; 21 citate da descrizione di listino, 2 derivate da nome di sezione, 1 approvata come coppia asimmetrica. **Zero label inventate da noi.**

### 5.3 e2e — nessun impatto (verificato)

Nessuno spec sotto `tests/` menziona filtri o `productType`. Le pill di filtro usano già le label macro (`productCategories`), non quelle di `productType`, quindi anche i selettori testuali resterebbero validi. **Zero modifiche agli e2e.**

### 5.4 UX Studio per Andrea

- Titoli campo **in italiano** («Macro-categoria», «Sottotipo»): è il suo unico contatto col sistema.
- La `description` del sottotipo deve dire che non tutte le combinazioni sono ammesse, altrimenti l'errore di validazione arriva senza contesto.
- I due campi vanno **sopra** `productType` nel gruppo `taxonomy`, così il legacy scende visivamente in coda.
- Ordine delle opzioni nel dropdown: alfabetico (come sopra) è più cercabile di quello per frequenza. **Alternativa:** i più usati in cima (`colonna`, `miscelatore`, `miscelatore parete`); sconsigliato, l'alfabetico è prevedibile.
- ⚠️ Rischio di transizione: tra PR-A e PR-B, per un articolo nuovo servono **tre** campi. Va detto ad Andrea a voce, non solo nella `description`.

### 5.5 TypeGen

- `productMacro`/`productSubtype` diventano union strette e **nullable** (`| null`) in tutti i result type che li proiettano: i consumatori devono gestire il null — è già il caso, il fallback lo fa.
- `array::unique(...productMacro)` aggiunge un campo a `COLLECTIONS_OVERVIEW_QUERY_RESULT` e a `collectionAffinities`: le due proiezioni vanno tenute **identiche** o si rompe la compatibilità strutturale con `CollectionCard`.
- `ModelData` in `model-card.tsx` è un'union multi-sorgente: se una sola delle sorgenti non proietta i campi nuovi, l'accesso richiede una guardia `"productMacro" in model` (pattern già in uso per `requiredConcealedBody`). **Meglio proiettarli in tutte** e non avere guardie.
- `sanity/schema.json` è gitignored e rigenerato: nessun rumore nel diff.

### 5.6 Altri

- **Pipeline di semina immutabile:** `scripts/parse-catalog.ts` e `scripts/seed-sprint-2.ts` scrivono ancora `productType`. Se il seed Sprint-2 venisse rieseguito, reintrodurrebbe il campo legacy e **non** popolerebbe i nuovi. Stesso caveat già registrato per `articleCountNative`. Fuori scopo (regola one-shot immutabile), ma da annotare.
- **`docs/TAXONOMY.md` v1.0 è dichiarato LOCKED** e descrive la tassonomia a 12 valori: va aggiornato a v2.0 nel giro docs, altrimenti resta la fonte autorevole di un modello superato.
- **Il JSON è una fotografia del 25/07** su un catalogo che il 24/07 ha perso 4 articoli (D3, P60, FLX03, FLX04). Ha 595 righe e Sanity ha 595 modelli: coincidono. La guardia «zero orfani per lato» dello script lo verifica formalmente.
- **Nessuna route dipende da `productType`**: non esistono pagine per tipologia, quindi zero impatti su URL, `sitemap`, canonical o redirect.

---

## 6 · EFFORT E SPLIT DI SESSIONE

| fase | taglia | contenuto |
| --- | --- | --- |
| Curatela EN | ✅ **FATTA** | 24/24 label definite dal listino; le 3 voci aperte chiuse da Cowork il 27/07 (§5.2). Prerequisito di PR-A **soddisfatto** |
| *(bonus emerso)* dizionario FR/ES/DE | — | il listino le contiene già approvate: patrimonio per il rollout i18n, fuori da questo scope (§0.5) |
| PR-A codice difensivo | **M** | schema + validazione + 27 chiavi i18n × 2 + 5 query + typegen + 6 consumatori + helper + matrice visiva |
| Script di migrazione | **M** | dry-run, guardie, transazione sync, tripla rete, redeploy senza cache |
| PR-B pulizia | **S** | rimozioni + typegen + eventuale unset dati |
| Aggiornamento `TAXONOMY.md` v2.0 + note history | **S** | giro docs consolidato |

**Split raccomandato — tre sessioni:**

1. **Sessione 1 (PR-A).** Prerequisito: EN approvato. Tutto il codice difensivo, un solo commit per scopo (schema / i18n / query+typegen / consumatori), merge e deploy. Criterio di uscita: **il sito è identico a prima**, matrice visiva a conferma.
2. **Sessione 2 (dati).** Script, dry-run, STOP HARD sull'output del dry-run, execute, tripla verifica, redeploy senza build cache, verifica in produzione. È la sessione delicata: da fare a mente fresca e senza altro lavoro in parallelo.
3. **Sessione 3 (PR-B + docs).** Dopo il rodaggio e la conferma dei 4 flaggati. Pulizia, `TAXONOMY.md` v2.0, note in `history.md`.

**Perché non due sessioni:** unire PR-A e la migrazione significherebbe non avere un momento in cui il codice difensivo è provato in produzione da solo. È proprio quel momento a rendere la migrazione dei dati un'operazione reversibile: se qualcosa non torna, i dati si possono azzerare e il sito torna al fallback senza toccare il codice.

---

## Appendice — delta di migrazione per `productType` legacy

Quanto si sfrangia ogni valore vecchio (dal JSON). Solo **4 valori su 12 migrano 1:1**: `lavabo-batteria`, `lavabo-colonna`, `lavabo-incasso`, `vasca-bordo`.

| `productType` (n) | → label nuove |
| --- | --- |
| `doccia-colonna` (225) | DOCCIA-COLONNA 95 · DOCCIA-MISCELATORE PARETE 41 · DOCCIA-RUBINETTO PARETE 29 · DOCCIA-EROGAZIONE PARETE 20 · DOCCIA-COLONNA DIVISIBILE 12 · GIARDINO-COLONNA 10 · DOCCIA-MISCELATORE 10 · GIARDINO-RUBINETTO PARETE 7 · LAVABO-RUBINETTO 1 |
| `doccia-soffione` (53) | DOCCIA-COLONNA 19 · DOCCIA-BRACCIO CON SOFFIONE 13 · DOCCIA-SOFFITTO 7 · DOCCIA-MISCELATORE PARETE 4 · DOCCIA-KIT 2 · DOCCIA-SALISCENDI 2 · DOCCIA-RUBINETTO PARETE 2 · DOCCIA-EROGAZIONE PARETE 2 · DOCCIA-CASCATA 2 |
| `doccia-accessori` (54) | DOCCIA-ACCESSORI COLONNA 13 · DOCCIA-SOFFIONE 13 · DOCCIA-BRACCIO 7 · DOCCIA-DOCCETTA 6 · DOCCIA-ACCESSORI 5 · DOCCIA-FLESSIBILE 4 · DOCCIA-BODYJET 2 · DOCCIA-SALISCENDI 2 · **LAVABO-SCARICO 2** |
| `lavabo-miscelatore` (50) | LAVABO-MISCELATORE 18 · **CUCINA-MISCELATORE 17** · **BIDET-MISCELATORE 6** · LAVABO-BOCCA 6 · DOCCIA-MISCELATORE 1 · GIARDINO-RUBINETTO PARETE 1 · LAVABO-RUBINETTO 1 |
| `doccia-miscelatore` (48) | DOCCIA-MISCELATORE 40 · DOCCIA-RUBINETTO 8 |
| `vasca-colonna` (48) | VASCA-COLONNA 44 · VASCA-MISCELATORE 4 |
| `vasca-bordo` (38) | VASCA-MISCELATORE 38 ✔︎ 1:1 |
| `kit-doccia` (22) | DOCCIA-MISCELATORE PARETE 13 · DOCCIA-RUBINETTO PARETE 9 |
| `lavabo-colonna` (22) | LAVABO-COLONNA 22 ✔︎ 1:1 |
| `lavabo-incasso` (20) | LAVABO-MISCELATORE 20 ✔︎ 1:1 |
| `doccia-pannello` (9) | DOCCIA-PANNELLO 7 · DOCCIA-PONTE 2 |
| `lavabo-batteria` (6) | LAVABO-BATTERIA 3 FORI 6 ✔︎ 1:1 |

In grassetto le righe che **cambiano macro** e che quindi il fallback non può indovinare (§3.2).

**Sorgenti delle attribuzioni nel JSON:** `file_002` 450 · `tipo_attuale_confermato` 135 · `email_5e` 5 · `default_famiglia_DA_CONFERMARE` 4 · `famiglia_W35.M` 1.
