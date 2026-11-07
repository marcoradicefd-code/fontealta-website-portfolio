import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALES } from "@/i18n/routing";
import { siteUrl } from "@/lib/seo";
import {
  ROTTE_STATICHE,
  vociSitemap,
  type DatiSitemap,
  type VocePost,
  type VoceSanity,
} from "@/lib/sitemap";

/**
 * ⚠️ Una sitemap sbagliata non rompe niente: non fa cadere un build, non rende
 * una pagina 500, e si scopre in Search Console settimane dopo. Questi test sono
 * l'unico posto in cui il conteggio e la forma vengono guardati davvero, ed è la
 * ragione per cui l'assemblaggio è una funzione pura.
 */

/** I numeri veri del dataset al 9/09/2026, misurati sull'API di Sanity:
 *  22 documenti `collection` (di cui `corpi-a-incasso` escluso dalla query, che
 *  ne lascia 21), 595 `model`, 17 `concealedBody`, 0 `projectReference`,
 *  12 `post`. */
const COLLEZIONI = 21;
const MODELLI = 595;
const CORPI = 17;
const REFERENZE = 0;
const POST = 12;

function finti(n: number, prefisso: string, conData = true): VoceSanity[] {
  return Array.from({ length: n }, (_, i) => ({
    slug: `${prefisso}-${i}`,
    ...(conData ? { _updatedAt: "2026-09-01T10:00:00Z" } : {}),
  }));
}

/** I post hanno le date editoriali: `publishedAt` sempre, `revisedAt` mai (il caso più comune). */
function postFinti(n: number): VocePost[] {
  return Array.from({ length: n }, (_, i) => ({
    slug: `post-${i}`,
    publishedAt: "2026-09-01T10:00:00Z",
  }));
}

const DATI: DatiSitemap = {
  collections: finti(COLLEZIONI, "collezione"),
  models: finti(MODELLI, "modello"),
  bodies: finti(CORPI, "corpo"),
  references: finti(REFERENZE, "referenza"),
  posts: postFinti(POST),
};

const BASE = siteUrl();

describe("vociSitemap", () => {
  const voci = vociSitemap(DATI);

  it("conta 655 voci per lingua attiva, e la formula è scritta per intero", () => {
    // 10 rotte statiche: home, collezioni, indice corpi, produzione, finiture,
    // chi-siamo, contatti, referenze, blog, menzioni legali. Erano 11 fino al 16/09/2026,
    // con privacy e cookie separate.
    expect(ROTTE_STATICHE).toHaveLength(10);
    const perLocale = ROTTE_STATICHE.length + COLLEZIONI + CORPI + MODELLI + REFERENZE + POST;
    expect(perLocale).toBe(655);
    // ⚠️ Il prodotto e non il letterale 1312: il numero cambia con `ACTIVE_LOCALES`, e la
    // guardia a cinque lingue (`pnpm i18n:cinque-lingue`) gira questa suite con 3280.
    expect(voci).toHaveLength(perLocale * ACTIVE_LOCALES.length);
  });

  it("non contiene nessun URL duplicato", () => {
    // È l'asserzione che coglie il guasto vero di questa parte: il documento
    // `collection` con slug `corpi-a-incasso` esiste, e includerlo nel giro
    // delle collezioni produrrebbe due volte `/collezioni/corpi-a-incasso` in
    // italiano e, peggio, `/en/collections/corpi-a-incasso` in inglese, che non
    // è la pagina inglese.
    const urls = voci.map((v) => v.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("l'indice dei corpi entra una volta per locale, con l'URL inglese giusto", () => {
    const it = voci.filter((v) => v.url === `${BASE}/collezioni/corpi-a-incasso`);
    const en = voci.filter((v) => v.url === `${BASE}/en/collections/concealed-bodies`);
    expect(it).toHaveLength(1);
    expect(en).toHaveLength(1);
    expect(voci.some((v) => v.url.includes("/en/collections/corpi-a-incasso"))).toBe(false);
  });

  it("ogni URL sta sulla base del sito", () => {
    for (const v of voci) expect(v.url.startsWith(BASE)).toBe(true);
  });

  it("nessun URL verso l'area riservata", () => {
    expect(voci.some((v) => v.url.includes("/area-riservata"))).toBe(false);
    expect(voci.some((v) => v.url.includes("/pro-area"))).toBe(false);
  });

  it("ogni voce ha esattamente ACTIVE_LOCALES più x-default, e contiene se stessa", () => {
    const attese = [...ACTIVE_LOCALES, "x-default"].sort();
    for (const v of voci) {
      const languages = v.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual(attese);
      expect(Object.values(languages)).toContain(v.url);
    }
  });

  it("scrive lastModified solo dove il documento ha una data", () => {
    const conData = voci.filter((v) => v.lastModified !== undefined);
    // Le rotte statiche non hanno documento dietro: niente data inventata.
    expect(conData).toHaveLength(
      (COLLEZIONI + CORPI + MODELLI + REFERENZE + POST) * ACTIVE_LOCALES.length,
    );
    const statica = voci.find((v) => v.url === BASE);
    expect(statica?.lastModified).toBeUndefined();
  });

  it("non inventa priority e changeFrequency", () => {
    for (const v of voci) {
      expect(v.priority).toBeUndefined();
      expect(v.changeFrequency).toBeUndefined();
    }
  });
});

describe("vociSitemap, i casi di bordo del dato", () => {
  it("regge l'insieme vuoto delle referenze, che è lo stato di oggi", () => {
    // Zero documenti `projectReference` sul dataset: la pagina archivio esiste e
    // va in sitemap, le schede no. Non è un caso ipotetico, è il presente.
    const voci = vociSitemap(DATI);
    expect(voci.some((v) => v.url.includes("/referenze/"))).toBe(false);
    expect(voci.some((v) => v.url === `${BASE}/referenze`)).toBe(true);
    expect(voci.some((v) => v.url === `${BASE}/en/projects`)).toBe(true);
  });

  it("regge il dataset completamente vuoto: restano le sole rotte statiche", () => {
    const voci = vociSitemap({
      collections: [],
      models: [],
      bodies: [],
      references: [],
      posts: [],
    });
    expect(voci).toHaveLength(ROTTE_STATICHE.length * ACTIVE_LOCALES.length);
  });

  it("scarta le voci senza slug invece di pubblicare un URL monco", () => {
    // TypeGen tipa `slug` come `string | null` perché non restringe su
    // `defined()`: il null va scartato, non concatenato.
    const voci = vociSitemap({
      collections: [{ slug: null }, { slug: "boss" }],
      models: [],
      bodies: [],
      references: [],
      posts: [],
    });
    const collezioni = voci.filter((v) => v.url.includes("/collezioni/boss"));
    expect(collezioni).toHaveLength(1);
    expect(voci.some((v) => v.url.endsWith("/collezioni/"))).toBe(false);
    expect(voci).toHaveLength((ROTTE_STATICHE.length + 1) * ACTIVE_LOCALES.length);
  });
});

describe("vociSitemap, le pagine d'uso (c1b)", () => {
  const vuoti = { collections: [], models: [], bodies: [], references: [], posts: [] };
  const pagina = (titoli: unknown) =>
    vociSitemap({
      ...vuoti,
      usePages: [{ code: "outdoor-shower", _updatedAt: "2026-11-04T10:00:00Z", titoli }],
    }).filter((v) =>
      /doccia-da-esterno|outdoor-shower|gartendusche|exterieure|ducha-exterior/.test(v.url),
    );

  it("una voce per lingua col titolo, con lastmod e gli hreflang delle sole lingue presenti", () => {
    const voci = pagina({ it: "Doccia", en: "Shower", de: "  " });
    expect(voci.map((v) => v.url).sort()).toEqual(
      [`${BASE}/doccia-da-esterno`, `${BASE}/en/outdoor-shower`].sort(),
    );
    for (const v of voci) {
      expect(v.lastModified).toBe("2026-11-04T10:00:00Z");
      expect(Object.keys(v.alternates?.languages ?? {}).sort()).toEqual(["en", "it", "x-default"]);
    }
  });

  it("senza titoli la pagina non entra, e un codice sconosciuto nemmeno", () => {
    expect(pagina(null)).toEqual([]);
    expect(
      vociSitemap({ ...vuoti, usePages: [{ code: "ignota", titoli: { it: "X" } }] }),
    ).toHaveLength(ROTTE_STATICHE.length * ACTIVE_LOCALES.length);
  });
});

/**
 * Il `lastmod` dei post segue `dateModified` (Marco, 5/11/2026 sera): `revisedAt`, altrimenti
 * `publishedAt`, mai `_updatedAt`. Gli altri documenti restano su `_updatedAt`.
 */
describe("vociSitemap: il lastmod dei post", () => {
  const vuoti = { collections: [], models: [], bodies: [], references: [] };
  const lastmod = (post: VocePost & { _updatedAt?: string }) =>
    new Set(
      vociSitemap({ ...vuoti, posts: [post] })
        .filter((v) => v.url.includes("/blog/"))
        .map((v) => v.lastModified),
    );

  it("con la data di revisione: quella, in ogni lingua", () => {
    expect(
      lastmod({
        slug: "rivisto",
        publishedAt: "2026-09-01T10:00:00Z",
        revisedAt: "2026-11-05",
        _updatedAt: "2026-11-05T14:11:53Z",
      }),
    ).toEqual(new Set(["2026-11-05"]));
  });

  it("senza revisione: la pubblicazione, anche se il documento è stato toccato dopo", () => {
    expect(
      lastmod({
        slug: "mai-rivisto",
        publishedAt: "2026-11-04T16:53:12Z",
        revisedAt: null,
        _updatedAt: "2026-11-05T14:11:53Z",
      }),
    ).toEqual(new Set(["2026-11-04T16:53:12Z"]));
  });

  it("collezioni e modelli restano su _updatedAt", () => {
    const voci = vociSitemap({
      ...vuoti,
      collections: [{ slug: "boss", _updatedAt: "2026-11-05T09:00:00Z" }],
      posts: [],
    });
    expect(new Set(voci.map((v) => v.lastModified))).toEqual(
      new Set([undefined, "2026-11-05T09:00:00Z"]),
    );
  });
});
