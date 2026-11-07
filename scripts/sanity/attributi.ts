/**
 * scripts/sanity/attributi.ts: la guardia degli attributi, di rito e non in CI (spec FAQ § 1.2).
 *
 * - **Dataset:** `fields.count` dall'endpoint delle statistiche; rosso sopra 1.500 su 2.000.
 * - **Documento:** i dieci più pesanti contati da `attributi-lib.ts`; rosso sopra 750 su 1.000.
 * - **Controprova:** l'unione contata qui contro `fields.count`. Se non combacia, il conteggio per
 *   documento non fa fede e lo script lo dice.
 *
 * Solo lettura. Il token lo legge `dotenv` da `.env.local`, come gli altri script: non si stampa.
 * Si lancia prima e dopo ogni ondata, e dopo ogni cambio di schema.
 */

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

import { attributi, SOGLIE, unione } from "./attributi-lib";

loadEnv({ path: ".env.local" });

const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const token = process.env.SANITY_API_READ_TOKEN;
if (!token) {
  console.error("✖ Manca SANITY_API_READ_TOKEN: le statistiche e le bozze vogliono il token.");
  process.exit(1);
}
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01",
  useCdn: false,
  token,
  perspective: "raw",
});

async function main() {
  const stats = await client.request<{ fields: { count: { value: number; limit: number } } }>({
    uri: `/data/stats/${dataset}`,
  });
  const { value, limit } = stats.fields.count;
  const docs = await client.fetch<Array<Record<string, unknown>>>(`*`);
  const sistema = docs.filter((d) => String(d._id).startsWith("_."));
  const contenuto = docs.filter((d) => !String(d._id).startsWith("_."));

  const pesanti = contenuto
    .map((d) => ({ id: String(d._id), tipo: String(d._type), n: attributi(d).size }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);
  const conta = { tutti: unione(docs), contenuto: unione(contenuto) };
  const combacia = conta.tutti === value || conta.contenuto === value;

  console.log(
    `\n  dataset ${dataset}: fields.count ${value} su ${limit} (soglia ${SOGLIE.dataset})`,
  );
  console.log(
    `  controprova: unione dello script ${conta.tutti} con i ${sistema.length} documenti di sistema, ${conta.contenuto} senza → ${combacia ? "combacia" : "NON combacia: il conteggio per documento non fa fede"}`,
  );
  console.log(
    `  ${contenuto.length} documenti; i dieci più pesanti (soglia ${SOGLIE.documento} su 1.000):`,
  );
  for (const p of pesanti)
    console.log(`    ${String(p.n).padStart(4)}  ${p.tipo.padEnd(18)} ${p.id}`);

  const rossi = [
    value > SOGLIE.dataset && `dataset ${value} > ${SOGLIE.dataset}`,
    combacia &&
      pesanti[0]?.n > SOGLIE.documento &&
      `documento ${pesanti[0].id} ${pesanti[0].n} > ${SOGLIE.documento}`,
  ].filter(Boolean);
  console.log(rossi.length ? `\n  ✖ ROSSO: ${rossi.join(" · ")}\n` : `\n  ✔ sotto le soglie\n`);
  return rossi.length;
}

main()
  .then((n) => process.exit(n ? 1 : 0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
