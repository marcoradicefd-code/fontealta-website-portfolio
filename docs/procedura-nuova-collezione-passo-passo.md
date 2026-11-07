# Nuova collezione — procedura passo passo

> Fontealta Website · 24/07/2026 · **rev. 28/07** (post PR-B: productType estinto; nota caso speciale Corpi a incasso)
> Scenario: Andrea comunica **nome della collezione** e **lista dei modelli** che ne fanno parte. Questa è la sequenza esatta da eseguire, dall'email di Andrea alla verifica in produzione.

---

## PASSO 0 — Raccogli da Andrea le informazioni complete

Prima di toccare Sanity, assicurati di avere tutto. Se manca qualcosa, chiedi subito con questo elenco:

- [ ] **Nome** della collezione (es. "Marina")
- [ ] **Lista codici** dei modelli (i codici listino, es. `M10, M20.E, ...`)
- [ ] **Posizione** nell'ordine del pannello collezioni ("dopo quale collezione va?")
- [ ] I modelli sono **già sul sito** o sono **articoli nuovi** del listino?
- [ ] **Cover**: c'è un'immagine, o va prodotta (pipeline Magnific)?
- [ ] Deve apparire nello **slider della home**? (sì/no)
- [ ] È **outdoor**? È **personalizzabile**? (per i flag)

> Regola d'oro: se i modelli sono articoli nuovi mai seminati, FERMATI qui — quello non è questa procedura, è una semina da listino (script one-shot, coinvolgi Claude Cowork per il piano). Questa guida prosegue per il caso normale: modelli già esistenti sul sito.

> ⚠️ **CASO SPECIALE — "Corpi a incasso"**: quella collezione NON segue questa procedura. È una vetrina senza modelli associati: l'indice interroga direttamente il tipo `concealedBody` e i corpi compaiono da soli. Per creare il documento o aggiungere un corpo nuovo vale `docs/guida-contenuti.md` (cap. Corpi a incasso), non questa guida.

---

## PASSO 1 — Verifica che i modelli esistano su Sanity

Incolla in chat Cowork (Claude) la lista codici di Andrea e chiedi:

```
Verifica su Sanity quali di questi codici esistono come modelli e quali no: [lista codici]
```

Claude fa la query GROQ e ti risponde con: trovati / non trovati. **Se ci sono non-trovati**, torna da Andrea prima di procedere (refuso suo o articolo mai seminato?). Non si inventa niente: il listino è la Bibbia.

---

## PASSO 2 — Crea il documento collection su Sanity Studio

Apri Studio → sezione Collezioni → **Create new**. Compila in quest'ordine:

1. **Title** → il nome dato da Andrea, in sentence case (es. `Marina`)
2. **Code** → minuscolo, senza spazi (es. `marina`). ⚠️ Non si cambierà mai più: è la chiave tecnica.
3. **Slug** → clicca "Generate" (di norma = code). Sarà l'URL `/collezioni/marina`.
4. **Language** → `it` (l'inglese è mirror automatico in questa fase)
5. **Order** → il numero che posiziona la collezione. La scala va a passi di 10:
   - guarda l'ordine attuale (ILLE=10 … Accessories=210)
   - "dopo Waterline (190) e prima di Yacht (200)" → scrivi `195`
   - "in fondo" → guarda l'ultimo order occupato e vai al gradino di 10 successivo (dopo la nascita di Corpi a incasso a 220, "in fondo" = `230`)
   - Non rinumerare MAI le altre collezioni.
6. **Featured** → `true` solo se Andrea la vuole nello slider home, altrimenti `false`
7. **isOutdoor / isCustomizable** → come da risposta di Andrea al Passo 0
8. **NON compilare**: conteggi (non esistono più), etichette categorie (derivano da sole)

> Nota tecnica innocua: lo Studio assegnerà al documento un `_id` casuale (UUID), diverso dagli id deterministici `collection-*-it` delle 21 collezioni nate da script. Non è un'anomalia e non va "corretto": nessuna funzionalità dipende dalla forma dell'id.

**Non pubblicare ancora** — prima la cover.

---

## PASSO 3 — Carica la cover

Requisiti non negoziabili:

- **896 × 1200 px esatti (ratio 3:4)** — le card sono tarate su questo formato; altro ratio = ritagli
- prodotto centrato, con aria sopra (soffione) e sotto (base)
- nome file **senza spazi** (es. `cover-incassi.webp`, non `cover incassi.webp`)
- formato webp (o png)

In Studio: campo **Cover Image** → upload → compila **Alt** con descrizione breve (es. `corpo incasso ille`). Se vuoi, imposta l'**hotspot** (il punto focale) cliccando sull'immagine — oggi non è usato dal render ma è la rete per il futuro.

Se la cover non è pronta: puoi pubblicare comunque (la card mostra il monogramma placeholder) e caricarla dopo.

---

## PASSO 4 — Pubblica il documento

**Publish** in Studio. La collezione ora esiste ma è **vuota**: card visibile in griglia nella posizione scelta, conteggio "0 articoli", nessuna etichetta. È normale — le etichette e il conteggio arrivano dai modelli, che associamo adesso.

---

## PASSO 5 — Associa i modelli

L'associazione sta **sul modello**, non sulla collezione: ogni modello ha un campo **Collections** (array di riferimenti) e lì va aggiunta la nuova collezione.

**Se i modelli sono pochi (≤ ~10), a mano da Studio:**

1. Apri il modello (cercalo per code)
2. Campo **Collections** → **Add item** → seleziona la nuova collezione
3. ⚠️ NON rimuovere le collezioni già presenti (un articolo può stare in più collezioni — i condivisi tipo WMRL ne hanno 5)
4. **Publish** il modello
5. Ripeti per ogni codice della lista

**Se i modelli sono tanti (> ~10), via Cowork:** incolla in chat:

```
Andrea ha creato la collezione [code] (già pubblicata su Studio). Associala a questi modelli
via mutazione MCP: [lista codici]. Preparami il piano di mutazione (append del riferimento
nell'array collections, senza toccare le appartenenze esistenti) e aspetta il mio OK.
```

Claude segue il rito standard: check bozze preesistenti → piano con tutti gli ID → tuo OK → patch+publish → verifica indipendente.

**Caso articoli condivisi**: se un modello appartiene a più collezioni e serve un ordinamento specifico dentro la nuova (sfoglio come da listino), c'è il campo `collectionOrders` — segnalalo a Claude nel messaggio, che gestisce il valore corretto.

---

## PASSO 6 — Verifica (chiedi la controprova a Cowork)

Incolla in chat:

```
Ho creato e popolato la collezione [code]. Fammi la controprova completa: GROQ (documento,
order, modelli associati = [N] attesi) e prod (posizione in griglia, conteggio, etichette
derivate, pagina /collezioni/[slug] con i modelli, EN, e slider home se featured).
```

Cosa deve risultare — tutto **senza che tu abbia compilato nulla di tutto ciò**:

- card in griglia nella posizione giusta (order)
- conteggio "N articoli" = numero dei modelli associati (count live)
- etichette Lavabo/Doccia/Vasca giuste (derivate dai **productMacro** dei modelli — post PR-B del 28/07 `productType` non esiste più)
- pagina collezione con i modelli, filtri funzionanti, hero con le categorie
- `/en/collections`: card con etichette Basin/Shower/Bath
- la revalidation è automatica (webhook) — zero deploy; se dopo qualche minuto non vedi la card, dillo a Claude che indaga (prima però i tre controlli di `docs/guida-contenuti.md` cap. 6: ricarica forzata, Publish davvero premuto, nessun errore di validazione)

Se un conteggio o un'etichetta è sbagliata, **non si corregge l'etichetta**: si corregge il dato a monte (associazione mancante o productMacro/productSubtype errati sul modello).

---

## PASSO 7 — Chiudi il giro con Andrea

Manda ad Andrea il link `/collezioni/[slug]` con: posizione, numero articoli, e la richiesta di conferma su ordine interno dei modelli e cover. Eventuali sue correzioni rientrano dal solito canale (Excel/lista).

---

## Riepilogo in 30 secondi

| # | Azione | Dove |
|---|---|---|
| 0 | Raccogli info complete (checklist) | Andrea |
| 1 | Verifica esistenza codici | Chat Cowork |
| 2 | Crea documento (title, code, slug, order, flag) | Studio |
| 3 | Cover 896×1200 + alt | Studio |
| 4 | Publish | Studio |
| 5 | Associa modelli (Studio se pochi, MCP se tanti) | Studio / Cowork |
| 6 | Controprova GROQ + prod | Chat Cowork |
| 7 | Link ad Andrea per conferma | Email |

**I tre errori che rovinano tutto**: rinominare un `code` esistente · rimuovere appartenenze durante l'associazione · cover fuori formato 3:4.
