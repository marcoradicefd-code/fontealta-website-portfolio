import type { Locale } from "@/i18n/routing";

import { CATALOGO_URL, TEMPLATE_CATALOGO, linguaDaPaese } from "./catalogo";
import { stripTrailingSlashes } from "./trailing-slashes";

/**
 * Brevo: l'email del catalogo (19/10/2026), l'iscrizione alla newsletter (19/10/2026) e l'email di
 * conferma delle richieste di contatto (20/10/2026).
 *
 * Lo chiama soltanto `submitContact`, sul server: `BREVO_API_KEY` non ha il prefisso
 * `NEXT_PUBLIC_` e nel browser non arriva. La chiave è solo in Production (Q18): sulle
 * anteprime e in sviluppo l'invio non parte, e vale il ripiego col link (Q24).
 *
 * ⚠️ Nei log mai l'email né il nome: una riga `[brevo] …` con lo stato e il `code` di Brevo.
 */

const BREVO_VERO = "https://api.brevo.com/v3";
const HOST_LOCALI = new Set(["localhost", "127.0.0.1"]);

/**
 * Dove mandare la chiamata. `BREVO_API_URL` serve solo al finto Brevo degli e2e, e si accetta
 * solo se l'host è `localhost` o `127.0.0.1`, letto con `new URL` e non con un confronto di
 * stringhe (Q18, Marco): una variabile sbagliata non manda la chiave altrove. In ogni altro
 * caso l'indirizzo vero, e una riga di log.
 */
export function indirizzoBrevo(valore: string | undefined): string {
  if (!valore) return BREVO_VERO;
  try {
    const url = new URL(valore);
    if (HOST_LOCALI.has(url.hostname)) return stripTrailingSlashes(url.href);
  } catch {
    // URL non valido: si ricade sotto.
  }
  console.warn("[brevo] BREVO_API_URL ignorato: host non locale o URL non valido");
  return BREVO_VERO;
}

export type EsitoCatalogo = "inviato" | "ripiego";

/**
 * Il nome va nell'email SOLO se è un nome (19/10/2026, Marco, dopo la revisione di sicurezza):
 * lettere di qualunque alfabeto, spazi, apostrofi, trattini e punti. L'email parte dal nostro
 * mittente verso un indirizzo scelto da chi compila: un «nome» con un link o con altri simboli
 * userebbe Fontealta per far arrivare un testo a qualcun altro. Se non passa, si omette, e il
 * template usa il saluto generico (`{% if params.NOME %}`). Il lead a Zapier resta com'è.
 */
// Una lettera (coi suoi segni combinanti, solo dopo una lettera), poi lettere, spazi, apostrofi,
// trattini e punti. Il punto vale solo seguito da uno spazio o a fine nome, come in «J. R.»: un
// punto seguito da altro è un dominio («www.evil.com», anche con un accento combinante in mezzo).
// Le lettere sono Lu, Ll, Lt e Lo: fuori le «lettere modificatrici» (Lm), fra cui ce ne sono che
// sembrano un punto, come U+A4F8 «ꓸ» («evilꓸcom» sembrerebbe un dominio).
const LETTERA = String.raw`[\p{Lu}\p{Ll}\p{Lt}\p{Lo}]\p{M}*`;
const NOME_SICURO = new RegExp(String.raw`^${LETTERA}(?:${LETTERA}|[ '’-]|\.(?= |$))*$`, "u");

export function nomePerEmail(nome: string): string | undefined {
  // NFKC prima di tutto: le forme di compatibilità (punti e lettere a larghezza piena) diventano
  // quelle normali, e il controllo vede ciò che vedrà chi legge l'email.
  const pulito = nome.normalize("NFKC").trim().replace(/\s+/g, " ");
  return NOME_SICURO.test(pulito) ? pulito : undefined;
}

/**
 * Una chiamata a Brevo: `ok` solo con una risposta 2xx, altrimenti il `code` di Brevo (o `""`).
 * Non lancia mai; un errore lascia una riga `[brevo] errore: <status> <code>` (o `timeout`,
 * `rete`), mai l'email né il nome. `previsto` è un 400 che il chiamante gestisce da sé (il
 * contatto già esistente): quello non è un errore e non va nel log come tale.
 */
async function chiamaBrevo(
  chiave: string,
  percorso: string,
  corpo: unknown,
  previsto?: string,
): Promise<{ ok: boolean; code: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${indirizzoBrevo(process.env.BREVO_API_URL)}${percorso}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "api-key": chiave,
      },
      body: JSON.stringify(corpo),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true, code: "" };
    const code = await res
      .json()
      .then((b: { code?: unknown }) => (typeof b?.code === "string" ? b.code : ""))
      .catch(() => "");
    if (res.status === 400 && previsto && code === previsto) return { ok: false, code };
    // Un 401 con la chiave giusta è anche il blocco degli IP (ricerca del 16/10, D2).
    const nota = res.status === 401 ? " (chiave non valida o IP bloccato)" : "";
    console.error(`[brevo] errore: ${res.status}${code ? ` ${code}` : ""}${nota}`);
    return { ok: false, code };
  } catch (error) {
    const motivo = error instanceof Error && error.name === "AbortError" ? "timeout" : "rete";
    console.error(`[brevo] errore: ${motivo}`);
    return { ok: false, code: "" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Manda l'email del catalogo col template della lingua del Paese. «inviato» SOLO con una
 * risposta 2xx di Brevo (Q23); con un errore, un timeout o la chiave assente «ripiego», e la
 * persona vede il link diretto al PDF (Q7, Q24). Non lancia mai: il lead è già su Zapier.
 */
export async function inviaCatalogo({
  email,
  nome,
  paese,
}: {
  email: string;
  nome: string;
  paese: string;
}): Promise<EsitoCatalogo> {
  const chiave = process.env.BREVO_API_KEY;
  if (!chiave) {
    console.info("[brevo] dry-run: chiave assente");
    return "ripiego";
  }
  const nomeSicuro = nomePerEmail(nome);
  // Senza `sender`: con `templateId` lo prende il template (mittente id 2, reply-to info@).
  const { ok: inviato } = await chiamaBrevo(chiave, "/smtp/email", {
    templateId: TEMPLATE_CATALOGO[linguaDaPaese(paese)],
    to: [nomeSicuro ? { email, name: nomeSicuro } : { email }],
    params: nomeSicuro ? { CATALOGO_URL, NOME: nomeSicuro } : { CATALOGO_URL },
  });
  return inviato ? "inviato" : "ripiego";
}

/** I template transazionali «Richiesta ricevuta», uno per lingua (20/10/2026, Marco). */
export const TEMPLATE_CONFERMA_RICHIESTA = {
  it: 112,
  en: 113,
  de: 114,
  fr: 115,
  es: 116,
} as const satisfies Record<Locale, number>;

/**
 * L'email «Richiesta ricevuta» per chi ha usato un modulo di CONTATTO (20/10/2026, Marco), mai per
 * il catalogo, che ha la sua email. La lingua è quella del Paese, con la stessa funzione del
 * catalogo. Nessun attributo e nessuna lista: è un'email transazionale, non un contatto.
 *
 * Si chiama solo dopo il successo di Zapier (se Zapier fallisce la richiesta non è arrivata, e
 * confermarla sarebbe falso) e dentro `after()`: la risposta del modulo non cambia. Non lancia mai,
 * e non dice niente a nessuno: un errore lascia solo la riga `[brevo] errore: …`.
 *
 * Il nome passa da `nomePerEmail`, come nel catalogo: l'email parte dal nostro mittente verso un
 * indirizzo scelto da chi compila. Senza un nome sicuro, `params` non si manda e il template saluta
 * in modo generico.
 */
export async function confermaRichiesta({
  email,
  nome,
  paese,
}: {
  email: string;
  nome: string;
  paese: string;
}): Promise<void> {
  const chiave = process.env.BREVO_API_KEY;
  if (!chiave) {
    console.info("[brevo] dry-run: chiave assente");
    return;
  }
  const nomeSicuro = nomePerEmail(nome);
  await chiamaBrevo(chiave, "/smtp/email", {
    templateId: TEMPLATE_CONFERMA_RICHIESTA[linguaDaPaese(paese)],
    to: [nomeSicuro ? { email, name: nomeSicuro } : { email }],
    ...(nomeSicuro ? { params: { NOME: nomeSicuro } } : {}),
  });
}

/** Le liste principali della newsletter (19-23), una per lingua. */
export const LISTA_NEWSLETTER = {
  it: 19,
  en: 23,
  de: 21,
  fr: 20,
  es: 22,
} as const satisfies Record<Locale, number>;

/**
 * «Newsletter · Iscritti dal sito» (20/10/2026, Marco): ogni iscrizione dal sito ci entra, accanto
 * alla lista della lingua. Fa da innesco all'email di benvenuto (automazione Brevo #3): nessun
 * codice per quell'email.
 */
export const LISTA_ISCRITTI_SITO = 25;

/**
 * La versione del testo della casella che la persona ha spuntato, scritta in Brevo come
 * `CONSENSO_VERSIONE` (decisione del 16/10). Cambia ogni volta che cambia il testo della casella
 * in `contatti.form.newsletterCasella`: è ciò che dimostra a QUALE testo si è acconsentito.
 */
export const CONSENSO_VERSIONE = "newsletter-2026-10-v1";

/**
 * L'iscrizione alla newsletter (19/10/2026, decisione di Marco: NIENTE doppia conferma, solo la
 * casella), in due passi:
 * 1. `POST /v3/contacts` con `updateEnabled: false`: crea il contatto con gli attributi e lo mette
 *    nella lista della lingua del Paese e in `LISTA_ISCRITTI_SITO` (dal 20/10/2026). Senza Paese,
 *    cioè dal modulo del piè di pagina (`submitNewsletter`, 20/10/2026), la lista è quella della
 *    lingua della pagina, e `PAESE` non si scrive;
 * 2. se esiste già (400 `duplicate_parameter`), `POST /v3/contacts/lists/{id}/contacts/add` con la
 *    SOLA email, una per ciascuna delle due liste: entra nelle liste e i suoi attributi non si toccano. ⚠️ Un invio anonimo non deve
 *    poter riscrivere `NOME`, `PAESE` e soprattutto `GDPR_CONSENT_AT` e `CONSENSO_VERSIONE` di un
 *    contatto che c'era (per esempio dalle fiere): sono le sue prove del consenso. Per lui la prova
 *    di questa iscrizione è la riga del foglio di Zapier (`timestamp` e `newsletterRichiesta`). Si chiama SOLO con la casella spuntata, e
 * dentro `after()` (`submitContact`): la risposta del modulo non dipende mai da qui, quindi non
 * dice se l'indirizzo era già iscritto (OWASP).
 *
 * ⛔ **`emailBlacklisted` non si manda mai**: chi si era disiscritto resta disiscritto finché non
 * lo decide Fontealta a mano. Entra nella lista, ma Brevo non gli scrive.
 *
 * Doc Brevo (19/10/2026): il codice è nell'elenco dei 400 di «Create a contact», e la tabella degli
 * errori lo spiega come «Parameter value already exists»; che sia proprio quello del contatto
 * esistente la doc non lo scrive per esteso, e lo conferma la prova vera. Ogni altro errore va nel
 * log e basta.
 *
 * Attributi del 16/10, solo per il contatto nuovo: `NOME` e, dal 20/10/2026 (Marco), `COGNOME`, tutti e
 * due solo se passano `nomePerEmail` (prima il cognome non si mandava: l'informativa non lo elencava),
 * `PAESE` (se c'è), `LOCALE` (lingua del sito), `SOURCE`
 * (pagina di provenienza, `footer` dal piè di pagina), `GDPR_CONSENT_AT` (data e ora dell'invio) e
 * `CONSENSO_VERSIONE`.
 */
export async function iscriviNewsletter({
  email,
  nome,
  cognome,
  paese,
  lingua,
  source,
  consensoAl,
}: {
  email: string;
  nome: string;
  cognome: string;
  /** Assente dal modulo del piè di pagina: lì la lista la dà la lingua della pagina. */
  paese?: string;
  lingua: Locale;
  source: string;
  consensoAl: string;
}): Promise<void> {
  const chiave = process.env.BREVO_API_KEY;
  if (!chiave) {
    console.info("[brevo] dry-run: chiave assente");
    return;
  }
  const nomeSicuro = nomePerEmail(nome);
  const cognomeSicuro = nomePerEmail(cognome);
  const liste = [LISTA_NEWSLETTER[paese ? linguaDaPaese(paese) : lingua], LISTA_ISCRITTI_SITO];
  const creato = await chiamaBrevo(
    chiave,
    "/contacts",
    {
      email,
      listIds: liste,
      updateEnabled: false,
      attributes: {
        ...(nomeSicuro ? { NOME: nomeSicuro } : {}),
        ...(cognomeSicuro ? { COGNOME: cognomeSicuro } : {}),
        ...(paese ? { PAESE: paese } : {}),
        LOCALE: lingua,
        SOURCE: source,
        GDPR_CONSENT_AT: consensoAl,
        CONSENSO_VERSIONE,
      },
    },
    "duplicate_parameter",
  );
  if (creato.ok || creato.code !== "duplicate_parameter") return;
  console.info("[brevo] contatto già presente: solo le liste");
  // Una chiamata per lista: se è già in una delle due, l'altra entra lo stesso.
  for (const lista of liste) {
    await chiamaBrevo(chiave, `/contacts/lists/${lista}/contacts/add`, { emails: [email] });
  }
}
