import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Il webhook è l'unico punto in cui il publish su Sanity tocca la cache del
 * sito, e non ha nessuna interfaccia: se smette di funzionare, non si rompe
 * niente — le pagine restano in piedi servendo contenuto vecchio. È il guasto
 * silenzioso per definizione, e questo file è l'unico posto in cui viene visto.
 *
 * ⚠️ `vi.hoisted` e non `const` normali: le factory di `vi.mock` vengono issate
 * in cima al file, quindi un `const revalidateTag = vi.fn()` scritto qui sopra
 * non esisterebbe ancora al momento della factory.
 */
const { revalidateTag, revalidatePath, parseBody } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  parseBody: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag, revalidatePath }));
vi.mock("next-sanity/webhook", () => ({ parseBody }));

import { POST } from "./route";

/** La richiesta non viene mai letta: `parseBody` è mockata. Serve solo un
 *  oggetto della forma giusta da passare alla firma. */
const RICHIESTA = new Request("https://fontealta.it/api/revalidate", {
  method: "POST",
}) as unknown as NextRequest;

function inArrivo(body: unknown, isValidSignature = true) {
  parseBody.mockResolvedValueOnce({ isValidSignature, body });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("webhook di revalidate: i tag", () => {
  it("spara il tag del tipo e quello granulare con lo slug", async () => {
    inArrivo({ _type: "model", slug: { current: "b40l" } });

    const res = await POST(RICHIESTA);

    expect(res.status).toBe(200);
    expect(revalidateTag.mock.calls).toEqual([
      ["model", "default"],
      ["model:b40l", "default"],
    ]);
  });

  it("senza slug spara il solo tag del tipo", async () => {
    inArrivo({ _type: "siteSettings" });

    await POST(RICHIESTA);

    expect(revalidateTag.mock.calls).toEqual([["siteSettings", "default"]]);
  });
});

describe("webhook di revalidate: la sitemap NON si tocca da qui", () => {
  /**
   * ⚠️ **Questo è il negativo di un test che in #164 diceva il contrario, e il
   * capovolgimento è il punto.** Lì il webhook chiamava
   * `revalidatePath("/sitemap.xml")`, e faceva pure il suo lavoro: misurato in
   * produzione, la rotta si ricostruiva davvero (`MISS` con `age 0` alle
   * 12:02:36Z). Serviva però un `lastmod` vecchio di un publish, perché il dato
   * arrivava dalla cache dati di Next e non dalla rotta.
   *
   * Da #165 `/sitemap.xml` è `force-dynamic` e la sua query gira con
   * `cache: "no-store"`: non c'è più niente da invalidare. Rimettere qui un
   * `revalidatePath` non farebbe danno di per sé — non farebbe **niente**, che
   * è peggio: chi legge il webhook crederebbe che il rinfresco della sitemap
   * sia coperto da qui, e smetterebbe di cercarlo dove sta davvero.
   */
  it.each(["model", "collection", "concealedBody", "projectReference", "post"])(
    "«%s» non chiama revalidatePath: la sitemap non ha piu una cache da marcare",
    async (tipo) => {
      inArrivo({ _type: tipo, slug: { current: "qualcosa" } });

      await POST(RICHIESTA);

      expect(revalidatePath).not.toHaveBeenCalled();
      // ...ma il tag parte lo stesso: quello serve alle PAGINE, che sono
      // cacheate e taggate, ed e un meccanismo diverso.
      expect(revalidateTag).toHaveBeenCalledWith(tipo, "default");
    },
  );

  it("non chiama revalidatePath per nessun tipo, nemmeno fuori sitemap", async () => {
    for (const tipo of ["author", "category", "finish", "siteSettings"]) {
      inArrivo({ _type: tipo });
      await POST(RICHIESTA);
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("webhook di revalidate: i rifiuti", () => {
  it("firma non valida → 401, e non tocca nessuna cache", async () => {
    inArrivo({ _type: "model", slug: { current: "b40l" } }, false);

    const res = await POST(RICHIESTA);

    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("_type mancante → 400, e non tocca nessuna cache", async () => {
    inArrivo({ slug: { current: "b40l" } });

    const res = await POST(RICHIESTA);

    expect(res.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("body nullo → 400", async () => {
    inArrivo(null);

    const res = await POST(RICHIESTA);

    expect(res.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
