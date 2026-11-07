import { describe, expect, it, vi } from "vitest";

import { ACTIVE_LOCALES } from "@/i18n/routing";
// ⚠️ Alias obbligatorio: `it` è già l'`it()` di vitest, e un import con lo
// stesso nome dà `TS2300 Duplicate identifier` — il file non compila proprio.
import messaggiIt from "@/messages/it.json";
import messaggiEn from "@/messages/en.json";
import messaggiDe from "@/messages/de.json";
import messaggiFr from "@/messages/fr.json";
import messaggiEs from "@/messages/es.json";
import {
  AZIENDA_EMAIL,
  AZIENDA_NOME,
  AZIENDA_PIVA,
  AZIENDA_RAGIONE_SOCIALE,
  AZIENDA_SEDE,
  AZIENDA_TELEFONO,
} from "@/lib/azienda";
import {
  autoreArticoloJsonLd,
  dataModificaArticolo,
  KNOWS_ABOUT,
  localBusinessJsonLd,
  organizationJsonLd,
  sameAsDaSocial,
  publisherJsonLd,
  serializzaJsonLd,
  siteGraphJsonLd,
  webPageJsonLd,
  webSiteJsonLd,
} from "@/lib/json-ld";
import { siteUrl } from "@/lib/seo";
import { absoluteUrl } from "@/lib/urls";

/**
 * ⚠️ **Un JSON-LD sbagliato non si vede.** Non rompe una pagina, non fa cadere un
 * build, non cambia un pixel. Questi test sono il posto in cui viene guardato, e
 * la metà che conta di più è quella NEGATIVA: i campi che non devono esserci.
 */

const CONTATTI = { telefono: AZIENDA_TELEFONO, email: AZIENDA_EMAIL };
const BASE = siteUrl();

const MESSAGGI = {
  it: messaggiIt,
  en: messaggiEn,
  de: messaggiDe,
  fr: messaggiFr,
  es: messaggiEs,
} as const;

describe("Organization", () => {
  const org = organizationJsonLd(CONTATTI);

  it("dichiara il marchio, l'URL e un logo assoluto con le sue misure", () => {
    expect(org["@type"]).toBe("Organization");
    expect(org.name).toBe("Fontealta");
    expect(org.url).toBe(BASE);
    expect(org.logo.url.startsWith(BASE)).toBe(true);
    expect(org.logo.url).toMatch(/\.(png|jpg|webp|svg)$/);
    // Le misure sono quelle native del file, lette dal PNG: una dimensione
    // dichiarata sbagliata è peggio di una non dichiarata.
    expect(org.logo.width).toBe(1146);
    expect(org.logo.height).toBe(1241);
  });

  /**
   * ⚠️ **Questo test diceva l'opposto fino al 10/09/2026, e aveva ragione allora.**
   * Asseriva che `legalName`, `address` e `sameAs` NON ci fossero: erano le cose
   * che non sapevamo con certezza, e un NAP sbagliato in JSON-LD è
   * un'affermazione di identità falsa. Ragione sociale, P.IVA e civico sono stati
   * confermati da Marco il 10/09 incrociando il sito ufficiale e il LinkedIn
   * aziendale, quindi ora ci sono. Il test non è stato cancellato ma **girato**:
   * quello che resta è la metà ancora vera, cioè `sameAs`, che senza profili
   * social non deve comparire.
   */
  it("dichiara legalName e address, e continua a NON dichiarare sameAs", () => {
    const chiavi = Object.keys(org);
    expect(chiavi).toContain("legalName");
    expect(chiavi).toContain("address");
    expect(chiavi).toContain("vatID");
    // Nessun profilo social esiste: la chiave non deve esserci affatto.
    expect(chiavi).not.toContain("sameAs");
    // `Organization` resta `Organization`: la sede è un nodo suo, su `/contatti`.
    expect(org["@type"]).toBe("Organization");
  });

  it("il contactPoint porta i recapiti veri e le lingue in cui il sito esiste", () => {
    const [cp] = org.contactPoint;
    expect(cp.telephone).toBe("+39 0584 969041");
    expect(cp.email).toBe("info@fontealta.it");
    expect(cp.contactType).toBe("customer service");
    expect(cp.availableLanguage).toEqual([...ACTIVE_LOCALES]);
  });

  it("availableLanguage SEGUE ACTIVE_LOCALES, non è un elenco scritto a mano", () => {
    // ⚠️ L'asserzione qui sopra NON prova la derivazione: `["it","en"]` scritto a
    // mano la passerebbe identica, perché oggi i due lati valgono lo stesso.
    // Comincerebbe a proteggere solo il giorno che si accende una lingua, cioè
    // troppo tardi per accorgersene. L'unico modo di provarlo adesso è cambiare
    // ACTIVE_LOCALES sotto il modulo e guardare se l'uscita segue.
    expect.assertions(2);
    return (async () => {
      vi.resetModules();
      vi.doMock("@/i18n/routing", async (originale) => ({
        ...(await originale<typeof import("@/i18n/routing")>()),
        ACTIVE_LOCALES: ["it", "en", "de"] as const,
      }));
      const { organizationJsonLd: conTre } = await import("@/lib/json-ld");
      const [cp] = conTre(CONTATTI).contactPoint;
      expect(cp.availableLanguage).toEqual(["it", "en", "de"]);
      expect(cp.availableLanguage).toHaveLength(3);
      vi.doUnmock("@/i18n/routing");
      vi.resetModules();
    })();
  });

  it("non contiene nessun segnaposto", () => {
    // L'hook `validate-schema.py` esce 2 su `[Business Name]`, `REPLACE_*` e
    // simili. Qui la guardia è nostra e vale anche fuori dall'hook.
    //
    // ⚠️ Le parentesi quadre si cercano SOLO attorno a parole: `\[[^\]]*\]`
    // pescherebbe ogni array JSON, `["it","en"]` compreso, e il test sarebbe
    // rosso su un dato sano. Un segnaposto ha dentro lettere e spazi, non
    // virgolette.
    const testo = JSON.stringify(org);
    expect(testo).not.toMatch(/\[[A-Za-z][A-Za-z ]*\]|REPLACE|TODO|XXX|PLACEHOLDER|example\.com/i);
  });
});

describe("WebSite", () => {
  it.each([...ACTIVE_LOCALES])("su %s punta alla home di QUELLA lingua", (locale) => {
    const ws = webSiteJsonLd(locale);
    expect(ws["@type"]).toBe("WebSite");
    expect(ws.url).toBe(absoluteUrl(locale, "/"));
    expect(ws.inLanguage).toBe(locale);
    expect(ws.publisher["@id"]).toBe(`${BASE}#organization`);
  });

  it("le due lingue danno due URL diversi, non lo stesso", () => {
    // Se `url` fosse `siteUrl()` per entrambe, i due nodi si contraddirebbero:
    // stesso indirizzo, due `inLanguage`.
    expect(webSiteJsonLd("it").url).not.toBe(webSiteJsonLd("en").url);
  });

  it("non dichiara una SearchAction: il sito non ha una ricerca interna", () => {
    expect(Object.keys(webSiteJsonLd("it"))).not.toContain("potentialAction");
  });
});

describe("publisher dell'Article", () => {
  it("porta il logo INLINE, non solo un riferimento", () => {
    // Le linee guida dell'Article chiedono `publisher.logo` esplicito, e un
    // validatore che non risolve gli `@id` lo segnalerebbe mancante.
    const p = publisherJsonLd();
    expect(p.name).toBe("Fontealta");
    expect(p.logo["@type"]).toBe("ImageObject");
    expect(p.logo.url.startsWith(BASE)).toBe(true);
  });

  it("è lo stesso nodo dell'Organization del sito", () => {
    expect(publisherJsonLd()["@id"]).toBe(organizationJsonLd(CONTATTI)["@id"]);
  });
});

/**
 * ⚠️ **`description` e `knowsAbout` sono le UNICHE due chiavi dell'`Organization`
 * che dipendono dalla lingua**, ed è la cosa che questi test tengono ferma. Il
 * difetto che colgono non è una chiave mancante — quella si vede — ma una chiave
 * che comincia a cambiare fra le lingue senza che nessuno l'abbia deciso: un
 * consumatore che legge le due pagine si troverebbe due aziende con lo stesso
 * `@id` e fatti diversi.
 */
describe("description e knowsAbout", () => {
  it("senza description la chiave NON esiste, non è una stringa vuota", () => {
    expect("description" in organizationJsonLd(CONTATTI)).toBe(false);
    expect("description" in organizationJsonLd({ ...CONTATTI, description: "   " })).toBe(false);
  });

  it("senza knowsAbout la chiave NON esiste, non è un array vuoto", () => {
    expect("knowsAbout" in organizationJsonLd(CONTATTI)).toBe(false);
    expect("knowsAbout" in organizationJsonLd({ ...CONTATTI, knowsAbout: [] })).toBe(false);
  });

  it("la description compare ripulita dagli spazi", () => {
    const org = organizationJsonLd({ ...CONTATTI, description: "  Acciaio AISI 316.  " }) as {
      description?: string;
    };
    expect(org.description).toBe("Acciaio AISI 316.");
  });

  it("knowsAbout non ripete una voce, e tiene l'ordine dichiarato", () => {
    const org = organizationJsonLd({
      ...CONTATTI,
      knowsAbout: ["Acciaio", "Doccia", "Acciaio"],
    }) as { knowsAbout?: string[] };
    expect(org.knowsAbout).toEqual(["Acciaio", "Doccia"]);
  });

  it("ogni lingua attiva ha il suo elenco, senza vuoti e senza duplicati", () => {
    for (const locale of ACTIVE_LOCALES) {
      const voci = KNOWS_ABOUT[locale];
      expect(voci.length, `knowsAbout vuoto per ${locale}`).toBeGreaterThan(0);
      expect(new Set(voci).size, `duplicati in knowsAbout ${locale}`).toBe(voci.length);
      for (const voce of voci) expect(voce.trim(), `voce vuota in ${locale}`).not.toBe("");
    }
  });

  it("tutte le lingue dichiarano lo STESSO NUMERO di argomenti", () => {
    // Non i medesimi testi — sono traduzioni — ma la stessa lista: una lingua con
    // quattro voci e un'altra con sei vuol dire che qualcuno ne ha aggiunta una
    // di là e se n'è dimenticato di qua, e nessuno se ne accorgerebbe.
    const misure = ACTIVE_LOCALES.map((l) => KNOWS_ABOUT[l].length);
    expect(new Set(misure).size, `elenchi di lunghezza diversa: ${misure.join(", ")}`).toBe(1);
  });

  /**
   * ⚠️ **La cucina si dice con la parola del catalogo**, cioè col termine che il title di
   * `/collezioni/kitchen` rende (`collezioni.tipoBreve.cucina`), in tutte e cinque le lingue
   * (decisione di Marco, 25/09/2026). Le due stringhe vivono in due file: senza questa guardia,
   * il giorno che il catalogo cambia parola `knowsAbout` resterebbe indietro in silenzio.
   */
  it.each([...ACTIVE_LOCALES])("la voce della cucina in %s è il termine del catalogo", (l) => {
    expect(KNOWS_ABOUT[l]).toContain(MESSAGGI[l].collezioni.tipoBreve.cucina);
  });

  /**
   * ⚠️ **Lo stesso per il giardino** (collezione Spring, `collezioni.tipoBreve.giardino`). La #226
   * l'aveva tolto senza sostituto — «Rubinetteria per esterni» lo copriva — ed è tornato con la
   * #231: la guardia c'è perché la prossima riscrittura dell'elenco non lo perda di nuovo in silenzio.
   */
  it.each([...ACTIVE_LOCALES])("la voce del giardino in %s è il termine del catalogo", (l) => {
    expect(KNOWS_ABOUT[l]).toContain(MESSAGGI[l].collezioni.tipoBreve.giardino);
  });

  /**
   * ⚠️ **La frase si legge dai messaggi, non si ricopia qui.** Fino all'11/09/2026
   * questo test portava una copia letterale di `home.metaDescription`, e quella
   * copia è rimasta indietro il giorno che la frase è stata accorciata: il test
   * continuava a passare misurando un testo che il sito non serviva più. Leggendo
   * la chiave vera, la guardia vale su quello che esce davvero — ed è la stessa
   * ragione per cui `llms.txt` e `Organization` la prendono da lì invece di
   * scriversela ciascuno.
   */
  it.each([...ACTIVE_LOCALES])("la description di %s sta sotto i 300 caratteri", (l) => {
    // Il limite è quello che i consumatori troncano; sopra, la frase esce a metà.
    const org = organizationJsonLd({
      ...CONTATTI,
      description: MESSAGGI[l].home.metaDescription,
    }) as { description?: string };
    expect((org.description ?? "").length).toBeLessThan(300);
  });

  it("fra due lingue cambiano SOLO description e knowsAbout", () => {
    const chiaviDiverse = (a: Record<string, unknown>, b: Record<string, unknown>) =>
      [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
        (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
      );
    const it = siteGraphJsonLd("it", { ...CONTATTI, description: "riga italiana" })["@graph"][0];
    const en = siteGraphJsonLd("en", { ...CONTATTI, description: "english line" })["@graph"][0];
    expect(
      chiaviDiverse(it as Record<string, unknown>, en as Record<string, unknown>).sort(),
    ).toEqual(["description", "knowsAbout"]);
  });
});

describe("il grafo del sito", () => {
  it("ha un @context solo e i due nodi", () => {
    const g = siteGraphJsonLd("it", CONTATTI);
    expect(g["@context"]).toBe("https://schema.org");
    expect(g["@graph"].map((n) => n["@type"])).toEqual(["Organization", "WebSite"]);
  });

  it("resta JSON valido dopo la serializzazione", () => {
    const testo = serializzaJsonLd(siteGraphJsonLd("en", CONTATTI));
    expect(() => JSON.parse(testo.replaceAll("\\u003c", "<"))).not.toThrow();
  });
});

describe("serializzaJsonLd", () => {
  it("neutralizza il `<`, che è l'unico modo di uscire da uno script tag", () => {
    // Un titolo Sanity che contenesse `</script>` chiuderebbe il tag e il resto
    // del JSON diventerebbe markup.
    const testo = serializzaJsonLd({ headline: "Acciaio </script><img> 316" });
    expect(testo).not.toContain("</script>");
    expect(testo).not.toContain("<");
    expect(testo).toContain("\\u003c/script");
  });

  it("resta JSON valido: l'escape è dentro una stringa, non attorno", () => {
    const originale = { headline: "a < b", nested: { x: ["<y>"] } };
    expect(JSON.parse(serializzaJsonLd(originale))).toEqual(originale);
  });
});

/**
 * ⚠️ **`sameAs` afferma un'identità**: dice a Google «questi profili sono noi».
 * Per questo la metà negativa di questi test conta più dell'altra: senza profili
 * la chiave non deve comparire affatto, e un URL che non sia `https` non deve
 * passare.
 */
describe("sameAs · i profili social, quando ci sono", () => {
  const CONTATTI_SOCIAL = { telefono: AZIENDA_TELEFONO, email: AZIENDA_EMAIL };

  it("senza social la chiave NON esiste, non è un array vuoto", () => {
    const org = organizationJsonLd(CONTATTI_SOCIAL);
    expect("sameAs" in org).toBe(false);
  });

  it("con `socialLinks` nullo la chiave NON esiste", () => {
    const org = organizationJsonLd({ ...CONTATTI_SOCIAL, social: null });
    expect("sameAs" in org).toBe(false);
  });

  it("con tutti i campi vuoti la chiave NON esiste", () => {
    const org = organizationJsonLd({
      ...CONTATTI_SOCIAL,
      social: { instagram: null, linkedin: null, pinterest: null, youtube: null },
    });
    expect("sameAs" in org).toBe(false);
  });

  it("con un profilo la chiave compare, con quel solo URL", () => {
    const org = organizationJsonLd({
      ...CONTATTI_SOCIAL,
      social: { instagram: "https://instagram.com/fontealta" },
    }) as { sameAs?: string[] };
    expect(org.sameAs).toEqual(["https://instagram.com/fontealta"]);
  });

  it("l'ordine è quello fisso, non quello delle chiavi dell'oggetto", () => {
    const a = sameAsDaSocial({
      youtube: "https://youtube.com/@fontealta",
      instagram: "https://instagram.com/fontealta",
    });
    const b = sameAsDaSocial({
      instagram: "https://instagram.com/fontealta",
      youtube: "https://youtube.com/@fontealta",
    });
    expect(a).toEqual(b);
    expect(a).toEqual(["https://instagram.com/fontealta", "https://youtube.com/@fontealta"]);
  });

  it("`http` non passa: un profilo social su http non esiste più da anni", () => {
    expect(sameAsDaSocial({ instagram: "http://instagram.com/fontealta" })).toEqual([]);
  });

  it("stringhe vuote e spazi non passano, e i valori buoni vengono ripuliti", () => {
    expect(sameAsDaSocial({ instagram: "  ", linkedin: "" })).toEqual([]);
    expect(sameAsDaSocial({ instagram: "  https://instagram.com/fontealta  " })).toEqual([
      "https://instagram.com/fontealta",
    ]);
  });

  it("un profilo valido e uno rotto: passa solo quello valido", () => {
    expect(
      sameAsDaSocial({ instagram: "https://instagram.com/fontealta", linkedin: "fontealta" }),
    ).toEqual(["https://instagram.com/fontealta"]);
  });

  it("il grafo del sito porta i profili fino a `Organization`", () => {
    const grafo = siteGraphJsonLd("it", {
      ...CONTATTI_SOCIAL,
      social: { linkedin: "https://linkedin.com/company/fontealta" },
    }) as { "@graph": Array<{ sameAs?: string[] }> };
    expect(grafo["@graph"][0].sameAs).toEqual(["https://linkedin.com/company/fontealta"]);
  });
});

/**
 * ⚠️ **Un NAP è una dichiarazione di identità, e vale solo se è UNO.** Il danno
 * di questo dato non è l'assenza, è la divergenza: due indirizzi diversi per la
 * stessa azienda valgono meno di nessun indirizzo, perché chi li consuma non sa
 * quale credere. Questi test guardano che i quattro posti che lo dicono lo
 * dicano uguale, e che nessuno di essi lo prenda da una sorgente sua.
 */
describe("identità · Organization e LocalBusiness dicono lo stesso NAP", () => {
  const CONTATTI_ID = { telefono: AZIENDA_TELEFONO, email: AZIENDA_EMAIL };
  const org = organizationJsonLd(CONTATTI_ID) as Record<string, unknown>;
  const sede = localBusinessJsonLd(CONTATTI_ID) as Record<string, unknown>;

  it("il MARCHIO e la RAGIONE SOCIALE restano due cose diverse", () => {
    expect(org.name).toBe(AZIENDA_NOME);
    expect(org.legalName).toBe(AZIENDA_RAGIONE_SOCIALE);
    expect(org.name).not.toBe(org.legalName);
  });

  it("«Fontealta S.r.l.» non compare in nessuno dei due nodi", () => {
    const testo = JSON.stringify(org) + JSON.stringify(sede);
    expect(testo).not.toContain("Fontealta S.r.l.");
  });

  /**
   * ⚠️ **I valori sono scritti a mano, e la prima stesura di questo test era
   * inutile proprio perché non lo erano.** Confrontava i due nodi contro un
   * oggetto costruito da `AZIENDA_SEDE`: i due lati si muovevano insieme, e
   * cambiando il comune in «Lucca» il test restava verde. È la stessa trappola
   * già annotata per `availableLanguage`, dove `toEqual([...ACTIVE_LOCALES])`
   * passava identico a un letterale sbagliato.
   *
   * Un NAP è un **fatto sul mondo**, non un valore derivato: qui il letterale è
   * la cosa giusta, ed è l'unica forma che si accorge se qualcuno sposta la sede
   * per sbaglio.
   */
  it("l'indirizzo è quello vero, campo per campo", () => {
    const atteso = {
      "@type": "PostalAddress",
      streetAddress: "Via Libeccio 13/15",
      postalCode: "55049",
      addressLocality: "Viareggio",
      addressRegion: "LU",
      addressCountry: "IT",
    };
    expect(org.address).toEqual(atteso);
    expect(sede.address).toEqual(atteso);
  });

  it("le costanti dicono quello che i nodi dicono: una sorgente sola", () => {
    // Questa invece è la verifica della DERIVAZIONE, e sta accanto a quella dei
    // valori perché le due domande sono diverse: «è giusto?» e «viene da un
    // posto solo?». Con la sola derivazione un errore di battitura in
    // `azienda.ts` uscirebbe verde in tutti e due i nodi.
    expect((org.address as { addressLocality: string }).addressLocality).toBe(AZIENDA_SEDE.comune);
    expect((sede.address as { streetAddress: string }).streetAddress).toBe(AZIENDA_SEDE.via);
  });

  it("`addressCountry` è il codice ISO, non il nome del paese", () => {
    expect((org.address as { addressCountry: string }).addressCountry).toBe("IT");
    expect((org.address as { addressCountry: string }).addressCountry).not.toMatch(/Ital/i);
  });

  it("P.IVA, fax e fondazione sono quelli veri, scritti a mano", () => {
    expect(org.vatID).toBe("IT01718720467");
    expect(sede.vatID).toBe("IT01718720467");
    expect(org.faxNumber).toBe("+39 0584 361206");
    // La sede non lo dichiara: sulla pagina contatti non si vede (19/10/2026).
    expect("faxNumber" in sede).toBe(false);
    expect(org.foundingDate).toBe("1999");
    expect(org.legalName).toBe("Rubinetteria F & F L’Artigiana S.r.l.");
  });

  it("la P.IVA porta il prefisso paese, che `vatID` si aspetta", () => {
    expect(AZIENDA_PIVA).toMatch(/^IT\d{11}$/);
  });

  it("i due nodi hanno `@id` DIVERSI: sono due cose", () => {
    expect(org["@id"]).not.toBe(sede["@id"]);
    expect(sede["@id"]).toContain("#sede");
  });

  it("la sede si lega all'azienda per `@id`, non ripetendola", () => {
    expect(sede.parentOrganization).toEqual({ "@id": org["@id"] });
  });

  it("nessun orario e nessuna fascia di prezzo inventati", () => {
    expect("openingHours" in sede).toBe(false);
    expect("openingHoursSpecification" in sede).toBe(false);
    expect("priceRange" in sede).toBe(false);
    expect("geo" in sede).toBe(false);
  });

  it("telefono ed email arrivano dai parametri, come per Organization", () => {
    const altro = localBusinessJsonLd({ telefono: "+39 000", email: "x@y.z" }) as Record<
      string,
      unknown
    >;
    expect(altro.telephone).toBe("+39 000");
    expect(altro.email).toBe("x@y.z");
  });
});

describe("Article.author · chi firma un articolo", () => {
  const URL_PERSONA = "https://fontealta.it/chi-siamo";
  const ORG = `${siteUrl()}#organization`;

  it("autore completo: Person con jobTitle, url e sameAs", () => {
    expect(
      autoreArticoloJsonLd(
        {
          name: "Andrea Farnocchia",
          role: "Titolare",
          linkedin: "https://www.linkedin.com/in/andrea-farnocchia",
        },
        URL_PERSONA,
      ),
    ).toEqual({
      "@type": "Person",
      name: "Andrea Farnocchia",
      jobTitle: "Titolare",
      url: URL_PERSONA,
      sameAs: ["https://www.linkedin.com/in/andrea-farnocchia"],
    });
  });

  it("autore senza LinkedIn: nessuna chiave `sameAs`, non un array vuoto", () => {
    const a = autoreArticoloJsonLd({ name: "Alma Simeoli", role: "Design" }, URL_PERSONA) as Record<
      string,
      unknown
    >;
    expect("sameAs" in a).toBe(false);
    expect(a.jobTitle).toBe("Design");
  });

  it("autore senza ruolo: nessuna chiave `jobTitle`", () => {
    const a = autoreArticoloJsonLd({ name: "Andrea Farnocchia" }, URL_PERSONA) as Record<
      string,
      unknown
    >;
    expect("jobTitle" in a).toBe(false);
    expect(a.name).toBe("Andrea Farnocchia");
    // ⚠️ È lo stato di OGGI: nessun autore ha `role`, quindi l'uscita resta
    // `{ Person, name, url }` e i post non cambiano finché la Fase S non compila.
    expect(a["@type"]).toBe("Person");
  });

  it("SENZA autore: firma l'azienda, per `@id`, mai una Person inventata", () => {
    for (const vuoto of [null, undefined, {}, { name: "" }, { name: "   " }]) {
      const a = autoreArticoloJsonLd(vuoto, URL_PERSONA);
      expect(a).toEqual({ "@id": ORG });
      expect(a).not.toHaveProperty("@type");
      expect(a).not.toHaveProperty("name");
    }
  });

  it("un LinkedIn su `http` o rotto non passa: `sameAs` afferma un'identità", () => {
    for (const url of ["http://linkedin.com/in/x", "linkedin.com/in/x", "  "]) {
      const a = autoreArticoloJsonLd({ name: "X", linkedin: url }, URL_PERSONA) as Record<
        string,
        unknown
      >;
      expect("sameAs" in a, `${url} non deve passare`).toBe(false);
    }
  });

  it("il nome viene ripulito dagli spazi ai bordi", () => {
    const a = autoreArticoloJsonLd({ name: "  Andrea  " }, URL_PERSONA) as { name: string };
    expect(a.name).toBe("Andrea");
  });

  it("`url` è quello che gli passa il chiamante, non un valore inventato qui", () => {
    const a = autoreArticoloJsonLd({ name: "X" }, "https://esempio.test/pagina") as {
      url: string;
    };
    expect(a.url).toBe("https://esempio.test/pagina");
  });
});

describe("webPageJsonLd (pagine d'uso, c1b)", () => {
  const url = `${siteUrl()}/en/outdoor-shower`;
  const ld = webPageJsonLd({ locale: "en", url, name: "H1", description: "Meta" });

  it("dichiara solo ciò che la pagina dice, senza dateModified", () => {
    expect(ld).toEqual({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: "H1",
      description: "Meta",
      inLanguage: "en",
      isPartOf: { "@id": webSiteJsonLd("en")["@id"] },
      publisher: { "@id": publisherJsonLd()["@id"] },
    });
    expect(ld).not.toHaveProperty("dateModified");
  });
});

/**
 * `dateModified` dei post (Marco, 5/11/2026 sera): `revisedAt` se c'è, altrimenti `publishedAt`, mai
 * `_updatedAt`, che si muove anche per una scrittura tecnica.
 */
describe("dataModificaArticolo", () => {
  it("con la data di revisione: quella", () => {
    expect(
      dataModificaArticolo({ revisedAt: "2026-11-05", publishedAt: "2026-11-04T16:53:12Z" }),
    ).toBe("2026-11-05");
  });

  it("senza revisione: la data di pubblicazione, anche se il documento è stato toccato dopo", () => {
    const post = {
      revisedAt: null,
      publishedAt: "2026-11-04T16:53:12Z",
      _updatedAt: "2026-11-05T14:11:53Z",
    };
    expect(dataModificaArticolo(post)).toBe("2026-11-04T16:53:12Z");
  });

  it("senza nessuna delle due: niente, e il campo resta fuori dal JSON-LD", () => {
    const post = { revisedAt: null, publishedAt: null, _updatedAt: "2026-11-05T14:11:53Z" };
    expect(dataModificaArticolo(post)).toBeUndefined();
  });
});
