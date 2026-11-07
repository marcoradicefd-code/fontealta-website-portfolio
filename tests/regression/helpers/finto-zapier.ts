/** Indirizzo del finto webhook Zapier (`finto-zapier.mjs`), condiviso da config e spec. */
export const FINTO_ZAPIER = "http://127.0.0.1:3999";

/** Quel che il finto Zapier ha ricevuto finora, nell'ordine di arrivo. */
export async function ricevutiDaZapier(): Promise<Array<Record<string, unknown>>> {
  const r = await fetch(`${FINTO_ZAPIER}/ricevuti`);
  return (await r.json()) as Array<Record<string, unknown>>;
}

/** Indirizzo del finto Brevo (`finto-brevo.mjs`, 19/10/2026), condiviso da config e spec. */
export const FINTO_BREVO = "http://127.0.0.1:3998";

/** Gli invii transazionali che il finto Brevo ha ricevuto finora, nell'ordine di arrivo. */
export async function ricevutiDaBrevo(): Promise<
  Array<{
    templateId?: number;
    to?: Array<{ email: string; name?: string }>;
    params?: Record<string, string>;
    conChiave: boolean;
  }>
> {
  const r = await fetch(`${FINTO_BREVO}/ricevuti`);
  return (await r.json()) as never;
}

/** Le iscrizioni alla newsletter (`POST /contacts`) che il finto Brevo ha ricevuto, in ordine. */
export async function contattiDaBrevo(): Promise<
  Array<{
    email?: string;
    listIds?: number[];
    updateEnabled?: boolean;
    attributes?: Record<string, string>;
    conChiave: boolean;
    [altro: string]: unknown;
  }>
> {
  const r = await fetch(`${FINTO_BREVO}/contatti`);
  return (await r.json()) as never;
}

/** Le aggiunte alle sole liste (`POST /contacts/lists/{id}/contacts/add`) ricevute dal finto Brevo. */
export async function aggiunteAListaDaBrevo(): Promise<
  Array<{ listId: number; corpo: Record<string, unknown>; conChiave: boolean }>
> {
  const r = await fetch(`${FINTO_BREVO}/aggiunte`);
  return (await r.json()) as never;
}
