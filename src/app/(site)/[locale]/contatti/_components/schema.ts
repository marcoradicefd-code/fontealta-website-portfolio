import { ALTRO_PAESE, CODICI_PAESE } from "@/lib/paesi";
// Da `@/lib/zod` e non da `"zod"`: lì Zod è configurato senza la sonda `new Function`
// che la CSP segnalerebbe, e prima di qualunque schema (il perché sta in quel file).
import { z } from "@/lib/zod";

/**
 * Zod 4 schema condiviso tra ContactForm (client, resolver react-hook-form)
 * e submitContact (server, re-validation). Messaggi di errore sono chiavi
 * i18n del namespace `contatti.form.errors.*` risolte client-side; il server
 * usa lo stesso schema per validazione difensiva (messaggi non localizzati lì,
 * ma il client non invia mai payload invalido).
 */
export const REQUEST_TYPES = ["preventivo", "consulenza", "catalogo", "altro"] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];

/**
 * Le voci del menu «Di cosa hai bisogno» (19/10/2026, Marco): il catalogo esce dal menu e si
 * chiede dal suo modulo, nella sezione `#catalogo`. ⚠️ Lo schema accetta ancora `"catalogo"`
 * (`REQUEST_TYPES`): una pagina rimasta aperta da prima lo può mandare, e allora il lead va a
 * Zapier e parte l'email del catalogo come dal mini-modulo.
 */
export const RICHIESTE_NEL_MENU = [
  "preventivo",
  "consulenza",
  "altro",
] as const satisfies readonly Exclude<RequestType, "catalogo">[];

export const NOTE_MAX = 1000;

/**
 * Quando le note sono obbligatorie, e con quale minimo (Marco, 13/10/2026):
 * - richiesta «altro», qualunque Paese → minimo 10, perché la richiesta è da descrivere;
 * - «Altro Paese» con le altre richieste → minimo 2, perché il Paese va scritto lì;
 * - altrimenti facoltative (`null`).
 * La usano lo schema e i moduli, che ne ricavano etichetta e `aria-required`.
 */
export function regolaNote(
  richiesta: string | undefined,
  paese: string | undefined,
): { minimo: number; errore: "noteRequired" | "notePaeseRequired" } | null {
  if (richiesta === "altro") return { minimo: 10, errore: "noteRequired" };
  if (paese === ALTRO_PAESE) return { minimo: 2, errore: "notePaeseRequired" };
  return null;
}

/** L'etichetta delle note, chiave di `contatti.form`: dice anche COSA scrivere. */
export function etichettaNote(
  richiesta: string | undefined,
  paese: string | undefined,
): "noteFacoltative" | "noteAltro" | "noteAltroPaese" | "notePaese" {
  if (richiesta === "altro") return paese === ALTRO_PAESE ? "noteAltroPaese" : "noteAltro";
  return paese === ALTRO_PAESE ? "notePaese" : "noteFacoltative";
}

export const contactSchema = z
  .object({
    nome: z.string().trim().min(1, { message: "nomeRequired" }).max(80),
    // Obbligatorio in tutti i moduli, catalogo compreso dal 20/10/2026 (Marco): dal 19/10 il modulo
    // del catalogo non lo chiedeva, e l'obbligo stava in un `superRefine` con l'eccezione.
    cognome: z.string().trim().min(1, { message: "cognomeRequired" }).max(80),
    email: z.email({ message: "emailInvalid" }).max(120),
    telefono: z.string().trim().max(40).optional().or(z.literal("")),
    azienda: z.string().trim().max(120).optional().or(z.literal("")),
    richiesta: z.enum(REQUEST_TYPES, { message: "richiestaRequired" }),
    // Paese, non nazionalità: codice alpha-2 maiuscolo o `ZZ` («Altro Paese»). Un codice
    // minuscolo si rifiuta: il menu manda solo maiuscole, normalizzare servirebbe solo a
    // chi chiama la Action senza passare dal modulo.
    paese: z.enum(CODICI_PAESE, { message: "paeseRequired" }),
    note: z.string().trim().max(NOTE_MAX).optional().or(z.literal("")),
    // Lingua in cui la persona guarda il sito: iniettata dal hook come `_ts`, mai un campo
    // DOM. Stringa libera apposta: un valore che non è una lingua NON rifiuta il lead, il
    // server ripiega sulla lingua del referer (`submitContact`). `.catch` (14/10/2026): anche
    // un valore troppo lungo o di tipo sbagliato si scarta invece di rifiutare il lead.
    lingua: z.string().max(10).optional().catch(undefined),
    // Pagina del modulo: chiave interna di `routing.pathnames` (`usePathname` di next-intl),
    // iniettata dal hook come `lingua`. Serve SOLO a calcolare la source, non va a Zapier.
    // `.catch`: un valore di tipo sbagliato non rifiuta il lead, si ripiega sul referer.
    pagina: z.string().max(200).optional().catch(undefined),
    // Il modello della scheda da cui scrive (16/10/2026): codice («B40L») e nome nella lingua della
    // pagina («Boss B40L»). Arrivano dal server come prop e il hook li inietta come `lingua`; fuori
    // dalle schede mancano. `.catch`: un valore troppo lungo o strano si scarta, mai un rifiuto.
    modello: z.string().trim().max(40).optional().catch(undefined),
    modelloNome: z.string().trim().max(120).optional().catch(undefined),
    // La casella della newsletter (19/10/2026), facoltativa e mai spuntata. `.catch(false)` fa anche
    // da default: assente o strana vale «non spuntata», mai un rifiuto del lead. Non `.default`, che
    // separa il tipo d'ingresso da quello d'uscita e il resolver di react-hook-form non lo accetta.
    newsletter: z.boolean().catch(false),
    // Anti-spam — MAI inoltrati a Zapier (strip lato server in submitContact).
    // `_gotcha` = honeypot (deve restare vuoto; se valorizzato → bot). `_ts` = epoch
    // ms del mount del form (timestamp-trap: submit < 3s = bot). Opzionali per non
    // rompere la re-validazione difensiva di chiamanti esterni.
    _gotcha: z.string().max(200).optional(),
    // Numero (epoch ms) iniettato dal hook al submit, mai un campo DOM → nessuna
    // coercizione da stringa: `z.number()` mantiene input==output e non rompe i tipi RHF.
    _ts: z.number().optional(),
  })
  .superRefine(
    (v, ctx) => {
      const regola = regolaNote(v.richiesta, v.paese);
      // Con `when` il refine gira anche se un campo è invalido: `note` può non essere stringa.
      const note = typeof v.note === "string" ? v.note.trim() : "";
      if (regola && note.length < regola.minimo) {
        ctx.addIssue({ code: "custom", path: ["note"], message: regola.errore });
      }
    },
    {
      // ⚠️ Zod 4 salta un refine sull'oggetto se un campo ha già dato un errore
      // bloccante, e un menu lasciato vuoto (`paese: ""`) lo è: senza `when` chi sceglie
      // «altro» e non sceglie il Paese vedrebbe l'errore delle note solo al secondo invio
      // (misurato). Gira appena richiesta o paese sono stringhe, qualunque sia il resto.
      when: (payload) => {
        const v = payload.value as { richiesta?: unknown; paese?: unknown };
        return typeof v?.richiesta === "string" || typeof v?.paese === "string";
      },
    },
  );

export type ContactFormValues = z.infer<typeof contactSchema>;

/**
 * `catalogo` c'è solo con `richiesta: "catalogo"`: «inviato» se Brevo ha risposto 2xx,
 * «ripiego» altrimenti, e la persona vede il link diretto al PDF (Q7, Q23, Q24).
 */
export type SubmitContactResult =
  { status: "success"; catalogo?: "inviato" | "ripiego" } | { status: "error"; message: string };
