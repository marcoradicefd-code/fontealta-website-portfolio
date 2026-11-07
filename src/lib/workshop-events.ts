import { ACTIVE_LOCALES } from "@/i18n/routing";

/**
 * Gli eventi che la tavola dell'officina manda alla pagina `/officina`, e niente altro.
 *
 * La tavola li spedisce con `parent.postMessage({ tipo: "fa-officina", nome, dati },
 * location.origin)` (funzione `ev()` di `public/officina-tavola/index.html`), solo in
 * modalità `embed`. La pagina li passa a `track()` di Vercel Web Analytics.
 *
 * ⚠️ **Elenco chiuso, proprietà ricostruite una per una** (spec
 * `docs/specs/tavola-officina.md`, «Statistiche»): un messaggio è accettato solo se viene
 * dalla stessa origine, ha il `tipo` della tavola, uno dei tre nomi e dati del tipo
 * atteso. I `dati` non si copiano mai così come arrivano: una chiave in più non deve
 * diventare una proprietà nelle statistiche. `officina_apri` non passa di qui: è il clic
 * sulla facciata di `/produzione`, tracciato da quella pagina.
 */
export type WorkshopEvent =
  | { name: "officina_voce"; props: { lingua: string } }
  | { name: "officina_giro"; props: { lingua: string; voce: boolean } }
  | { name: "officina_reparto"; props: { reparto: number } };

/** I reparti della tavola: dodici, numerati da 1. */
const DEPARTMENTS = 12;

const isLocale = (v: unknown): v is string =>
  typeof v === "string" && (ACTIVE_LOCALES as readonly string[]).includes(v);

export function parseWorkshopEvent(
  message: { origin: string; data: unknown },
  expectedOrigin: string,
): WorkshopEvent | null {
  if (message.origin !== expectedOrigin) return null;
  const data = message.data;
  if (typeof data !== "object" || data === null) return null;
  const { tipo, nome, dati } = data as { tipo?: unknown; nome?: unknown; dati?: unknown };
  if (tipo !== "fa-officina" || typeof dati !== "object" || dati === null) return null;
  const d = dati as Record<string, unknown>;

  switch (nome) {
    case "officina_voce":
      return isLocale(d.lingua) ? { name: nome, props: { lingua: d.lingua } } : null;
    case "officina_giro":
      return isLocale(d.lingua) && typeof d.voce === "boolean"
        ? { name: nome, props: { lingua: d.lingua, voce: d.voce } }
        : null;
    case "officina_reparto":
      return Number.isInteger(d.reparto) &&
        (d.reparto as number) >= 1 &&
        (d.reparto as number) <= DEPARTMENTS
        ? { name: nome, props: { reparto: d.reparto as number } }
        : null;
    default:
      return null;
  }
}
