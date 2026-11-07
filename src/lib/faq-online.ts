/**
 * L'interruttore delle FAQ sul sito (Marco, 30/10/2026): la sezione «Domande frequenti» e il JSON-LD
 * `FAQPage` escono solo quando ci sono tutte e cinque le lingue. **Spento di default, in tutte le
 * lingue**, e senza Sanity: è una scelta di pubblicazione, non un dato del contenuto.
 *
 * Si accende con `FAQ_SITO=1` nell'ambiente del build (su Vercel, quando sarà il momento). Lo legge
 * `getFaq`, quindi da spento non parte nemmeno la richiesta a Sanity. Il build dell'e2e lo accende
 * (`test:e2e`), così le prove dell'accordion girano; lo stato spento lo prova `faq-online.test.ts`.
 * L'accensione arriva dopo le ondate DE, FR ed ES (spec FAQ § 10).
 */
export function faqOnline(env: Record<string, string | undefined> = process.env): boolean {
  return env.FAQ_SITO === "1";
}
