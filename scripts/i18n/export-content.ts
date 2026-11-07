/**
 * scripts/i18n/export-content.ts <locale>
 *
 * Esporta in `tmp/traduzioni/<locale>/` tutti i campi localizzati di ogni
 * documento, uno JSON per documento, nella forma
 * `{ _id, _type, campi: { path: { it, en, <locale> } } }`.
 *
 * ⚠️ **SOLA LETTURA.** Non scrive su Sanity. È lo strumento che si dà a un
 * traduttore, e uno strumento che consegna testo non deve poter cambiare niente.
 *
 * ⚠️ **Le BOZZE non si esportano mai, nemmeno col token in mano.** Una bozza è
 * lavoro di qualcuno, in corso: tradurla vuol dire mandare a un traduttore un
 * testo che l'autore sta ancora cambiando, e riportarlo indietro su un documento
 * che nessuno ha deciso di pubblicare. Su questo dataset ce n'è una, orfana, un
 * `post` del 22 giugno senza pubblicato corrispondente: senza questa regola
 * finiva nel conto e i post da tradurre risultavano 17 invece di **16**.
 *
 * ⚠️ **Le escluse si NOMINANO**, non si tolgono in silenzio: un conto che cala
 * senza spiegazione è indistinguibile da un documento perso.
 *
 * Uso:  pnpm i18n:export de
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

import { campiLocalizzati, LINGUE, perIlTraduttore, type Lingua } from "./lib";
import { LOCALIZED_DOCUMENT_TYPES } from "./tipi";

loadEnv({ path: ".env.local" });

/** I tipi che portano contenuto localizzato: l'elenco sta in `tipi.ts`, e `tipi.test.ts` lo
 *  confronta con lo schema, perché scritto a mano invecchia (il 16/09/2026 mancava `author`). */
const TIPI = [...LOCALIZED_DOCUMENT_TYPES];

/** L'ordine del riepilogo: sui nomi dei tipi è quello di `sort()` senza argomenti (misurato il 28/10/2026). */
const ORDINE = new Intl.Collator("it");

// Il valore viene da `LINGUE`, non da `argv`: fuori dall'elenco resta `undefined`.
const richiesta = LINGUE.find((l) => l === process.argv[2]);
if (!richiesta) {
  console.error(`✖ Uso: pnpm i18n:export <${LINGUE.join("|")}>`);
  process.exit(1);
}
// Ristretta qui: dentro `main()` TypeScript non vede più la guardia qui sopra,
// perché `process.exit` interrompe il flusso ma non il tipo.
const lingua: Lingua = richiesta;

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
if (!projectId || !dataset) {
  console.error("✖ Mancano NEXT_PUBLIC_SANITY_PROJECT_ID / _DATASET");
  process.exit(1);
}

const token = process.env.SANITY_API_READ_TOKEN;
const client = createClient({
  projectId,
  dataset,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01",
  useCdn: false,
  ...(token ? { token, perspective: "raw" as const } : { perspective: "published" as const }),
});

const cartella = join(process.cwd(), "tmp", "traduzioni", lingua);
mkdirSync(cartella, { recursive: true });

// `tsx` compila in CJS e il top-level await non passa: il corpo sta in un main.
async function main() {
  const tutti: Array<Record<string, unknown>> = await client.fetch(
    `*[_type in $tipi] | order(_type asc, _id asc)`,
    { tipi: TIPI },
  );

  // La partizione si fa QUI e non in GROQ, perché così le escluse si possono
  // elencare: con un filtro nella query sparirebbero senza lasciare traccia.
  // Senza token la prospettiva è già `published` e questa riga non toglie nulla.
  const bozze = tutti.filter((d) => String(d._id).startsWith("drafts."));
  const documenti = tutti.filter((d) => !String(d._id).startsWith("drafts."));

  let scritti = 0;
  let campiTotali = 0;
  const perTipo = new Map<string, number>();

  for (const doc of documenti) {
    // Le pagine di contenuto restano fuori intere: le FAQ non si traducono (`perIlTraduttore`), e
    // titolo, introduzione, corpo e SEO delle pagine d'uso li scrive Cowork lingua per lingua nei
    // file di `docs/content/pagine-uso/` (c1a, 3/11/2026).
    if (doc._type === "contentPage") continue;
    const campi = perIlTraduttore(campiLocalizzati(doc));
    if (campi.length === 0) continue;

    const fuori = {
      _id: doc._id,
      _type: doc._type,
      campi: Object.fromEntries(
        campi.map((c) => [
          c.path,
          {
            it: c.valori.it ?? null,
            en: c.valori.en ?? null,
            // La colonna da riempire. Se c'è già, si riesporta: serve a rivedere.
            [lingua]: c.valori[lingua] ?? null,
          },
        ]),
      ),
    };

    // Il nome del file porta il tipo davanti: nella cartella si vede subito cosa
    // si sta traducendo, e i documenti dello stesso tipo restano vicini.
    const nome = `${String(doc._type)}--${String(doc._id).replace(/[^a-zA-Z0-9._-]/g, "_")}.json`;
    writeFileSync(join(cartella, nome), `${JSON.stringify(fuori, null, 2)}\n`, "utf-8");
    scritti += 1;
    campiTotali += campi.length;
    perTipo.set(String(doc._type), (perTipo.get(String(doc._type)) ?? 0) + 1);
  }

  console.log(
    `\n  ${scritti} documenti, ${campiTotali} campi localizzati → tmp/traduzioni/${lingua}/`,
  );
  for (const [tipo, n] of [...perTipo].sort(([a], [b]) => ORDINE.compare(a, b)))
    console.log(`    ${tipo.padEnd(18)} ${n}`);

  console.log(`\n  bozze ESCLUSE: ${bozze.length}${bozze.length ? "" : " (nessuna sul dataset)"}`);
  for (const b of bozze) console.log(`    ${String(b._type).padEnd(18)} ${String(b._id)}`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
