# Fontealta Catalog — Taxonomy Reference (v2.0)

> ## ⚠️ DOCUMENTO STORICO per due dimensioni su tre
>
> **`productType` e `ambient` NON ESISTONO PIÙ.** Non sono deprecati, non sono da
> evitare: sono stati rimossi da schema, codice e dati. Nulla in questo file va letto
> come istruzione per scrivere codice su quei due campi.
>
> | dimensione | stato | dove sta la verità oggi |
> |---|---|---|
> | `productType` (enum 14) | **RIMOSSO** — schema e codice in PR-B (lug 2026), valori orfani cancellati dallo one-shot successivo | `productMacro` (6) + `productSubtype` (24) → **`docs/front2-design.md`** e il LOCK in `sanity/schemas/documents/model-taxonomy.ts` |
> | `ambient` (enum 5) | **RIMOSSO** insieme alle route ambient (`8ef5cc4`) | nessun sostituto: la dimensione non esiste più |
> | `tags` (array aperto) | **VIVO e invariato** | questo documento, sezione «tags» |
>
> Le 33 coppie macro/sottotipo del catalogo nascono per **composizione**, non da un
> elenco piatto: i sottotipi sono condivisi fra macro (`COLONNA` sotto 4 macro,
> `MISCELATORE` sotto 5), quindi un enum unico li duplicherebbe. È esattamente la
> ragione per cui l'enum piatto a 14 valori descritto qui sotto è stato superato.
>
> **Cosa resta valido di questo file:** la spec dei `tags`, la struttura del catalogo
> e la logica del parser, e la memoria di com'era il modello dati prima di FRONT 2.

## Filosofia (v1.0 — com'era)

Tassonomia **piatta e coerente**: lo stesso schema descrive tutti i 591 articoli senza eccezioni speciali. Tre dimensioni indipendenti:

1. ~~**`productType` (enum chiuso, 14 valori)** — cosa il prodotto FA funzionalmente~~ → **rimosso**, sostituito da `productMacro` + `productSubtype`
2. ~~**`ambient` (enum chiuso, 5 valori)** — dove si usa~~ → **rimosso**, nessun sostituto
3. **`tags` (array di string aperto)** — varianti tecniche, marker, collezioni di provenienza — **l'unica delle tre ancora viva**

Insieme garantivano: filtri sito potenti, schema migration-friendly, parsing automatico dal catalogo.

---

## productType — 14 valori · ⚠️ CAMPO RIMOSSO, sezione storica

Classificazione funzionale del prodotto. Cosa fa. **Questo campo non esiste più**: la
classificazione viva è `productMacro` + `productSubtype` (`docs/front2-design.md`).

| Value | Esempi | Descrizione |
|---|---|---|
| `lavabo-miscelatore` | F50, F50H, K35, W2M.I, W2MB.I | Miscelatori da bordo per lavabo |
| `lavabo-batteria` | W3.I, W3.F, W3.O | Batterie 3 fori |
| `lavabo-incasso` | WMP.I, W2MP.F, WM30.I | Miscelatori da incasso (concealed) |
| `lavabo-colonna` | I40L.M, B40L.M, F60L.M, S40L.M | Colonne freestanding lavabo |
| `vasca-bordo` | W4MB.I, W4MBP.I, W5B.I | Miscelatori bordo vasca (4-5 fori) |
| `vasca-colonna` | I40V.ME, B40V.ME, C40V.ME, F60V.ME | Colonne freestanding vasca |
| `doccia-colonna` | B76.M, C40.ME, C90.M, BW76.ME, S40.ME | Colonne doccia (bestseller Fontealta) |
| `doccia-pannello` | P22.E, P22.M, Q120, P60 | Pannelli doccia murali |
| `doccia-soffione` | Q500, R700, Q380, SA53.15, SA40.12, S06, S07 | Soffioni grandi + bracci doccia |
| `doccia-miscelatore` | MR, MR2.CD, TC1.I, TC2.I, TC3.I | Miscelatori da incasso per doccia (incl. termostatici da incasso) |
| `doccia-accessori` | BJ.02, BJ.04, D3, + collezione Accessori | Accessori doccia (body-jet, deviatori, doccette, ecc.) |
| `kit-doccia` | WX75.SK, WX47C.SK, WX03.SK, SK.10 | Kit doccia composti |
| `controllo-termostatico` ⚠️ | (in dismissione) | **Tenuto inerte** — i record migrano a `doccia-miscelatore`/`doccia-accessori`. Resta in enum, 0 record post-migrazione |
| `accessory` ⚠️ | (in dismissione) | **Tenuto inerte** — i record migrano a `doccia-*`. Resta in enum, 0 record post-migrazione |

### Note di classificazione (edge cases)

- **Bracci doccia con soffione (SA series)**: classificati come `doccia-soffione` (la funzione è erogare acqua, il braccio è il vincolo di fissaggio).
- **Miscelatori esterni a parete (W010, W083, ecc.)**: vanno per affinità funzionale. W010 (per lavabo) → `lavabo-miscelatore`. W083 (per doccia) → `doccia-colonna`. Decidere caso per caso nel parser.
- **Comandi parete (CW.1, CW.2)**: → `controllo-termostatico`.
- **Soffioni a mano S02-S16**: → `accessory` (sono parte di kit, non si vendono come prodotto principale).
- **FLX-series**: → `accessory` (flessibili).
- **PS-series, D-series**: → `accessory` (dispenser/portasapone).
- **RE-series**: → `accessory` (rubinetti accessori giardino).
- **XQ200/XT200**: → `accessory` (innesti per fissaggio a terreno).

---

## ambient — 5 valori · ⚠️ CAMPO RIMOSSO, sezione storica

Contesto applicativo del prodotto. **Questo campo non esiste più**, ed è stato rimosso
insieme alle pagine ambient (`8ef5cc4`) senza sostituto: il sito non classifica più i
prodotti per contesto d'uso.

| Value | Quando si usa |
|---|---|
| `outdoor` | Giardini, piscine, terrazze, spazi esterni residenziali. Sezioni: SPRING (17), gran parte di WATERLINE (16) se da soffitto/parete esterna. |
| `indoor` | Ambienti chiusi residenziali. Sezioni: tutte le 6 collezioni bagno (ILLE/FLAMINGO/SKINNY/TWIGGY/BOSS/ORIGO) + le 10 mono-doccia indoor (CLASSY, BOSS WIDE, CLUB, CLUB LARGE, ORIGO RAME, ONDA, ARKO, SQUARE, IN&OUT). |
| `kitchen` | Cucine. Sezione 18 KITCHEN (17 articoli). |
| `yacht` | Imbarcazioni. Sezione 20 YACHT (30 articoli). |
| `bagno` | Bagno generico (legacy, evitare se possibile — usare indoor). |

### Note di classificazione

- **WATERLINE**: la maggior parte è outdoor (soffioni a soffitto, bracci esterni). Alcuni concealed (TC.HF, BJ) possono essere indoor. Decidere parser-side dal contesto.
- **COMMUNITY**: hospitality (resort/spa) tipicamente outdoor o indoor ad alta intensità. Default `outdoor`, marcare con tag `community`.
- **YACHT**: sempre `yacht`.
- **CUCINA**: sempre `kitchen`.
- **6 collezioni bagno (ILLE-ORIGO)**: di base `indoor`. Articoli outdoor di queste collezioni esistono raramente — se troviamo nel catalogo articoli `B76.M.SPRING` (es.), allora `outdoor`.

### `parentMenu` (campo separato dell'ambient document)

Il documento `ambient` Sanity ha già un campo `parentMenu` che mappa al menu navigation. Mantenere allineato:
- `outdoor` → menu "Outdoor"
- `indoor` → menu "Indoor"
- `kitchen` → menu "Kitchen"
- `yacht` → non in menu MVP, futuro
- `bagno` → non in menu (legacy)

---

## tags — array di string aperto

Tag riconosciuti automaticamente dal parser dai suffissi tecnici. Permettono filtri ricchi senza esplodere l'enum.

| Tag | Trigger del parser | Significato | Esempio |
|---|---|---|---|
| `community` | Sezione 19 COMMUNITY OR suffisso `.AST` | Uso hospitality/multi-utente | `B76.AST`, `COL90.AST` |
| `yacht` | Sezione 20 YACHT | Marine | `BW50.YCWS.M` |
| `auto-stop` | Suffisso `.AST` | Rubinetto temporizzato | `B76.AST` |
| `cold-water` | Suffisso `.CWS`, `.YCWS`, `.XYCWS` | Cold Water System | `BW50.YCWS.M` |
| `hot-water` | Suffisso `.EWS`, `.YEWS`, `.XYEWS` | Energy Water System | `BW50.YEWS.M` |
| `pull-out` | Suffisso `.S` (in kitchen context) | Estraibile | `K35.S` |
| `pull-down` | Suffisso `.LT`/`.LTS` | Abbattibile sotto-finestra | `K1M.LT`, `K2M.LTS` |
| `concealed-body` | Marker 🔒 nel catalogo | Include parti incasso | `WMP.I 🔒` |
| `high-flow` | Suffisso `.HF` | Termostatico High Flow | `TC.HF1`, `TC.HF4` |
| `waterline` | Sezione 16 WATERLINE | Provenienza collezione Waterline | `Q500`, `SA53.15`, `TC.HF2` |
| `multi-way` | Suffisso `.2`/`.3`/`.4` (in non-kitchen context) | Vie multiple | `MR2.INC` (2 vie), `HF4.INC` (4 vie) |
| `external` | Suffisso `.E` (esterno) | Versione esterna (a parete, non incasso) | `WA03.E`, `W563.E` |
| `with-shower` | Suffisso `.D` | Doccetta inclusa | `I40V.D`, `B76.D` |
| `remote-control` | Suffisso `.RC` | Comando remoto | `I40L.RC`, `C50AS.RC` |
| `with-mixer` | Suffisso `.M`/`.ME` | Include miscelatore (ridondante con productType?) | Decidere se serve |
| `pvd-finish` | Disponibile in finiture PVD (BB/BC/AB/DB) | Finiture PVD-coated | Derivato da `availableFinishes` |
| `painted-finish` | Disponibile in finiture verniciate (MB/RL) | Finiture verniciate | Derivato |

### Note tag

- Tag come `with-mixer` (`.M`) o `external` (`.E`) sono **ridondanti** con `productType` e `tags` esistenti. Il parser DEVE decidere nel design se vale la pena renderli espliciti per filtri sito o tenerli impliciti. **Default**: includerli — costo zero, beneficio per filtri specifici.
- Tag derivati da `availableFinishes` (`pvd-finish`, `painted-finish`) sono **calcolati**, non parsati. Possono essere generati automaticamente da uno script post-seed.

---

## Esempi finali (validation della tassonomia) · ⚠️ record storici

I sei record qui sotto sono **come si scrivevano nel maggio 2026**: portano `productType`
e `ambient`, due campi che oggi non esistono. Non vanno usati come modello per scrivere
un documento `model` — servono a leggere la storia e a validare la spec `tags`, che è
l'unica parte ancora viva.

### Esempio 1: ILLE Boss residenziale standard

Codice catalogo: `B76.M` (sezione BOSS COLLECTION, sotto Doccia)

```json
{
  "_id": "model-b76m",
  "code": "B76.M",
  "name": { "it": "Colonna doccia Boss B76", "en": "Boss B76 shower column" },
  "productType": "doccia-colonna",
  "ambient": "indoor",
  "tags": ["with-mixer"],
  "collections": [{ "_ref": "collection-boss-it" }],
  "availableFinishes": ["AB", "BB", "BC", "BX", "DB", "MB", "MX", "RL"]
}
```

### Esempio 2: Boss B76 hospitality

Codice catalogo: `B76.AST` (sezione COMMUNITY)

```json
{
  "_id": "model-b76-ast",
  "code": "B76.AST",
  "name": { "it": "Colonna doccia Boss B76 auto-stop", "en": "Boss B76 auto-stop shower column" },
  "productType": "doccia-colonna",
  "ambient": "outdoor",
  "tags": ["community", "auto-stop"],
  "collections": [{ "_ref": "collection-boss-it" }, { "_ref": "collection-community-it" }],
  "availableFinishes": ["BX", "MB", "MX", "RL"]
}
```

Nota: `collections` array per gestire i 23 articoli cross-section (vedi catalog-reference.md note metodologiche).

### Esempio 3: Boss Wide marine

Codice catalogo: `BW50.YCWS.M` (sezione YACHT)

```json
{
  "_id": "model-bw50-ycws-m",
  "code": "BW50.YCWS.M",
  "name": { "it": "Colonna doccia Boss Wide BW50 marine cold water", "en": "Boss Wide BW50 marine cold water shower column" },
  "productType": "doccia-colonna",
  "ambient": "yacht",
  "tags": ["yacht", "cold-water", "with-mixer"],
  "collections": [{ "_ref": "collection-bosswide-it" }, { "_ref": "collection-yacht-it" }],
  "availableFinishes": ["MX", "BX"]
}
```

### Esempio 4: Soffione WATERLINE outdoor

Codice catalogo: `Q500` (sezione WATERLINE)

```json
{
  "_id": "model-q500",
  "code": "Q500",
  "name": { "it": "Soffione doccia a soffitto quadrato 500mm", "en": "Square 500mm ceiling rain shower" },
  "productType": "doccia-soffione",
  "ambient": "outdoor",
  "tags": ["waterline"],
  "collections": [{ "_ref": "collection-waterline-it" }],
  "availableFinishes": ["AB", "BB", "BC", "BX", "DB", "MB", "MX", "RL"]
}
```

### Esempio 5: Termostatico WATERLINE indoor

Codice catalogo: `TC.HF2` (sezione WATERLINE, sub-sezione termostatici)

```json
{
  "_id": "model-tc-hf2",
  "code": "TC.HF2",
  "name": { "it": "Miscelatore termostatico High Flow 2 vie", "en": "Thermostatic mixer High Flow 2-way" },
  "productType": "controllo-termostatico",
  "ambient": "indoor",
  "tags": ["waterline", "high-flow", "multi-way", "concealed-body"],
  "collections": [{ "_ref": "collection-waterline-it" }],
  "availableFinishes": ["AB", "BB", "BC", "BX", "DB", "MB", "MX", "RL"]
}
```

### Esempio 6: Kitchen pull-out

Codice catalogo: `K35.S` (sezione KITCHEN)

```json
{
  "_id": "model-k35-s",
  "code": "K35.S",
  "name": { "it": "Miscelatore cucina K35 pull-out", "en": "Kitchen mixer K35 pull-out" },
  "productType": "lavabo-miscelatore",
  "ambient": "kitchen",
  "tags": ["pull-out"],
  "collections": [{ "_ref": "collection-kitchen-it" }],
  "availableFinishes": ["BX", "MB", "MX", "RL"]
}
```

---

## Implicazioni per il parser · ⚠️ spec storica, il parser è già scritto

Requisiti dati a `scripts/parse-catalog.ts` nel maggio 2026, quando ancora non esisteva.
I punti 2 e 8 nominano `productType` e `ambient`, che oggi non esistono più: restano qui
perché il resto della lista (sezioni, suffissi, finiture, marker 🔒, dedup dei 23
cross-section) descrive ancora com'è fatto il catalogo.

Il parser DOVEVA:

1. **Riconoscere le 21 sezioni numerate** (1️⃣ ILLE → 2️⃣1️⃣ ACCESSORIES) come **collection di appartenenza**
2. **Riconoscere le sotto-sezioni `### 🚿 Lavabo`, `### 🛁 Vasca`, `### 🚿 Doccia`** all'interno delle 6 collezioni bagno per inferire `productType` macro (lavabo / vasca / doccia)
3. **Parsare i suffissi tecnici** dal codice secondo le regole della tabella tags
4. **Estrarre la lista finiture** dalla colonna "Finiture" del catalogo (es. "AB · BB · BC · BX · DB · MB · MX · RL" → array)
5. **Estrarre il marker 🔒** per `concealed-body` tag + `includesConcealedBody: true`
6. **Estrarre la descrizione IT** dalla cella descrizione (presente per tutte le sezioni tranne ILLE che ha solo i codici nel R4 update)
7. **Deduplicare i 23 articoli cross-section** (lista esplicita in note metodologiche del catalogo: WMRL, MR, WX75.SK, ecc.) appendendo collection-ref invece di creare doc duplicati
8. **Inferire `ambient`** dalla collection di appartenenza (sezione 17 SPRING → outdoor; sezione 18 KITCHEN → kitchen; sezione 20 YACHT → yacht; sezione 19 COMMUNITY → outdoor; sezioni 1-6 bagno → indoor; sezioni 7-15+16 mono-doccia → indoor o outdoor secondo lookup table)

Questa logica è stato-of-the-art per il parsing markdown del catalog Fontealta. Lookup table esatta + regole edge cases vengono codificate nello script `scripts/parse-catalog.ts` di Sprint 2.

---

## Migration-safety

Cosa NON cambia se domani aggiungiamo:
- **Una nuova lingua** (es. DE/FR/ES): tassonomia invariata, solo `name`/`description` traduzioni
- **Una nuova collezione** (es. WELLNESS futura): aggiungi un'altra `collection` Sanity, articoli usano le coppie macro/sottotipo esistenti
- **Una variante tecnica nuova** (es. "touchless"): aggiungi tag `touchless`, schema invariato
- **Un nuovo finish** (es. titanio TI): aggiungi finish, articoli linkano via `availableFinishes`

Cosa invece RICHIEDE schema migration:
- Aggiungere un valore a `PRODUCT_MACROS` o `PRODUCT_SUBTYPES` — che vivono in
  `sanity/schemas/documents/model-taxonomy.ts`, **unica fonte** importata sia dallo
  schema Studio sia dagli script di migrazione. Due copie divergenti scriverebbero
  coppie che Studio poi rifiuta.

---

*Versione tassonomia: **v2.0** — 29 luglio 2026.*
*v2.0 registra la rimozione di `productType` e `ambient`: il documento passa da spec
operativa a documento storico, tranne la spec `tags` che resta viva. La tassonomia
operativa è `docs/front2-design.md`.*
*v1.0 — locked 4 maggio 2026, decisioni prese in sessione di pianificazione Sprint 2.*
*Riferimento dati: docs/content/catalog-reference.md (R4 update Apr 2026, 591 articoli unici).*
