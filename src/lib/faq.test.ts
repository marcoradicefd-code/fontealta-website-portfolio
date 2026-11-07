import { describe, expect, it } from "vitest";

import { getPathname } from "@/i18n/navigation";
import { ALL_LOCALES } from "@/i18n/routing";
import { FAQ_LINK_ROUTES } from "@/sanity/lib/faq-rules";

import { faqAnchorId, faqAnchorIds, internalLinkHref } from "./faq";
import { faqPageJsonLd } from "./json-ld";

// L'href di `Link` ammette anche la query, quello di `getPathname` no: qui ci sono solo
// percorsi, quindi la conversione non perde niente.
type PathHref = Parameters<typeof getPathname>[0]["href"];
const pathOf = (href: unknown, locale: (typeof ALL_LOCALES)[number]) =>
  getPathname({ href: href as PathHref, locale });

describe("faqAnchorId", () => {
  it("toglie accenti e punteggiatura, apostrofo tipografico compreso", () => {
    expect(faqAnchorId("Perché l’acciaio inox AISI 316 e non il 304?")).toBe(
      "faq-perche-l-acciaio-inox-aisi-316-e-non-il-304",
    );
    expect(faqAnchorId("¿Qué acabados tiene Boss?")).toBe("faq-que-acabados-tiene-boss");
    expect(faqAnchorId("Wie groß ist die Auswahl?")).toBe("faq-wie-gross-ist-die-auswahl");
  });

  it("resta entro 64 caratteri dopo il prefisso, senza trattino in coda", () => {
    const id = faqAnchorId(`${"parola ".repeat(30)}finale?`);
    expect(id.length).toBeLessThanOrEqual("faq-".length + 64);
    expect(id.endsWith("-")).toBe(false);
  });

  it("una domanda senza lettere né cifre ha comunque un id", () => {
    expect(faqAnchorId("?!")).toBe("faq-domanda");
  });

  it("due domande col testo uguale non condividono l'id", () => {
    expect(faqAnchorIds(["Come si pulisce?", "Come si pulisce?", "Altro?"])).toEqual([
      "faq-come-si-pulisce",
      "faq-come-si-pulisce-2",
      "faq-altro",
    ]);
  });
});

describe("internalLinkHref", () => {
  it("una rotta con slug diventa il percorso della lingua", () => {
    const href = internalLinkHref("/collezioni/[slug]", "boss");
    expect(href).not.toBeNull();
    const percorsi = ALL_LOCALES.map((locale) => pathOf(href, locale));
    expect(percorsi).toEqual([
      "/collezioni/boss",
      "/en/collections/boss",
      "/de/kollektionen/boss",
      "/fr/collections/boss",
      "/es/colecciones/boss",
    ]);
  });

  it("ogni rotta ammessa si traduce nelle cinque lingue", () => {
    for (const route of Object.keys(FAQ_LINK_ROUTES)) {
      const href = internalLinkHref(route, "x");
      expect(href, route).not.toBeNull();
      for (const locale of ALL_LOCALES) {
        expect(pathOf(href, locale)).toMatch(/^\//);
      }
    }
  });

  it("senza slug, o con una rotta che non c'è, il testo resta senza link", () => {
    expect(internalLinkHref("/modello/[slug]", null)).toBeNull();
    expect(internalLinkHref("/modello/[slug]", "")).toBeNull();
    expect(internalLinkHref("/area-riservata", undefined)).toBeNull();
    expect(internalLinkHref("toString", undefined)).toBeNull();
    expect(internalLinkHref(undefined, "boss")).toBeNull();
  });
});

describe("faqPageJsonLd", () => {
  it("una Question per domanda, nell'ordine dato, col testo della risposta", () => {
    expect(
      faqPageJsonLd([
        { question: "Uno?", answer: "Primo." },
        { question: "Due?", answer: "Secondo." },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Uno?",
          acceptedAnswer: { "@type": "Answer", text: "Primo." },
        },
        {
          "@type": "Question",
          name: "Due?",
          acceptedAnswer: { "@type": "Answer", text: "Secondo." },
        },
      ],
    });
  });

  it("nessuna domanda, nessun FAQPage", () => {
    expect(faqPageJsonLd([])).toBeNull();
  });
});
