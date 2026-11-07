/**
 * Le misure dei prodotti: chiavi, famiglie, attacchi, fonti (spec `docs/specs/contenuti-per-lingua.md` § B).
 *
 * **Sorgente unica**, come `model-taxonomy.ts`: la importano lo schema di Studio, il sito
 * (`src/lib/misure.ts`) e lo script di carico, che scrive senza passare dalla validazione di
 * Studio. Due copie divergenti caricherebbero chiavi che Studio rifiuta o che il sito non
 * sa nominare.
 *
 * Il nome di una chiave nelle cinque lingue non sta qui: sta nei messaggi (`misure.nomi`),
 * perché è testo servito.
 */

/** Le quote che hanno un nome. Le quote dei disegni senza un nome certo non si caricano. */
export const CHIAVI_MISURA = [
  "altezzaTotale",
  "altezzaBocca",
  "altezzaSoffione",
  "altezzaComando",
  "altezzaDoccetta",
  "altezza",
  "sporgenza",
  "sporgenzaBocca",
  "diametroTubo",
  "diametroBase",
  "base",
  "spessorePianoMax",
  "diametroPlacca",
  "placca",
  "interasseAttacchi",
  "diametroSoffione",
  "soffione",
  "lunghezza",
  "larghezza",
  "profondita",
  "diametro",
] as const;
export type ChiaveMisura = (typeof CHIAVI_MISURA)[number];

/** La famiglia decide la misura principale (§ B.3). */
export const FAMIGLIE_MISURE = [
  "colonna",
  "piano",
  "incasso",
  "gruppoParete",
  "kitDoccia",
  "soffione",
  "accessorio",
  "corpoIncasso",
] as const;
export type FamigliaMisure = (typeof FAMIGLIE_MISURE)[number];

/** Gli attacchi filettati: un dato a parte, mai una misura (decisione 3 di Marco, 2/11/2026). */
export const ATTACCHI = ['G1/2"', 'G3/4"'] as const;
export type Attacco = (typeof ATTACCHI)[number];

export const DOCUMENTI_FONTE = ["listinoEditionV-06-002", "listinoIlle-REV07-001"] as const;

export const STATI_MISURE = ["daVerificare", "verificata"] as const;

export type RigaMisura = {
  valore?: number;
  min?: number;
  max?: number;
  tolleranza?: number;
  lati?: number[];
};

/**
 * Una sola forma per riga: valore (con o senza tolleranza), intervallo, oppure lati. Pura e senza
 * il pacchetto `sanity`: la usano lo schema di Studio, il sito (`src/lib/misure.ts`) e lo script
 * di carico.
 */
export function formaDellaRiga(riga: RigaMisura | undefined): true | string {
  if (!riga) return true;
  const haValore = typeof riga.valore === "number";
  const haIntervallo = typeof riga.min === "number" || typeof riga.max === "number";
  const haLati = Array.isArray(riga.lati) && riga.lati.length > 0;
  const forme = [haValore, haIntervallo, haLati].filter(Boolean).length;
  if (forme !== 1) return "Una sola forma: valore, oppure min e max, oppure lati.";
  if (haIntervallo && !(typeof riga.min === "number" && typeof riga.max === "number"))
    return "Un intervallo vuole min e max.";
  if (haIntervallo && (riga.min as number) >= (riga.max as number))
    return "Min deve essere minore di max.";
  if (haLati && riga.lati?.length !== 2) return "Lati: due numeri.";
  if (typeof riga.tolleranza === "number" && !haValore) return "La tolleranza va con un valore.";
  return true;
}
