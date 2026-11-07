import { ACTIVE_LOCALES, type ActiveLocale, type Locale } from "@/i18n/routing";
import {
  AZIENDA_FAX,
  AZIENDA_FONDAZIONE,
  AZIENDA_LOGO,
  AZIENDA_NOME,
  AZIENDA_PIVA,
  AZIENDA_RAGIONE_SOCIALE,
  AZIENDA_SEDE,
} from "@/lib/azienda";
import { siteUrl } from "@/lib/seo";
import { absoluteUrl } from "@/lib/urls";

/**
 * I nodi JSON-LD del sito: `Organization` e `WebSite`.
 *
 * ⚠️ **Un JSON-LD sbagliato non si vede.** Non rompe una pagina, non fa cadere un
 * build, non cambia un pixel: si vede in Search Console mesi dopo, o non si vede
 * affatto e semplicemente non produce nulla. Per questo i costruttori sono
 * **puri** e testati, e per questo qui non entra un valore che non sia
 * confermato.
 */

/** L'`@id` del nodo azienda. Serve perché `WebSite` e `Article` possano dire
 *  «l'editore è QUELLO», invece di ripetere un'organizzazione che poi diverge. */
export const ORGANIZATION_ID = () => `${siteUrl()}#organization`;

/**
 * L'indirizzo postale, uno solo, usato da `Organization` e da `LocalBusiness`.
 *
 * ⚠️ **Scritto una volta e riusato**, perché è un NAP: due copie che divergono
 * sono esattamente il difetto che rende un dato strutturato locale peggio della
 * sua assenza. `addressCountry` è il codice ISO a due lettere, non «Italia»:
 * schema.org vuole quello, e i consumatori che lo leggono si aspettano `IT`.
 */
function postalAddress() {
  return {
    "@type": "PostalAddress" as const,
    streetAddress: AZIENDA_SEDE.via,
    postalCode: AZIENDA_SEDE.cap,
    addressLocality: AZIENDA_SEDE.comune,
    addressRegion: AZIENDA_SEDE.provincia,
    addressCountry: AZIENDA_SEDE.paese,
  };
}

function logoImageObject() {
  return {
    "@type": "ImageObject" as const,
    url: `${siteUrl()}${AZIENDA_LOGO.path}`,
    width: AZIENDA_LOGO.width,
    height: AZIENDA_LOGO.height,
  };
}

/**
 * Gli argomenti su cui l'azienda è competente, per `knowsAbout`.
 *
 * ⚠️ **Ognuna di queste voci è una cosa che le pagine dicono già**: l'acciaio
 * AISI 316 e le colonne doccia indoor e outdoor stanno nella riga d'identità
 * della home, il bagno nella description di `/collezioni`, la cucina è la
 * collezione Kitchen, il giardino è la collezione Spring, la verniciatura
 * RAL/Pantone/NCS e le finiture PVD hanno una pagina loro, la nautica è una
 * collezione. ⚠️ **Le voci della cucina e del giardino sono il termine del title
 * di `/collezioni/kitchen` e `/collezioni/spring`** (`collezioni.tipoBreve.cucina`
 * e `.giardino`), scritti uguali apposta: `knowsAbout` e catalogo dicono la
 * stessa parola (decisione di Marco, 25/09/2026), e `json-ld.test.ts` lo tiene
 * fermo. ⚠️ Il giardino c'era prima della #226 («Rubinetteria per esterni» lo
 * copriva) ed era uscito senza sostituto: è tornato con la #231, subito
 * dopo la cucina. Non è un elenco di parole chiave: un `knowsAbout`
 * che dichiara competenze che il sito non mostra è la stessa specie di
 * affermazione non verificabile di un `jobTitle` che non compare da nessuna
 * parte, ed è la ragione per cui qui non entra niente di aspirazionale.
 *
 * ⚠️ **`Record<Locale, …>`: tutte e cinque le lingue, anche spente**, per la stessa
 * ragione del `DIZIONARIO` di `llms.txt`: il typecheck vuole ogni lingua, e accenderne una
 * non tocca questa tabella. Le voci DE/FR/ES usano il lessico dei dizionari (#190)
 * e vanno rilette insieme a loro.
 */
export const KNOWS_ABOUT: Record<Locale, readonly string[]> = {
  it: [
    "Acciaio inox AISI 316",
    "Colonne doccia indoor e outdoor",
    "Rubinetteria per il bagno",
    "Rubinetti cucina",
    "Rubinetti giardino",
    "Rubinetteria nautica",
    "Verniciatura RAL, Pantone e NCS",
    "Finiture PVD",
  ],
  en: [
    "AISI 316 stainless steel",
    "Indoor and outdoor shower columns",
    "Bathroom taps and fittings",
    "Kitchen mixers",
    "Garden taps",
    "Marine taps and fittings",
    "RAL, Pantone and NCS coating",
    "PVD finishes",
  ],
  de: [
    "Edelstahl AISI 316",
    "Duschsäulen für innen und außen",
    "Badarmaturen",
    "Küchenarmaturen",
    "Gartenarmaturen",
    "Bootsarmaturen",
    "Lackierung in RAL, Pantone und NCS",
    "PVD-Oberflächen",
  ],
  fr: [
    "Acier inox AISI 316",
    "Colonnes de douche indoor et outdoor",
    "Robinetterie de salle de bains",
    "Robinets cuisine",
    "Robinets jardin",
    "Robinetterie nautique",
    "Laquage RAL, Pantone et NCS",
    "Finitions PVD",
  ],
  es: [
    "Acero inoxidable AISI 316",
    "Columnas de ducha de interior y exterior",
    "Grifería de baño",
    "Grifos de cocina",
    "Grifos de jardín",
    "Grifería náutica",
    "Lacado RAL, Pantone y NCS",
    "Acabados PVD",
  ],
};

/**
 * `Organization`.
 *
 * ⚠️ **`legalName`, `address`, `vatID` e `faxNumber` sono arrivati il
 * 10/09/2026**, dopo la conferma di Marco incrociando il sito ufficiale e il
 * LinkedIn aziendale. Prima non c'erano perché la ragione sociale sul sito e
 * quella del listino non coincidevano e la P.IVA era un segnaposto: un NAP
 * sbagliato fa più danno di nessun NAP, e questa è la ragione per cui anche
 * `LocalBusiness` è comparso solo ora, su `/contatti`.
 *
 * ⚠️ **`name` resta il MARCHIO e `legalName` il soggetto giuridico**, che è la
 * distinzione che schema.org fa e che qui conta: il sito si presenta come
 * «Fontealta», la fattura la emette «Rubinetteria F & F L’Artigiana S.r.l.».
 * Metterne uno al posto dell'altro renderebbe il sito irriconoscibile o la
 * dichiarazione legale falsa.
 *
 * ⚠️ **`sameAs` esce solo se `siteSettings.socialLinks` ha davvero qualcosa
 * dentro.** Al 9/09/2026 quel campo è vuoto e il footer non linka nessun
 * profilo, quindi la chiave non compare: un `sameAs` verso un profilo inventato
 * o verso un account non nostro è un'affermazione di identità falsa, che è
 * esattamente ciò che quel campo serve a dichiarare. Il giorno che Andrea
 * incolla i profili in Studio, `sameAs` compare senza un commit.
 *
 * `telefono` ed `email` arrivano dai parametri e non dalle costanti, così il
 * giorno che `siteSettings` verrà popolato la sorgente cambia in un posto solo,
 * come già fa il footer.
 */
/**
 * L'ordine in cui i profili escono in `sameAs`.
 *
 * ⚠️ **Fisso e scritto qui, non l'ordine delle chiavi dell'oggetto.** GROQ
 * restituisce `socialLinks` con le chiavi nell'ordine in cui Sanity le ha
 * salvate, che dipende da come sono state compilate: due documenti identici
 * potrebbero produrre due JSON-LD diversi, e un dato strutturato che cambia
 * forma senza che il contenuto cambi è rumore per chi lo consuma.
 */
const PROFILI_SOCIAL = ["instagram", "linkedin", "pinterest", "youtube"] as const;

export type SocialLinks = Partial<Record<(typeof PROFILI_SOCIAL)[number], string | null>> | null;

/**
 * I profili da dichiarare come `sameAs`, in ordine fisso e senza i vuoti.
 *
 * ⚠️ **Solo `https://`.** Un profilo social su `http` non esiste più da anni: un
 * valore che non comincia così è un errore di battitura o un incolla parziale, e
 * dichiararlo manderebbe Google su un URL che non risponde. Meglio nessun
 * `sameAs` che uno sbagliato, perché quel campo afferma un'identità.
 */
export function sameAsDaSocial(social: SocialLinks): string[] {
  if (!social) return [];
  return PROFILI_SOCIAL.map((chiave) => social[chiave])
    .filter((url): url is string => typeof url === "string" && url.trim().startsWith("https://"))
    .map((url) => url.trim());
}

export function organizationJsonLd({
  telefono,
  email,
  social = null,
  description,
  knowsAbout,
}: {
  telefono: string;
  email: string;
  social?: SocialLinks;
  /**
   * La riga d'identità dell'azienda, nella lingua della pagina. Arriva dai
   * messaggi (`home.metaDescription`), che è la STESSA sorgente della riga `>`
   * di `llms.txt`: il giorno che G7 porta la frase approvata si cambia lì e
   * cambiano tutte e due, invece di scoprire fra sei mesi che il sito si
   * descrive in due modi a seconda di chi lo legge.
   */
  description?: string | null;
  knowsAbout?: readonly string[];
}) {
  const sameAs = sameAsDaSocial(social);
  return {
    "@type": "Organization" as const,
    "@id": ORGANIZATION_ID(),
    name: AZIENDA_NOME,
    legalName: AZIENDA_RAGIONE_SOCIALE,
    vatID: AZIENDA_PIVA,
    // Solo l'anno: il mese non lo sappiamo, e `schema.org` accetta `YYYY`.
    // Inventare un giorno per far contento un formato sarebbe un dato falso.
    foundingDate: AZIENDA_FONDAZIONE,
    url: siteUrl(),
    // Chiave assente se la frase non c'è, come per `sameAs`: una `description`
    // vuota dichiara che l'azienda non ha una descrizione, che è diverso dal non
    // dire niente.
    ...(description?.trim() ? { description: description.trim() } : {}),
    // `Set` e non l'array così com'è: un duplicato in `knowsAbout` non rompe
    // niente e non si vede, ma dice a chi lo consuma che sappiamo due volte la
    // stessa cosa. L'ordine resta quello dichiarato.
    ...(knowsAbout && knowsAbout.length > 0 ? { knowsAbout: [...new Set(knowsAbout)] } : {}),
    logo: logoImageObject(),
    address: postalAddress(),
    faxNumber: AZIENDA_FAX,
    // Chiave assente e non array vuoto: un `sameAs: []` dichiara «non ho
    // profili», che è diverso da non dire niente.
    ...(sameAs.length > 0 ? { sameAs } : {}),
    contactPoint: [
      {
        "@type": "ContactPoint" as const,
        contactType: "customer service",
        telephone: telefono,
        email,
        // Le lingue in cui rispondiamo davvero sono quelle in cui il sito esiste.
        // Derivate, non elencate: quando DE si accende compare da sola.
        availableLanguage: [...ACTIVE_LOCALES],
      },
    ],
  };
}

/** L'`@id` del nodo `WebSite` di una lingua. Esportato perché `CollectionPage`
 *  ci si aggancia con `isPartOf`: scritto in due posti, il giorno che la forma
 *  cambia uno dei due riferimenti punterebbe a un nodo che non esiste, e un
 *  `@id` che non risolve è silenzioso esattamente come tutto il resto qui. */
export const WEBSITE_ID = (locale: ActiveLocale) => `${absoluteUrl(locale, "/")}#website`;

/**
 * `WebSite`, uno per locale.
 *
 * `url` è la home **di quella lingua** (`/` in italiano, `/en` in inglese) e
 * `inLanguage` la dichiara: è la stessa coppia che canonical e hreflang già
 * affermano, detta a un consumatore diverso. Niente `SearchAction`: il sito non
 * ha una ricerca interna, e dichiararla manderebbe Google su un endpoint che non
 * esiste.
 */
export function webSiteJsonLd(locale: ActiveLocale) {
  return {
    "@type": "WebSite" as const,
    "@id": WEBSITE_ID(locale),
    name: AZIENDA_NOME,
    url: absoluteUrl(locale, "/"),
    inLanguage: locale,
    publisher: { "@id": ORGANIZATION_ID() },
  };
}

/**
 * L'editore per l'`Article`, con il logo **inline** e non per riferimento.
 *
 * Il riferimento `@id` funziona fra nodi della stessa pagina, ma le linee guida
 * di Google per l'Article chiedono `publisher.logo` esplicito, e i validatori
 * che non risolvono i riferimenti lo segnalerebbero mancante. Costa la
 * ripetizione del logo su una pagina su dodici: accettabile per non dipendere da
 * come un validatore risolve i riferimenti.
 */
export function publisherJsonLd() {
  return {
    "@type": "Organization" as const,
    "@id": ORGANIZATION_ID(),
    name: AZIENDA_NOME,
    logo: logoImageObject(),
  };
}

/**
 * I due nodi del sito in un grafo solo: un `@context`, uno `<script>`.
 *
 * ⚠️ **Da qui in avanti l'`Organization` DIPENDE DALLA LINGUA**, in due chiavi
 * e due sole: `description` e `knowsAbout`. È il motivo per cui `knowsAbout` si
 * prende qui, dove il locale c'è, invece di farlo scegliere al chiamante: un
 * elenco passato a mano è un elenco che prima o poi arriva nella lingua
 * sbagliata. La guardia dei campioni lo verifica al contrario, cioè che fra IT
 * ed EN NON cambi nient'altro.
 */
export function siteGraphJsonLd(
  locale: ActiveLocale,
  contatti: { telefono: string; email: string; social?: SocialLinks; description?: string | null },
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd({ ...contatti, knowsAbout: KNOWS_ABOUT[locale] }),
      webSiteJsonLd(locale),
    ],
  };
}

/**
 * La serializzazione per un tag `<script type="application/ld+json">`.
 *
 * ⚠️ L'escape di `<` non è cosmesi: i nomi arrivano da Sanity, e un titolo che
 * contenesse `</script>` chiuderebbe il tag e trasformerebbe il resto del JSON in
 * markup. Resta JSON valido. È lo stesso escape del breadcrumb e dell'articolo,
 * ed è qui perché fosse scritto una volta sola.
 */
export function serializzaJsonLd(ld: unknown): string {
  return JSON.stringify(ld).replaceAll("<", "\\u003c");
}

/**
 * `FAQPage`, dalle STESSE domande che l'accordion mostra (spec FAQ § 3, decisione G di Marco).
 *
 * ⚠️ Chi chiama passa la lista già filtrata dalla query (solo le domande con risposta, nella
 * lingua della pagina) e la stessa che rende i bottoni: due liste prima o poi direbbero due
 * cose diverse. Lista vuota → `null`, e nessuno `<script>`: un `FAQPage` senza domande dichiara
 * una pagina di FAQ che non c'è. Non promette risultati arricchiti: Google non li mostra più
 * dal 7/05/2026.
 */
export function faqPageJsonLd(items: readonly { question: string; answer: string }[]) {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: items.map((item) => ({
      "@type": "Question" as const,
      name: item.question,
      acceptedAnswer: { "@type": "Answer" as const, text: item.answer },
    })),
  };
}

/**
 * `dateModified` di un articolo del blog (Marco, 5/11/2026 sera): la data di revisione EDITORIALE
 * (`revisedAt`, «Aggiornato il» in pagina) se c'è, altrimenti la data di pubblicazione.
 *
 * ⚠️ **Mai `_updatedAt`**: si muove a ogni scrittura, anche tecnica (un link aggiunto da `post:link`,
 * la data corretta il 5/11), e diceva a Google che l'articolo era stato modificato quando non lo era.
 * Revoca la regola della Q10 del 5/11 mattina («senza `revisedAt`, `_updatedAt`, mai `publishedAt`»).
 * Un articolo mai rivisto ha la modifica uguale alla pubblicazione, ed è vero.
 */
export function dataModificaArticolo(post: {
  revisedAt?: string | null;
  publishedAt?: string | null;
}): string | undefined {
  return post.revisedAt || post.publishedAt || undefined;
}

/**
 * `WebPage` di una pagina di contenuto (spec `docs/specs/seo-pagine-contenuto.md` § 5, c1b).
 *
 * ⚠️ **Solo ciò che la pagina dice**: `name` è l'H1, `description` la meta description della
 * stessa pagina, e un e2e li confronta col servito. `isPartOf` e `publisher` puntano per `@id` agli
 * stessi nodi del grafo del layout, così il `WebSite` e l'`Organization` non si ripetono e non
 * possono divergere.
 *
 * ⚠️ **Senza `dateModified`** (Marco, grill del 3/11, Q6): l'`_updatedAt` di Sanity cambia a ogni
 * scrittura di metadati o di FAQ, e dichiararlo direbbe una revisione che non c'è stata; la
 * freschezza la dice il `lastmod` della sitemap.
 */
export function webPageJsonLd({
  locale,
  url,
  name,
  description,
}: {
  locale: ActiveLocale;
  url: string;
  name: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage" as const,
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: locale,
    isPartOf: { "@id": WEBSITE_ID(locale) },
    publisher: { "@id": ORGANIZATION_ID() },
  };
}

/** L'`@id` del nodo sede, distinto da quello dell'azienda: sono due cose, e un
 *  `@id` condiviso le farebbe collassare in una sola per chi le consuma. */
export const LOCAL_BUSINESS_ID = () => `${siteUrl()}#sede`;

/**
 * `LocalBusiness`, la sede di Viareggio. Una sola pagina lo dichiara,
 * `/contatti`, che è l'unica dove quel dato è il contenuto.
 *
 * ⚠️ **Senza `openingHours`, e non per dimenticanza.** Non li sappiamo, e un
 * orario dichiarato e sbagliato manda qualcuno davanti a una porta chiusa: è il
 * danno tipico di questo tipo di dato, peggiore della sua assenza. Si aggiungono
 * quando Andrea li conferma, come è successo per il NAP.
 *
 * ⚠️ **Niente `geo` né `priceRange`**: le coordinate non le abbiamo misurate e
 * la fascia di prezzo è un'affermazione commerciale che nessuno ha approvato.
 *
 * `parentOrganization` lega la sede all'azienda per `@id`, così i due nodi non
 * ripetono l'identità e non possono divergere.
 */
export function localBusinessJsonLd({ telefono, email }: { telefono: string; email: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness" as const,
    "@id": LOCAL_BUSINESS_ID(),
    name: AZIENDA_NOME,
    legalName: AZIENDA_RAGIONE_SOCIALE,
    vatID: AZIENDA_PIVA,
    url: absoluteUrl("it", "/contatti"),
    address: postalAddress(),
    telephone: telefono,
    // ⚠️ Niente `faxNumber` qui (19/10/2026, Marco): la pagina contatti non lo mostra, e
    // un dato strutturato deve dire ciò che la pagina dice. Resta nell'`Organization`.
    email,
    image: logoImageObject(),
    parentOrganization: { "@id": ORGANIZATION_ID() },
  };
}

/**
 * Chi firma un articolo: la persona, oppure l'azienda.
 *
 * ⚠️ **Mai un nome di comodo.** Un `Article` senza `author` è un articolo che
 * nessuno firma, e va evitato; ma inventare una `Person` che si chiama come
 * l'azienda è peggio, perché dichiara ai motori che esiste una persona con quel
 * nome. Quando il post non ha un autore, chi firma è l'`Organization`, riferita
 * per `@id` invece che ripetuta: è lo stesso nodo del layout, non una copia.
 *
 * ⚠️ **Sta qui e non nella pagina** perché è la stessa scelta di
 * `organizationJsonLd` e `publisherJsonLd`: i costruttori di dato strutturato
 * sono puri e testati, e un JSON-LD sbagliato non si vede. La prima stesura di
 * questa logica era dentro il render della pagina, dove un test non la
 * raggiungeva.
 *
 * ⚠️ **`sameAs` solo `https://`**, come per l'azienda: quel campo afferma
 * un'identità, e un URL incollato a metà manderebbe chi lo consuma su una
 * pagina che non risponde.
 */
export function autoreArticoloJsonLd(
  autore: { name?: string | null; role?: unknown; linkedin?: string | null } | null | undefined,
  urlPersona: string,
) {
  const nome = typeof autore?.name === "string" ? autore.name.trim() : "";
  if (!nome) return { "@id": ORGANIZATION_ID() };

  const ruolo = typeof autore?.role === "string" ? autore.role.trim() : "";
  const linkedin =
    typeof autore?.linkedin === "string" && autore.linkedin.trim().startsWith("https://")
      ? autore.linkedin.trim()
      : null;

  return {
    "@type": "Person" as const,
    name: nome,
    ...(ruolo ? { jobTitle: ruolo } : {}),
    // `Person.url` deve indicare una pagina che parla di quella persona, e
    // `/chi-siamo` la nomina. Il giorno che nascerà `/autori/[slug]`, lo slug è
    // già nello schema e il chiamante cambia una riga.
    url: urlPersona,
    ...(linkedin ? { sameAs: [linkedin] } : {}),
  };
}
