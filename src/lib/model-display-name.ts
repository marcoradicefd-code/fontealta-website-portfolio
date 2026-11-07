import type { ActiveLocale, Locale } from "@/i18n/routing";

/**
 * Il nome del modello come lo vede l'utente: la variante nella lingua richiesta,
 * poi l'italiano, poi il codice.
 *
 * Estratta perché la stessa catena era già scritta DUE volte — in
 * `modello/[slug]/page.tsx` dentro `generateMetadata` e in `model-hero.tsx` per
 * l'H1 — e il breadcrumb ne sarebbe stata la terza. Tre copie di un fallback che
 * decide un titolo sono tre occasioni perché la scheda e il suo `<title>` finiscano
 * per dire due cose diverse.
 *
 * ⚠️ **Questa riga diceva che il cast `as unknown as { it?, en? }` è «il pattern
 * M6 del progetto», e non è più vero** (verificato il 10/09/2026 togliendo i due
 * cast in `model-card.tsx` e passando il typecheck). TypeGen **genera** il tipo
 * giusto — `LocalizedString = { _type: "localizedString"; it?: string; en?: string }`
 * — quindi dove la proiezione GROQ restituisce quel tipo il cast non serve.
 *
 * Qui il parametro resta `unknown` per un'altra ragione, che non è una
 * limitazione: la funzione è chiamata da tre punti con proiezioni diverse, e
 * accettare `unknown` è ciò che le permette di essere una sola. Il `as` interno
 * è la conseguenza della firma, non un ripiego su TypeGen.
 */
export function modelDisplayName(
  name: unknown,
  locale: ActiveLocale,
  code: string | null | undefined,
): string {
  const nameObj = name as Partial<Record<Locale, string>> | null;
  return nameObj?.[locale] ?? nameObj?.it ?? code ?? "";
}
