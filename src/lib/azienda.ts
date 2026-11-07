/**
 * I dati dell'azienda che il sito conosce per certo.
 *
 * ⚠️ **Erano costanti dentro `footer.tsx`**, dove servivano come riserva finché
 * `siteSettings.{address,email,phone}` non fosse popolato. Al 9/09/2026 quei tre
 * campi su Sanity sono ancora **vuoti**, quindi non sono una riserva: sono i
 * valori che il sito serve davvero. Il JSON-LD ha bisogno degli stessi, e due
 * copie dello stesso numero di telefono sono due occasioni per divergere.
 *
 * ⚠️ **Ragione sociale, P.IVA e fax sono arrivati il 10/09/2026, e prima non
 * c'erano per una ragione precisa.** Il sito diceva «Fontealta S.r.l.», il
 * listino «Rubinetteria F&F L'Artigiana srl», la P.IVA nei testi legali era fra
 * parentesi quadre e il civico non era confermato: finché un NAP non è certo non
 * entra nel dato strutturato, perché un NAP sbagliato fa più danno di nessun NAP.
 * Ora le tre cose sono confermate da Marco, incrociando il sito ufficiale
 * `fontealta.it` e il LinkedIn aziendale, e questo file diventa la **sorgente
 * unica**: footer, testi legali, `Organization` e `LocalBusiness` leggono da qui.
 *
 * ⚠️ **`siteSettings.companyName` su Sanity NON è più la fonte della ragione
 * sociale**, ed è deliberato: al 10/09/2026 quel campo vale ancora «Fontealta
 * S.r.l.», cioè il nome sbagliato, ed era quello che la pagina contatti serviva
 * davvero (il fallback nei messaggi non scattava mai, perché il campo non è
 * vuoto). Due sorgenti per la stessa dichiarazione di identità sono due occasioni
 * di divergere, e quella su Sanity non ha una guardia che la controlli. Va
 * corretta o svuotata in Studio: finché non lo è, il codice non la legge.
 */

/** Il nome del MARCHIO: quello che si legge sulle pagine, nei metadata e come
 *  `name` del dato strutturato. Resta «Fontealta» ovunque il sito parli al
 *  visitatore; la ragione sociale sta accanto, non al suo posto. */
export const AZIENDA_NOME = "Fontealta";

/** La ragione sociale, cioè il soggetto giuridico. Va in `legalName`, nei testi
 *  legali come titolare del trattamento e nella riga legale del footer.
 *  ⚠️ Scritta come in visura, «F & F» con gli spazi, e con l'apostrofo tipografico
 *  (26/10/2026, Marco; prima «F&F» e l'apostrofo dritto). */
export const AZIENDA_RAGIONE_SOCIALE = "Rubinetteria F & F L’Artigiana S.r.l.";

/** La partita IVA, nella forma con il prefisso paese che `vatID` di schema.org
 *  si aspetta e che si usa anche nelle scritture legali italiane. */
export const AZIENDA_PIVA = "IT01718720467";

/** Il codice fiscale, che è anche il numero d'iscrizione al Registro delle Imprese:
 *  la P.IVA senza il prefisso del Paese. */
export const AZIENDA_CODICE_FISCALE = AZIENDA_PIVA.slice(2);

/** Gli estremi dell'art. 2250 c.c. (26/10/2026, dalla visura, testi approvati da Matteo):
 *  la REA con la sigla della provincia e il capitale come si scrive in Italia, anche
 *  nelle pagine in altre lingue. «i.v.» o «interamente versato» lo aggiunge chi lo mostra. */
export const AZIENDA_REA = "LU-166066";
export const AZIENDA_CAPITALE = "10.400,00 €";
export const AZIENDA_PEC = "fontealta_lartigiana@pec.it";

/** La certificazione del sistema di gestione per la qualità. ⚠️ Il numero è
 *  Q/00802/24: «Q/0802/24», che compare in un documento, è un refuso. La scadenza è
 *  una data ISO, che la pagina formatta nella lingua di chi legge. */
export const AZIENDA_ISO_9001 = {
  norma: "ISO 9001:2015",
  numero: "Q/00802/24",
  ente: "Q gest",
  settoreIaf: "17",
  scadenza: "2027-06-11",
} as const;

/**
 * I documenti scaricabili, su Cloudflare R2 come il catalogo (`CATALOGO_URL`).
 * Nomi senza anno: Cloudflare li serve DYNAMIC, non in cache, quindi un file nuovo
 * con lo stesso nome si vede subito (Marco, 26/10/2026). La politica per la qualità
 * esiste in italiano e in inglese: l'inglese vale per en, de, fr ed es.
 */
export const AZIENDA_DOCUMENTI = {
  certificatoIso9001:
    "https://media.fontealta.it/documenti/certificazioni/fontealta-certificato-iso-9001-2015.pdf",
  politicaQualita: {
    it: "https://media.fontealta.it/documenti/qualita/fontealta-politica-qualita-it.pdf",
    en: "https://media.fontealta.it/documenti/qualita/fontealta-quality-policy-en.pdf",
  },
} as const;

/** L'anno di fondazione, per `foundingDate`. Solo l'anno: il mese non lo
 *  sappiamo, e inventarlo per far contento un formato sarebbe un dato falso. */
export const AZIENDA_FONDAZIONE = "1999";

export const AZIENDA_EMAIL = "info@fontealta.it";
export const AZIENDA_TELEFONO = "+39 0584 969041";
export const AZIENDA_FAX = "+39 0584 361206";

/** Le due righe della sede, per il footer e per i testi legali. */
export const AZIENDA_INDIRIZZO = ["Via Libeccio 13/15", "55049 Viareggio (LU), Italia"] as const;

/**
 * La sede scomposta, per il `PostalAddress` del dato strutturato.
 *
 * ⚠️ **Le stesse due righe di `AZIENDA_INDIRIZZO`, spezzate**, e non un secondo
 * indirizzo: schema.org vuole i pezzi separati, il footer vuole le righe. Se un
 * giorno cambiasse la sede, entrambe vanno toccate, e il test sul servito
 * confronta ciò che esce nei due posti proprio per accorgersene.
 *
 * ⚠️ **Il civico è 13/15**, non il 48/c che compare sulla vecchia pagina contatti
 * di `fontealta.it`: quello è l'indirizzo precedente, e resta a registro.
 */
export const AZIENDA_SEDE = {
  via: "Via Libeccio 13/15",
  cap: "55049",
  comune: "Viareggio",
  provincia: "LU",
  paese: "IT",
} as const;

/** Il monogramma, lo stesso file che il footer disegna. Le misure sono quelle
 *  native, lette dal PNG: servono all'`ImageObject` del JSON-LD, dove una
 *  dimensione dichiarata sbagliata è peggio di una non dichiarata. */
export const AZIENDA_LOGO = {
  path: "/brand/fontealta-monogram-gray.png",
  width: 1146,
  height: 1241,
} as const;
