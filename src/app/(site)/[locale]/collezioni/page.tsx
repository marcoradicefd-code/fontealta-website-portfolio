import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { CollectionCard } from "@/components/cards/collection-card";
import { HeroFade } from "@/components/hero-fade";
import { HeroScrim } from "@/components/hero-scrim";
import { HeroStatBar } from "@/components/heros/hero-stat-bar";
import { CatalogoSection } from "@/components/sections/catalogo-section";
import { ProgettareCta } from "@/components/sections/progettare-cta";
import { CollectionPageJsonLd } from "@/components/seo/collection-page-json-ld";
import type { ActiveLocale } from "@/i18n/routing";
import { getCollections, getCollectionsCount } from "@/lib/content";
import { absoluteUrl } from "@/lib/urls";
import { staticRouteMetadata } from "@/lib/route-metadata";

import { CollectionCardAnimated } from "./_components/collection-card-animated";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

/** Seconda delle due rotte che non avevano metadata propri: vedi la home. */
export const generateMetadata = staticRouteMetadata({
  namespace: "collezioni",
  href: "/collezioni",
});

const HERO_IMAGE_URL = "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=2400&q=85";

// Stats bar. Le tre stabili restano curate in i18n («500+» è un arrotondamento
// deliberato di 591 articoli, «8» le finiture, «Italy»). Il conteggio delle
// COLLEZIONI no: quello cambia, e infatti era rimasto a «21» dopo la nascita di
// Corpi a incasso. Ora arriva dal dataset — vedi sotto.

export default async function CollezioniPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "collezioni" });
  const collections = await getCollections(locale);

  // Riuso puro del loader della home (tag ["collection"] soltanto, nessun loader
  // nuovo). NIENTE `??` di riserva: il tipo generato è `number`, non nullable, e un
  // fetch fallito in build deve fallire RUMOROSAMENTE — una build rossa si vede, un
  // «21» stantio no. È la stessa lezione di `heroStat2Value`, e questa pagina ne è
  // la prova: il numero cablato è rimasto sbagliato per un giorno senza che niente
  // lo segnalasse.
  const collectionsCount = await getCollectionsCount();
  const heroStats = [
    { value: String(collectionsCount), label: t("stat1Label") },
    { value: t("stat2Value"), label: t("stat2Label") },
    { value: t("stat3Value"), label: t("stat3Label") },
    { value: t("stat4Value"), label: t("stat4Label") },
  ];

  const ordered = [...collections].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0;
  });

  /**
   * L'elenco per l'`ItemList`, costruito da `ordered`, cioè DALLA STESSA
   * collezione di dati che disegna la griglia e nello stesso ordine — non da una
   * seconda query. Due liste per la stessa cosa finiscono per dirne due diverse,
   * e un JSON-LD sbagliato non si vede navigando.
   *
   * ⚠️ **Sono 22 e non 20**, e la differenza è deliberata: `getCollectionsCount`
   * esclude i due contenitori di servizio (`corpi-a-incasso`, `accessories`)
   * perché la STATISTICA dell'hero conta le collezioni vere, ma la griglia le
   * mostra tutte e ventidue e l'elenco deve dire quello che la pagina mostra.
   * Dichiararne 20 mentre se ne vedono 22 descriverebbe una pagina che non esiste.
   *
   * `ListItem` e non `Product`: questa pagina è un elenco di collezioni, e non
   * abbiamo prezzi né misure da dichiarare. Vale la stessa decisione del
   * 10/09/2026 che li tiene fuori dal sito.
   */
  const elenco = ordered.map((c) => ({
    name: c.title ?? c.code ?? "",
    url: absoluteUrl(locale, { pathname: "/collezioni/[slug]", params: { slug: c.slug ?? "" } }),
  }));

  return (
    <>
      <CollectionPageJsonLd
        locale={locale}
        name={t("metaTitle")}
        description={t("metaDescription")}
        url={absoluteUrl(locale, "/collezioni")}
        items={elenco}
      />
      {/* SECTION 1 — Hero in stile HomeHero (immagine statica + scrim fa-ink + tipografia home) */}
      <section className="relative flex min-h-[max(560px,75vh)] flex-col overflow-hidden bg-fa-ink text-fa-white sm:min-h-[max(560px,80vh)] lg:min-h-screen">
        <div className="absolute inset-0 overflow-hidden">
          {/* ⚠️ **L'alt descrive la FOTO, non la collezione.** L'immagine è una
              veduta aerea di spiaggia e mare: nessun prodotto, nessun acciaio.
              Un alt del tipo «colonne doccia in acciaio in un ambiente esterno»
              sarebbe la descrizione di un'altra immagine, e chi la ascolta non
              ha modo di accorgersene. Se un giorno la foto cambia, questa
              stringa cambia con lei: sta nei messaggi, non qui. Il monogramma
              più in basso resta `alt=""` ed è giusto così, è decorativo. */}
          <Image
            src={HERO_IMAGE_URL}
            alt={t("heroImageAlt")}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 75% 60% at center 48%, rgba(11,18,21,0.65) 0%, rgba(11,18,21,0.4) 38%, rgba(11,18,21,0.12) 68%, transparent 88%)",
            }}
          />
          {/* Il verticale in basso (.55 all'82%, .92 in fondo) e' tolto il 22/10/2026:
              al suo posto la sfumatura degli altri hero, `HeroFade`, qui sotto.
              Lo scrim di /produzione si
              SOMMA, ma DUE passi indietro: la foto del mare e' piu' chiara di
              quella dello stabilimento e la stessa taratura la spegneva piu' del
              dovuto. Due e non tre: uno sopra il minimo che regge, per non stare
              sul filo. */}
          <HeroScrim variante="centrato" passi={-4} />
          {/* La sfumatura in fondo degli altri hero, uguale (22/10/2026). */}
          <HeroFade />
        </div>

        {/* `z-36`: il testo SOPRA lo scrim della barra (35, fisso, alto 320 px sotto `xl`) e
            sotto il pannello del menu (40). Stessa ragione di `home-hero.tsx` (22/10/2026). */}
        <div className="relative z-36 flex flex-1 flex-col justify-center px-6 pt-28 pb-16">
          <div className="fa-container w-full text-center">
            <span className="fa-eyebrow on-dark" style={{ color: "var(--fa-text-on-dark)" }}>
              {t("heroEyebrow")}
            </span>
            <h1
              className="fa-hero-h1 mx-auto mt-eyebrow-feature max-w-[16ch]"
              style={{ color: "var(--fa-text-on-dark)" }}
            >
              {t("heroH1Top")} <br />
              {t("heroH1Bot")}
            </h1>
            <p
              className="mx-auto mt-title-text-hero max-w-[560px] text-body-5 leading-lede"
              style={{ color: "var(--fa-text-on-dark)" }}
            >
              {t("heroSub")}
            </p>
          </div>
        </div>

        {/* Stat bar condivisa con la home (centrata, integrata nell'hero) */}
        <HeroStatBar stats={heroStats} />
      </section>

      {/* SECTION 2 — Archivio (griglia di TUTTE le collezioni, sfondo scuro). Niente
          numero qui: era «21» e ha smesso di essere vero senza che nessuno lo notasse.
          ⚠️ `px-6` sulla SEZIONE e non sul contenitore, come fa `.fa-section`: fino a
          settembre 2026 non c'era, e sotto 1248 px le card toccavano i bordi dello
          schermo (390 di larghezza a 390, l'80% dell'altezza). Sulla sezione il
          padding sta fuori dal `fa-container`, quindi da 1248 in su non cambia niente. */}
      <section
        id="archivio"
        className="overflow-hidden px-6"
        style={{ background: "var(--fa-ink)", color: "var(--fa-text-on-dark)" }}
      >
        <div className="fa-container py-24 lg:py-32">
          <div className="mx-auto mb-16 max-w-[680px] text-center">
            <span className="fa-eyebrow on-dark" style={{ color: "var(--fa-text-on-dark)" }}>
              {t("gridEyebrow")}
            </span>
            <h2
              className="m-0 mt-eyebrow text-display-close"
              style={{
                color: "#f6f4f0",
              }}
            >
              {t("gridH2")}
            </h2>
            <p
              className="fa-body-lg mx-auto mt-heading-intro max-w-[520px]"
              style={{ color: "var(--fa-text-on-dark)" }}
            >
              {t("gridIntro")}
            </p>
          </div>

          <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {ordered.map((c, i) => (
              <CollectionCardAnimated key={c._id} index={i}>
                <CollectionCard collection={c} locale={locale} />
              </CollectionCardAnimated>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3 — Catalogo: testo, modulo e copertina, condivisa con /contatti (19/10/2026) */}
      <CatalogoSection />

      {/* SECTION 4 — Progettare in lungo e in largo (CTA condivisa) */}
      <ProgettareCta title={t("progettareH2")} subtitle={t("progettareSub")} />
    </>
  );
}
