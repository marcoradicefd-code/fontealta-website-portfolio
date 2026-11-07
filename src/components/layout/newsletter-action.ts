"use server";

import { headers } from "next/headers";
import { after } from "next/server";

import { risolviLingua } from "@/app/(site)/[locale]/contatti/_components/derive-source";
import { iscriviNewsletter } from "@/lib/brevo";
// Da `@/lib/zod` e non da `"zod"`: lì Zod è configurato senza la sonda `new Function` (CSP).
import { z } from "@/lib/zod";

/**
 * Il modulo della newsletter nel piè di pagina (20/10/2026, Marco). Campi e regole sono quelli
 * della casella dei moduli di contatto, senza Paese: la lista è quella della lingua della PAGINA.
 *
 * - `consenso` deve essere `true`: qui la casella è obbligatoria, perché è l'unico scopo del modulo.
 * - `nome` e `cognome` obbligatori (Marco, 20/10/2026); arrivano a Brevo solo se passano
 *   `nomePerEmail`, e solo per un contatto nuovo.
 * - `lingua` la dichiara il client (`useLocale`), come nei moduli di contatto: un valore che non è
 *   una lingua ripiega sul referer, e poi sull'italiano (`risolviLingua`).
 * - `_gotcha` e `_ts` come in `submitContact`: obbligatori, e con una trappola scattata un finto
 *   successo e una riga di log senza dati personali.
 */
const newsletterSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  cognome: z.string().trim().min(1).max(80),
  email: z.email().max(120),
  consenso: z.literal(true),
  lingua: z.string().max(10).optional().catch(undefined),
  _gotcha: z.string().max(200).optional(),
  _ts: z.number().optional(),
});

export type SubmitNewsletterResult = { status: "success" } | { status: "error"; message: string };

function scartato(motivo: "campi-antibot-mancanti" | "honeypot" | "tempo"): SubmitNewsletterResult {
  console.info(`[submitNewsletter] scartato: ${motivo}`);
  return { status: "success" };
}

/**
 * submitNewsletter — Server Action del piè di pagina. ⚠️ Il NOME è quello che il firewall di Vercel
 * usa nella regola di rate limit (Server Action Name, come `submitContact`): rinominarla toglie la
 * regola senza che nessun test se ne accorga.
 *
 * NON va a Zapier e NON manda l'email «Richiesta ricevuta»: è solo l'iscrizione, con le regole di
 * `iscriviNewsletter` (niente doppia conferma, `updateEnabled: false`, contatto già presente → le
 * due liste con la sola email, mai `emailBlacklisted`), dentro `after()`. La risposta è la stessa per
 * un indirizzo nuovo, già iscritto o con Brevo giù: il modulo non dice mai chi è già iscritto.
 */
export async function submitNewsletter(values: unknown): Promise<SubmitNewsletterResult> {
  const parsed = newsletterSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "validation" };

  const { _gotcha, _ts, lingua: linguaDichiarata, nome, cognome, email } = parsed.data;
  if (_gotcha === undefined || _ts === undefined) return scartato("campi-antibot-mancanti");
  if (_gotcha.trim() !== "") return scartato("honeypot");
  const elapsed = Date.now() - _ts;
  if (elapsed >= 0 && elapsed < 3000) return scartato("tempo");

  const lingua = risolviLingua(linguaDichiarata, (await headers()).get("referer"));
  // Il momento del consenso è quello dell'invio, non quello in cui `after` gira.
  const consensoAl = new Date().toISOString();
  after(async () => {
    await iscriviNewsletter({ email, nome, cognome, lingua, source: "footer", consensoAl });
  });
  return { status: "success" };
}
