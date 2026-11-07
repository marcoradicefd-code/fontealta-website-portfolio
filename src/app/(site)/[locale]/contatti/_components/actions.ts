"use server";

import { headers } from "next/headers";
import { after } from "next/server";

import type { Locale } from "@/i18n/routing";
import { confermaRichiesta, inviaCatalogo, iscriviNewsletter } from "@/lib/brevo";

import { risolviLingua, risolviSource } from "./derive-source";
import { contactSchema, type SubmitContactResult } from "./schema";

/**
 * Il finto successo di ogni trappola, con UNA riga di log e nessun dato personale.
 *
 * ⚠️ La riga di log è l'unico modo di distinguere un invio vero da uno scartato: le
 * due risposte sono identiche per costruzione (non si tippa un bot), quindi senza log
 * né il browser né un e2e lo vedono. Nei log Vercel si cerca `scartato:`.
 */
function scartato(motivo: "campi-antibot-mancanti" | "honeypot" | "tempo"): SubmitContactResult {
  console.info(`[submitContact] scartato: ${motivo}`);
  return { status: "success" };
}

/**
 * submitContact — Server Action (Next.js 16).
 *
 * 1. Re-valida il payload con lo stesso Zod schema del client (difesa).
 * 2. Anti-spam: `_gotcha` e `_ts` OBBLIGATORI, honeypot `_gotcha` vuoto, timestamp-trap
 *    `_ts` (fake-success, nessun invio, una riga di log senza dati personali).
 * 3. Inoltra a un webhook Zapier (`ZAPIER_CONTACT_WEBHOOK_URL`), SERVER-SIDE ONLY —
 *    l'URL non arriva mai al client. Header shared-secret opzionale.
 *
 * DRY-RUN: se `ZAPIER_CONTACT_WEBHOOK_URL` è assente in DEV → logga e ritorna
 * successo simulato (build/test girano senza segreti). In PRODUZIONE l'assenza del
 * webhook è invece un ERRORE (mai fake-success: il lead non deve perdersi in silenzio).
 *
 * `_gotcha` e `_ts` sono anti-spam interni: MAI inoltrati a Zapier (strip qui sotto).
 * `source` derivato server-side dall'header `referer` (vedi deriveSource).
 *
 * 4. Catalogo (19/10/2026): con `richiesta: "catalogo"`, DOPO il successo di Zapier, l'email
 *    col PDF via Brevo (`inviaCatalogo`). Zapier in errore → errore come sempre, e nessun
 *    invio. Brevo in errore non tocca il lead: l'esito dice solo se mostrare il ripiego.
 * 5. Newsletter (19/10/2026): con la casella spuntata, l'iscrizione su Brevo (`POST /v3/contacts`,
 *    niente doppia conferma) in `after()` di `next/server`, cioè DOPO la risposta, e solo dopo il
 *    successo di Zapier. La risposta è la
 *    stessa con o senza casella e per un indirizzo già iscritto (OWASP): Brevo non la tocca.
 *    `after` e non una promise lasciata senza `await`: su Vercel la funzione può chiudersi alla
 *    risposta, e la chiamata si perderebbe in silenzio; `after` la tiene viva con `waitUntil`.
 * 6. Conferma (20/10/2026): ogni richiesta che NON è il catalogo riceve l'email «Richiesta
 *    ricevuta» via Brevo (`confermaRichiesta`), anche questa in `after()` e solo dopo il successo
 *    di Zapier. Zapier in errore → nessuna email: la richiesta non è arrivata.
 */
export async function submitContact(values: unknown): Promise<SubmitContactResult> {
  const parsed = contactSchema.safeParse(values);

  if (!parsed.success) {
    return { status: "error", message: "validation" };
  }

  const { _gotcha, _ts, lingua: linguaDichiarata, pagina, newsletter, ...clean } = parsed.data;

  // (a) Campi anti-bot OBBLIGATORI (7/10/2026). Fino a quella data le due trappole
  // qui sotto scattavano solo SE il campo c'era: un bot che chiamava la Server Action
  // senza `_gotcha` né `_ts` le saltava tutte e due. Il modulo vero li manda sempre:
  // `_ts` è `mountedAt` di `useContactSubmit`, `_gotcha` arriva dai `defaultValues` ed è
  // registrato da `HoneypotFields`, e la Action parte solo da `handleSubmit`. Lo schema
  // Zod li lascia facoltativi apposta: lì un campo mancante darebbe `error/validation`,
  // cioè un segnale al bot.
  if (_gotcha === undefined || _ts === undefined) {
    return scartato("campi-antibot-mancanti");
  }

  // (b) Honeypot: se il campo esca è compilato → bot. Fake-success, nessun invio
  // (non tippare i bot con un errore).
  if (_gotcha.trim() !== "") {
    return scartato("honeypot");
  }

  // (c) Timestamp-trap: submit < 3s dal mount del form = bot. Solo elapsed POSITIVO
  // (un client con clock avanti darebbe elapsed negativo → allow, niente falsi positivi).
  const elapsed = Date.now() - _ts;
  if (elapsed >= 0 && elapsed < 3000) {
    return scartato("tempo");
  }

  const webhookUrl = process.env.ZAPIER_CONTACT_WEBHOOK_URL;
  const referer = (await headers()).get("referer");
  const source = risolviSource(pagina, referer);
  const lingua = risolviLingua(linguaDichiarata, referer);

  // (c) Prod guard: in produzione senza webhook → ERRORE (mai fake-success). In dev → dry-run.
  if (!webhookUrl) {
    if (process.env.NODE_ENV === "production") {
      console.error("[submitContact] ZAPIER_CONTACT_WEBHOOK_URL mancante in produzione.");
      return { status: "error", message: "config" };
    }
    console.info(
      "[submitContact] DRY-RUN — webhook Zapier non configurato (dev).",
      JSON.stringify({ source }),
    );
    return dopoZapier(clean, newsletter ? { lingua, source } : null);
  }

  // (d) Shared-secret nel BODY (non header): il Catch Hook standard di Zapier non
  // espone gli header HTTP, quindi il segreto va nel payload per essere filtrabile
  // lato Zap. Incluso SOLO se ZAPIER_SHARED_SECRET è set (assente → campo OMESSO,
  // non stringa vuota → no-op).
  const secret = process.env.ZAPIER_SHARED_SECRET;
  // Campi verso Zapier: nome, cognome, email, telefono, azienda, richiesta, note (sempre, "" se
  // vuote, come telefono), paese (alpha-2 maiuscolo, `ZZ` = «Altro Paese»), lingua (minuscola),
  // modello e modelloNome (sempre, "" fuori dalle schede modello), source, timestamp, e `_secret`
  // se configurato. Lo Zap deve mapparli nell'email ad Andrea.
  // `pagina` no: serve solo a calcolare `source` (`risolviSource`), come `_ts` e `_gotcha`.
  // `newsletterRichiesta` («sì»/«no», 19/10/2026): dice che la casella è stata SPUNTATA, non che la
  // persona è iscritta. Iscritti sono solo quelli che confermano dall'email, nelle liste 19-23.
  const payload = {
    ...clean,
    note: clean.note ?? "",
    modello: clean.modello ?? "",
    modelloNome: clean.modelloNome ?? "",
    newsletterRichiesta: newsletter ? "sì" : "no",
    lingua,
    source,
    timestamp: new Date().toISOString(),
    ...(secret ? { _secret: secret } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[submitContact] Zapier webhook non-2xx:", res.status);
      return { status: "error", message: "send" };
    }
  } catch (error) {
    console.error("[submitContact] Zapier webhook failed:", error);
    return { status: "error", message: "send" };
  } finally {
    clearTimeout(timeout);
  }
  return dopoZapier(clean, newsletter ? { lingua, source } : null);
}

/**
 * Il successo, dopo Zapier e mai prima: con la richiesta del catalogo il suo invio (atteso, perché
 * la riga di conferma dipende dal 2xx), con ogni altra richiesta l'email di conferma in `after()`,
 * e con la casella l'iscrizione in `after()`.
 */
async function dopoZapier(
  lead: { richiesta: string; email: string; nome: string; cognome: string; paese: string },
  newsletter: { lingua: Locale; source: string } | null,
): Promise<SubmitContactResult> {
  if (newsletter) {
    // Il momento del consenso è quello dell'invio, non quello in cui `after` gira.
    const consensoAl = new Date().toISOString();
    after(async () => {
      await iscriviNewsletter({ ...lead, ...newsletter, consensoAl });
    });
  }
  if (lead.richiesta !== "catalogo") {
    after(async () => {
      await confermaRichiesta({ email: lead.email, nome: lead.nome, paese: lead.paese });
    });
    return { status: "success" };
  }
  const catalogo = await inviaCatalogo({ email: lead.email, nome: lead.nome, paese: lead.paese });
  return { status: "success", catalogo };
}
