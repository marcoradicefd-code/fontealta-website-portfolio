import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La guardia legge il **metadata generato dalla pagina vera**, non il
 * risolutore.
 *
 * ⚠️ **Perché non basta testare `risolviSeo`.** Quello dice che la catena
 * sceglie bene; questo dice che la pagina la usa. Fra i due c'è tutto ciò che
 * può andare storto senza che un test unitario se ne accorga: un campo passato
 * dal posto sbagliato, un `absolute` dimenticato, un `alternates` che resta
 * mentre `robots` dice di non indicizzare. Il difetto che questa guardia prende
 * è quello che non rompe niente e si vede solo nell'HTML servito.
 *
 * Nessuna scrittura su Sanity e nessuna lettura: i documenti sono finti.
 */

const { getConcealedBody } = vi.hoisted(() => ({ getConcealedBody: vi.fn() }));

vi.mock("@/lib/content", () => ({
  getConcealedBody,
  getAllConcealedBodySlugs: vi.fn(async () => []),
}));

/**
 * ⚠️ **`@/lib/og-fallback-image` va mockato, e il motivo vale oltre questo file.**
 * Da quando la pagina dichiara un `openGraph` proprio importa quel modulo, che
 * legge `siteSettings` e porta con sé `server-only`: fuori da un ambiente RSC
 * Vite non lo risolve e l'import della pagina **muore**. Qui il guasto è uscito
 * come sette test rossi e non come «0 test» perché il file resta importabile per
 * altre vie, ma è la stessa famiglia già annotata quattro volte nel repo.
 */
vi.mock("@/lib/og-fallback-image", () => ({
  fallbackOgImages: vi.fn(async () => [{ url: "/og-default.jpg", width: 1200, height: 630 }]),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(
    async () => (chiave: string, valori?: Record<string, unknown>) =>
      `${chiave}:${valori?.codice ?? ""}`,
  ),
}));

async function metadata(locale: "it" | "en", documento: unknown) {
  getConcealedBody.mockResolvedValue(documento);
  const { generateMetadata } = await import("./page");
  return generateMetadata({ params: Promise.resolve({ locale, slug: "cw-1" }) });
}

const CORPO_NUDO = { code: "CW.1", name: { it: "Corpo", en: "Body" }, contenutoNellaLingua: true };

describe("guardia · il metadata generato dalla scheda corpo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a campi vuoti esce il template, con canonical e hreflang", async () => {
    const m = await metadata("it", CORPO_NUDO);
    expect(m.title).toBe("metaTitleCorpo:CW.1");
    expect(m.description).toBe("metaDescriptionCorpo:CW.1");
    expect(m.alternates?.canonical).toContain("/collezioni/corpi-a-incasso/cw-1");
    expect(m.alternates?.languages).toBeTruthy();
    expect(m.robots).toBeUndefined();
    // `og:url` È il canonical: la stessa stringa, non una seconda risoluzione.
    expect(m.openGraph?.url).toBe(m.alternates?.canonical);
  });

  it("campo compilato nella lingua: vince sul template, e NON è assoluto", async () => {
    const m = await metadata("it", {
      ...CORPO_NUDO,
      seo: { metaTitle: { it: "Titolo scritto a mano", en: "Hand written" } },
    });
    // Stringa nuda e non `{ absolute }`: il suffisso « | Fontealta» lo aggiunge
    // `title.template` del layout, come su ogni altra pagina.
    expect(m.title).toBe("Titolo scritto a mano");
  });

  it("campo compilato nell'altra lingua soltanto: si torna al template", async () => {
    const m = await metadata("en", {
      ...CORPO_NUDO,
      seo: { metaTitle: { it: "Solo italiano" } },
    });
    expect(m.title).toBe("metaTitleCorpo:CW.1");
  });

  it("noIndex: robots presente, e canonical e hreflang SPARITI", async () => {
    const m = await metadata("it", { ...CORPO_NUDO, seo: { noIndex: true } });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.alternates).toBeUndefined();
    expect("alternates" in m).toBe(false);
    // Un cancello solo: sparito il canonical, sparisce anche `og:url`. Il resto
    // dell'`openGraph` resta — siteName, lingua, immagine: una pagina esclusa dai
    // motori si condivide ancora, e deve farlo bene.
    expect("url" in (m.openGraph ?? {})).toBe(false);
    expect(m.openGraph?.siteName).toBe("Fontealta");
  });

  it("noIndex non è nofollow, e non tocca titolo e description", async () => {
    const m = await metadata("it", {
      ...CORPO_NUDO,
      seo: { noIndex: true, metaTitle: { it: "Titolo" } },
    });
    expect((m.robots as { follow: boolean }).follow).toBe(true);
    expect(m.title).toBe("Titolo");
    expect(m.description).toBe("metaDescriptionCorpo:CW.1");
  });

  it("noIndex false si comporta come assente", async () => {
    const m = await metadata("it", { ...CORPO_NUDO, seo: { noIndex: false } });
    expect(m.robots).toBeUndefined();
    expect(m.alternates?.canonical).toBeTruthy();
  });

  it("documento assente: nessun canonical su una pagina che sarà un 404", async () => {
    const m = await metadata("it", null);
    expect(m.alternates).toBeUndefined();
  });
});
