# Prompt per Claude Code — togliere gli scatti al primo caricamento

> **STATO al 28 agosto 2026 — tutti e quattro i punti CHIUSI, e la migrazione
> al CDN di Sanity completa su tutto il sito.**
>
> | punto | PR | esito |
> |---|---|---|
> | 1 · LQIP come placeholder | #125 | fatto sulle card e sulle schede prodotto |
> | 2 · derivate dal CDN di Sanity | #125 · #128 · #129 · #131 · #132 | prodotti, hero, cover, home, blog e referenze |
> | 3 · meno larghezze | #128 | 15 candidati → 10, liste globali dichiarate |
> | 4 · prime card senza lazy | #125 | prime cinque, una riga a `xl` |
>
> Più la **#126**, fuori specifica: la scheda del corpo a incasso mostrava sempre
> il monogramma mentre tutti e 17 i corpi hanno la foto.
>
> **Numeri finali, misurati sull'HTML servito in produzione** (`main` `c8ec7a9`):
>
> | pagina | peso | candidati/foto | `/_next/image` |
> |---|---|---|---|
> | `/collezioni/boss` | 637 → **593 KB** | 15 → **10** | 865 → **0** |
> | `/collezioni` | 207 → **192 KB** | 10 → **8** | 248 → **13** |
> | `/modello/b40l` | 103 → **100 KB** | 15 → **10** | 22 → **0** |
> | `/` | 140 → **135 KB** | 10 → **8** | 76 → **8** |
>
> Primo colpo a freddo su una larghezza mai richiesta, stessa foto: **1,506 s →
> 0,238 s**, sei volte e mezzo. Il file servito da Sanity è il **27% più grande**
> perché non subisce la seconda compressione di Vercel: a 6-8 KB per immagine è il
> lato giusto del compromesso, ma va detto.
>
> **Nessuna sorgente Sanity passa più dall'ottimizzatore di Vercel**, in nessuna
> pagina. Chiuso il 28/08 con le ultime due: **#131** le card in evidenza della
> home (12 sorgenti → 0) e **#132** i sette renderer dormienti di blog e referenze,
> migrati *prima* che abbiano immagini — i post non hanno copertina e
> `projectReference` è a zero, quindi il delta visibile era zero per costruzione e
> il valore era togliere la mina finché il contesto c'era. La verifica è il grep:
> nessun componente che usa `urlFor` importa più `next/image` diretto. ⚠️ Va fatto
> sull'**import** e non sulla stringa: `blog/page.tsx` la contiene in un commento.
>
> **Quello che resta su `/_next/image` ci resta a ragione**, ed è tutto e solo
> non-Sanity: gli **8** della home e i **76** di `/produzione` sono WebP **locali**,
> i **13** di `/collezioni` e dei corpi sono l'**Unsplash** degli hero. Nessuno dei
> due deve passare dal loader — è la ragione per cui resta una prop e non un
> `loaderFile` globale.
>
> **AGGIUNTA il 31 agosto 2026 — la galleria dei multi-collezione.** Questa voce
> non c'era: il prompt che chiudeva il lavoro chiedeva di «riformularla», ma nello
> STATO non esisteva, quindi si scrive adesso invece di fingere una riga che c'era.
> 12 modelli su 595 stanno in più collezioni e hanno **una composizione per
> collezione**, con lo sfondo di quella collezione: la prima è la `primaryImage`,
> le altre **23** stanno in `images[]`. Fino a ieri la card mostrava sempre la
> primary, quindi **23 posizioni uscivano con lo sfondo di un'altra collezione**.
> Ora la card sceglie per collezione (`src/lib/card-image.ts`, coda dell'alt
> `, collezione X`, case-insensitive, controprova posizionale, fallback alla
> primary). Verificato sugli **hash degli asset**, non a occhio: **6 casi su 6** in
> locale contro **3 su 6** in produzione, e `/collezioni/ille` resta **identica**
> (66 immagini, stessa impronta). ⚠️ **Resta aperto solo l'eventuale carosello
> sulla scheda modello**: lì la pagina non appartiene a una collezione, quindi la
> primary è la scelta giusta e le altre composizioni non sono raggiungibili.
>
> ⚠️ **Superata il 7/10/2026: il progetto è su Vercel Pro** (`.claude/rules/ci-deploy.md`). La riga
> sotto resta come verbale.
>
> **L'unica riga ancora aperta è amministrativa, non tecnica:** il progetto sta sul
> **piano Hobby di Vercel, dichiarato non commerciale**. Va cambiato **prima del
> go-live**, nella stessa classe di M27 (`NEXT_PUBLIC_SITE_URL` al cutover). Il
> tetto delle 5.000 trasformazioni al mese, che questa specifica citava come
> ragione tecnica, dopo questo lavoro non è più il problema: il problema è il
> contratto.
>
> Le due **CORREZIONI** datate dentro §2 e §3 restano dove sono e non si toccano:
> sono la prova di perché una specifica applicata va archiviata invece che lasciata
> in giro. La prima diceva una cosa falsa sul percorso delle immagini, la seconda
> prometteva un numero (4-5 candidati) che non era verificabile — e infatti il
> traguardo vero è stato 10, non 4-5.
>
> Spostato qui dalla radice del repo il 28/08 (`chore(docs)`): i due comandi qui
> sotto portano il percorso nuovo.

Le foto prodotto adesso si vedono (query, `ModelCard` e `ModelHero` sono a posto).
Resta che al **primo** ingresso in una pagina compaiono una alla volta.

## Come darlo a Claude Code — tre modi, dal più comodo

**1. Non copiare niente.** Lancia `claude` dentro `fontealta-website` e digli:

```
segui docs/specs/PROMPT-immagini-a-scatti.md
```

Legge il file da solo. È anche il modo migliore: se il file cambia, cambia il
lavoro, e non resta in giro una copia vecchia incollata da qualche parte.

**2. Copiare tutto negli appunti.** Un comando, dalla radice del repo:

```
pbcopy < docs/specs/PROMPT-immagini-a-scatti.md
```

Da lì incolli dove vuoi con ⌘V. (Questo blocco ha già l'icona «copia» a destra
in VS Code, su GitHub e in quasi tutti i visualizzatori Markdown: il pulsante che
cercavi esiste, ma sta sui blocchi di codice — Markdown non esegue JavaScript,
quindi un bottone vero dentro un `.md` non è possibile.)

**3. Aprire il file e selezionare a mano** — ⌘A, ⌘C. Sempre valido.

---

## Il fatto, misurato in produzione il 27 agosto su `/collezioni/boss`

- **53 foto, ma 865 URL candidati** nel `srcSet`: sono **16 larghezze per immagine**,
  da 32 a 3840 px, per card che sul serio vengono renderizzate fra 250 e 380 px.
- Primo colpo su una card a `w=384`: **1,4 · 1,9 · 1,4 secondi**.
  Stesso identico URL subito dopo: **0,33 · 0,23 · 0,19 s**. Da 5 a 8 volte meno.
- **Non è la banda**: quelle immagini pesano 3,4-4 KB l'una.
- Il browser tiene ~6 connessioni per host, quindi le foto arrivano a ondate di sei
  ogni secondo e mezzo. **Sono quelle le ondate che vedi.**
- La stessa foto, stessa larghezza, chiesta **direttamente al CDN di Sanity** su
  taglie mai richieste prima: **0,40 · 0,45 · 0,31 s** a freddo. Quattro volte meglio.
- La miniatura sfocata (LQIP) **è già nella pagina**: 30 KB di base64 spediti su 53
  card, dentro il payload, e **non usati da nessuno** — nessun `<img>` ha
  `placeholder="blur"`. Stiamo pagando il peso senza prendere il beneficio.

Quindi: non è il numero di foto e non è il loro peso. È la **latenza della prima
trasformazione**, moltiplicata per un numero di taglie molto più grande del necessario.

## 1. Usare la LQIP che stiamo già spedendo

È l'intervento che toglie lo scatto percepito, e non costa una richiesta in più:
la base64 viaggia già dentro l'HTML.

In `model-card.tsx` e in `model-hero.tsx` (e in ogni altro punto che renderizza
`primaryImage` / `image`) passa a `next/image`:

```tsx
placeholder="blur"
blurDataURL={lqip}
```

La sorgente è `coverImage.metadata.lqip` — le query proiettano già
`"metadata": asset->metadata` su tutte e cinque le proiezioni, verificato.
In `sanity/lib/image.ts` c'è già `pickLqip()`: usalo invece di leggere il campo a mano.

⚠️ **Guardia obbligatoria**: se `lqip` è assente, **ometti entrambe le prop**.
`blurDataURL` vuoto con `placeholder="blur"` fa esplodere il render, e i 30 modelli
Yacht senza foto passano di lì.

Effetto: il riquadro non è mai vuoto, mostra una versione sfocata **di quella foto**
e va a fuoco quando arriva. Il tempo di caricamento non cambia, la sensazione sì.

## 2. Spostare la trasformazione da Vercel a Sanity

> **CORREZIONE (audit del 27 ago).** La prima stesura diceva che ogni foto passava
> per una derivata `?w=2400&q=82` ri-compressa da Vercel. Falso per le card: avevo
> letto **un solo** tag `<img>`, e quel tag era l'hero. Rimisurato sui 865 URL:
> 848 hanno l'interno `?fit=max&auto=format` **senza `w`**, 17 hanno `w=2400&q=82`
> e sono l'hero (asset 896×1200). Sotto c'è la versione giusta, che è **peggiore**.

Le card non chiedono a Sanity nessuna riduzione: l'URL interno non ha `w`. Quindi
per **ogni** larghezza del `srcSet` Vercel si scarica l'originale **3072×3072, 9,4
megapixel**, e lo ridimensiona lui. Non è latenza di trasformazione: è un file
grande tirato giù una volta per taglia. È per questo che si arriva a 1,5 s mentre
il CDN di Sanity, che la riduzione la fa all'edge, sta a 0,4 s.

Sull'hero invece il giro doppio c'è davvero: interno `w=2400&q=82`, esterno `q=75`
— la qualità 82 viene chiesta, pagata e buttata.

`next-sanity@12.4.0` è già installato ed esporta il loader pronto:

```tsx
import { imageLoader } from "next-sanity/image";
// ...
<Image loader={imageLoader} src={coverUrl} ... />
```

**Passalo come prop sui soli `<Image>` che puntano a Sanity, NON come
`loaderFile` globale in `next.config.ts`.** Un loader globale intercetterebbe anche
`/brand/fontealta-monogram-gray.png` (il fallback monogramma) e i placeholder
Unsplash, che non sono URL di Sanity: si romperebbero in silenzio.

Tre guadagni insieme:
- **1,5 s → 0,4 s** sulla prima richiesta, misurato sopra;
- niente doppia compressione;
- si esce dal tetto di Vercel, che sul piano Hobby dà **5.000 trasformazioni al mese**:
  604 prodotti × 16 larghezze fanno ~9.600, cioè il tetto si sfonda con una sola
  scansione del catalogo.

## 3. Chiedere molte meno larghezze

Documentazione di Sanity, testuale: *«si ottiene un enorme guadagno di prestazioni se
il front-end limita il numero di dimensioni e ritagli richiesti. Sanity mette in cache
il risultato nel CDN globale, e se rivede lo stesso URL serve il dato dall'edge più
vicino all'utente.»*

`next.config.ts` non definisce `deviceSizes` né `imageSizes`, quindi valgono i default:
8 + 8 larghezze, ed è da lì che escono i 16 candidati per immagine. Restringili alla
scala che le card usano davvero.

**Non copiare numeri da questo prompt: ricavali da `COVER_SIZES`** (in `model-card.tsx`,
righe 52-57, dove il calcolo della griglia è già scritto e commentato), tenendo conto
del DPR 2.

> **CORREZIONE (audit del 27 ago).** Qui avevo scritto «da 16 a 4-5». Numero non
> verificato, e sbagliato: `deviceSizes`/`imageSizes` sono **globali**, non esiste una
> lista per-immagine, quindi tagliare a 4-5 vuol dire togliere le taglie grandi che
> servono agli hero full-bleed. Il traguardo giusto è **15 → ~9**: stringere
> `imageSizes` a quello che le card usano davvero e togliere i doppioni da
> `deviceSizes` (750, 1200, 2048), tenendo 1920 e 3840 per gli hero.
>
> **E va fatto in una PR sua**, dopo il punto 2: una volta che le trasformazioni le
> fa Sanity, le taglie in più non costano più quota Vercel — costano peso di HTML.
> La fretta sparisce, e la lista è globale mentre il loader tocca solo i prodotti:
> mescolarle in un'unica PR vuol dire non sapere quale delle due ha prodotto cosa.

⚠️ `w` e `h` solo **interi**: la documentazione di Sanity avverte che i valori non
interi causano lentezza o timeout.

## 4. La prima fila non deve aspettare lo scroll

Le card sopra la piega partono oggi in `loading="lazy"`, quindi aspettano
l'IntersectionObserver prima ancora di mettersi in coda. Passa un indice da
`ModelsSection` a `ModelCard` e metti `priority` sulle **prime 4-6**; il resto resta lazy.
Stessa cosa sull'immagine di `ModelHero`, che è l'LCP della scheda prodotto.

## Cosa NON fare

- **Non togliere il lazy loading** dalle altre: 53 richieste in parallelo peggiorano.
- **Non alzare `quality`**: il peso non è il problema, sono 3-4 KB a immagine.
- **Non toccare il riquadro `aspectRatio: 1/1`**: lo spazio è già riservato e non c'è
  salto di layout. Quella parte è giusta.
- **Non aggiungere una libreria di lazy-loading**: `next/image` fa già tutto.

## Verifica — e falla coi numeri, non a sensazione

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Poi, sul deploy:

1. **Candidati per immagine.** Scarica l'HTML di `/collezioni/boss` e conta le
   occorrenze di `srcSet` per singola foto: da **16** devono scendere a **4-5**.
2. **Primo colpo a freddo.** Prendi un URL immagine mai chiesto e cronometralo due
   volte: il primo deve passare da **~1,5 s** a **~0,4 s**, e la differenza fra primo
   e secondo colpo deve assottigliarsi.
3. **La sfocatura c'è.** Nell'HTML servito, un `<img>` con `placeholder="blur"` porta
   la base64 come `background-image` nello `style`. Se non la trovi, la prop non è
   arrivata.
4. **A occhio, a cache vuota.** Finestra in incognito su `/collezioni/boss`: nessuna
   card deve mai essere un rettangolo grigio vuoto. Su `/collezioni/yacht` invece il
   monogramma **deve** restare: è il fallback dei 30 senza foto, e deve continuare a
   funzionare anche con la guardia LQIP del punto 1.

---

## Nota di metodo — perché questo file esiste

Scrivere la specifica in un file Markdown nel repo, e passarla all'agente invece di
descrivergli il lavoro a voce, ha un nome: **spec-driven development**. Non è una
nostra invenzione ed è il modo consigliato di lavorare con gli agenti di codice.

GitHub ha rilasciato un toolkit open source apposta (**Spec Kit**, con i comandi
`/specify` e `/plan`) che supporta Claude Code, Copilot e Gemini CLI. Il principio,
come lo scrivono loro: la specifica diventa **la fonte di verità** che gli strumenti
usano per generare, testare e validare il codice — un file che si rivede, si versiona
e si passa a un altro agente o a un collega.

E il motivo per cui conviene farlo anche quando sembra più lento: *scrivere la
specifica costringe a prendere le decisioni, invece di limitarsi a rivedere quelle
prese dall'agente*. Il collo di bottiglia si sposta dall'implementazione alla
definizione del problema — che è esattamente dove deve stare.

Quello che rende buona una specifica, e che in questo file c'è di proposito:

- **fatti misurati, non impressioni** — 1,5 s contro 0,4 s, 16 candidati per immagine,
  30 KB di LQIP inutilizzati: numeri che l'agente può verificare da solo;
- **i vincoli espliciti**, compresa la sezione «cosa NON fare», che vale quanto le
  istruzioni: senza, l'agente prende la strada più ovvia e spesso sbagliata;
- **i criteri di verifica**, cioè come si riconosce che è fatto — con le misure da
  rifare, non con un «funziona»;
- **le trappole già note** (il loader globale che rompe il monogramma, la guardia sul
  LQIP mancante), che sono la parte che un agente non può indovinare.

Una cosa da sistemare quando ce n'è occasione: questi file stanno nella radice del
repo. La convenzione è tenerli in una cartella dedicata (`docs/specs/`), versionati,
e archiviarli quando il lavoro è chiuso — come è già stato fatto con
`docs/archive/`. Un prompt applicato e lasciato in giro, col tempo, diventa
esattamente quel documento che afferma cose non più vere.
