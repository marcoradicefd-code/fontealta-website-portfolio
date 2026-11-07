import { describe, expect, it } from "vitest";

import type { PassiMobileConsentiti } from "./hero-scrim";

/**
 * Il vincolo `passiMobile >= passi` vive nel TIPO, non in un commento: un mobile
 * più chiaro del desktop è quasi sempre uno sbaglio, e un commento non lo ferma.
 *
 * Questi non sono test a runtime travestiti: `@ts-expect-error` fallisce il
 * typecheck quando la riga sotto NON dà errore, quindi la coppia
 * consentito/vietato è un'asserzione che si rompe da sola se il tipo si
 * allenta. Il controllo che vale è il secondo: senza, il primo resterebbe verde
 * anche con `passiMobile?: number`.
 */
const stessoPasso: PassiMobileConsentiti<-3> = -3;
const piuScuro: PassiMobileConsentiti<-3> = 0;
const daZeroInSu: PassiMobileConsentiti<0> = 2;

// @ts-expect-error mobile più chiaro del desktop: −1 non è ammesso quando desktop sta a 0
const piuChiaro: PassiMobileConsentiti<0> = -1;
// @ts-expect-error fuori scala: 9 non è un passo
const fuoriScala: PassiMobileConsentiti<0> = 9;

describe("HeroScrim · vincolo passiMobile >= passi", () => {
  it("ammette lo stesso passo e i passi più scuri", () => {
    expect([stessoPasso, piuScuro, daZeroInSu]).toEqual([-3, 0, 2]);
  });

  it("rifiuta a typecheck un mobile più chiaro del desktop, e i valori fuori scala", () => {
    // I due valori esistono a runtime: la verifica è avvenuta a compile time,
    // e `@ts-expect-error` avrebbe fatto fallire `pnpm typecheck` se le due
    // righe sopra fossero diventate legali.
    expect([piuChiaro, fuoriScala]).toEqual([-1, 9]);
  });
});
