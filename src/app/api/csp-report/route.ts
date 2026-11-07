import { righeDaRichiesta } from "@/lib/csp-report";

/**
 * Dove i browser mandano le violazioni della CSP (`report-uri` e `report-to`,
 * v. `next.config.ts`). Risponde **sempre 204** e non salva niente: scrive nel
 * log di Vercel una riga troncata per violazione. Limiti e filtri stanno in
 * `src/lib/csp-report.ts`; il limite di frequenza per IP è una regola del
 * firewall di Vercel, dal pannello. `/api` è fuori dal matcher del proxy.
 */
export async function POST(req: Request) {
  for (const riga of await righeDaRichiesta(req)) console.warn(riga);
  return new Response(null, { status: 204 });
}
