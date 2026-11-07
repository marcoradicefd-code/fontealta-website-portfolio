import { getTranslations } from "next-intl/server";

import { HeroFade } from "@/components/hero-fade";
import { HeroMediaBg } from "@/components/heros/hero-media-bg";
import { HeroStatBar } from "@/components/heros/hero-stat-bar";
import { Button } from "@/components/ui/button";
import type { ActiveLocale } from "@/i18n/routing";
import { getCollectionsCount, getSiteSettings } from "@/lib/content";
import { urlFor } from "@/sanity/lib/image";

interface HomeHeroProps {
  locale: ActiveLocale;
}

// Poster fallback finché `siteSettings.homeHeroPoster` non è popolato (M5, asset
// di Alma). ⚠️ Non è più il segnaposto Unsplash: è il **fotogramma a
// `VIDEO_INIZIO` secondi del video hero**, estratto con ffmpeg dal mp4 servito da
// media.fontealta.it. Deve essere il fotogramma da cui il video PARTE: come
// `poster` del `<video>` coincide con quello che il video dipinge per primo, quindi
// il passaggio poster → video non si vede. È la ragione per cui il lampo che il fix
// di giugno aveva tolto non torna: quello era una foto di stock estranea al video.
// Fino al 22/10/2026 era il fotogramma a 0 s, con la colonna al 70% della larghezza:
// sotto `sm` il ritaglio centrale la lasciava fuori. A 8,5 s c'è la colonna blu al
// 62%, dentro il ritaglio di mobile e a destra del titolo (Marco, 22/10/2026).
//
// ⚠️ **1024×576 q72, 48 KB, e il PESO è la taratura, non la larghezza.** Misurato
// con Lighthouse mobile, tre run per configurazione, mediana dell'LCP: senza
// poster 4598 ms · 1920q55 da 116 KB **4982**, cioè PEGGIO del niente · 1280q70
// da 76 KB 3390 · 1024q72 da 53 KB **2865** · 800q75 da 36 KB 2602. Sotto rete
// lenta il poster è sul percorso critico e si paga a byte: un poster grande
// sposta l'attesa dalla decodifica del video al suo stesso download. Se qualcuno
// lo rigenera più grande «per qualità», l'LCP peggiora e non lo dirà nessuno.
//
// Quando Alma carica il poster di brand su Sanity, quello vince: se sarà
// un'immagine diversa dal video, il lampo va rivalutato allora, e va rivalutato
// anche il peso, perché `urlFor` lo serve a 2400 px.
const HERO_POSTER_FALLBACK = "/hero-poster.webp";

/** Il secondo da cui parte il video di Sanity, lo stesso del poster (`#t=` delle
 *  sorgenti; finito il primo giro, `loop` riparte da 0). Il video locale di riserva è
 *  un altro filmato e parte da 0. Si cambia insieme al poster, mai da solo. */
const VIDEO_INIZIO = 8.5;
const daInizio = (url: string | null | undefined) => (url ? `${url}#t=${VIDEO_INIZIO}` : null);

// Video fallback locale (public/) finché siteSettings.homeHeroVideoUrl/Mp4Url non
// puntano a Cloudflare R2 (M5). Ottimizzato 720p H.264 faststart, no audio (~1MB).
const HERO_VIDEO_FALLBACK = "/video/home-hero.mp4";

const INK = "11, 18, 21";

/**
 * SCRIM DELLA HOME: direzionale sulla fascia del testo, senza base sopra il video
 * (set 2026, decisione di Marco dopo averla vista a video).
 *
 * Marco vedeva un velo uniforme su tutta la foto. Misurato a 1440, alfa mediana per
 * zona: un radiale centrato (.36 al centro) spegneva colonna e piscina, e il vecchio
 * verticale in basso (.42) si sommava a `HeroFade` portando la metà bassa oltre .8 su
 * tutta la larghezza; in alto a destra restava .16, in basso a destra .74. Tolti il
 * radiale e, da `sm`, il verticale: resta il direzionale qui sotto più `HeroFade`.
 *
 * Da `sm`: ORIZZONTALE, pieno fino alla fine del testo e poi a zero in 24 punti con
 * quattro fermi, non due, così la caduta non disegna una riga. La fine del testo è il
 * bordo sinistro del contenitore più 600 px (il blocco è largo al massimo 560):
 * `max(24px, 50% - 600px)` è quel bordo a ogni larghezza, quindi a 1440 il pieno
 * finisce al 50% e lo zero cade al 74%, a 1024 il testo occupa di più e il pieno va
 * più in là. Il picco è .60 e non lo .55 proposto: con .55 l'occhiello, sul cielo,
 * scendeva a 4,10 sul fotogramma peggiore; con .60 sta a 4,86, l'H1 a 4,74 e il
 * paragrafo a 5,12 (punto più chiaro sotto ogni riga, quattro fotogrammi).
 *
 * ⚠️ Sostituisce il diagonale H2 (100°, .60 fino al 12%, .38 al 35%, 0 al 60%), che
 * da solo non spegneva la destra: il velo lo facevano gli altri due strati.
 */
const FINE_TESTO = "calc(max(24px, 50% - 600px) + 600px)";
const HERO_TESTO = `linear-gradient(90deg, rgba(${INK},0.6) 0%, rgba(${INK},0.6) ${FINE_TESTO}, rgba(${INK},0.48) calc(${FINE_TESTO} + 6%), rgba(${INK},0.26) calc(${FINE_TESTO} + 13%), rgba(${INK},0.09) calc(${FINE_TESTO} + 19%), rgba(${INK},0) calc(${FINE_TESTO} + 24%))`;

/** Sotto `sm` il testo copre tutta la larghezza e l'orizzontale non ha senso: al suo
 *  posto una FASCIA VERTICALE ancorata al blocco, piena sul blocco e in dissolvenza per
 *  il 35% della sua altezza sopra e sotto, con un fermo a metà di ogni coda. Ancorata
 *  al blocco e non all'hero, così segue il testo se il copy cambia lunghezza. Dal
 *  22/10/2026 il blocco è titolo e bottone (niente occhiello, e sotto `sm` niente
 *  paragrafo): a 390, col poster a 8,5 s, l'H1 sta a 5,83 sul punto più chiaro del
 *  fondo (`hero-sopra-scrim.spec.ts`). Prima: occhiello 7,92, H1 5,82, paragrafo 5,00.
 *  Il verticale in basso resta SOLO qui: a 390 le etichette delle statistiche stanno
 *  dal 75% dell'altezza, dove `HeroFade` da sola vale circa .44, e senza il verticale
 *  «Dal» scendeva a 3,69; con il verticale sta a 7,10. */
const FASCIA_PICCO = 0.6;
/** Sopra il blocco la fascia sale per 0,9 volte la sua altezza, non 0,35 (Marco,
 *  22/10/2026): col blocco ridotto a titolo e bottone, a 0,35 partiva a 94 px e lasciava
 *  chiaro il fondo sotto la barra, e la dissolvenza fra scrim e barra si accendeva di
 *  +4,0 livelli scendendo (`barra-scorrimento.spec.ts`, tolleranza 3). Su `main`, col
 *  blocco alto, partiva a 10 px. A 0,9 parte dalla cima dell'hero a 360 e a 390. */
const FASCIA_SOPRA = 0.9;
const FASCIA_SOTTO = 0.35;
const fermoFascia = (x: number) => `${((100 * x) / (1 + FASCIA_SOPRA + FASCIA_SOTTO)).toFixed(2)}%`;
const FASCIA_TESTO_MOBILE = `linear-gradient(180deg, rgba(${INK},0) 0%, rgba(${INK},${FASCIA_PICCO / 2}) ${fermoFascia(FASCIA_SOPRA / 2)}, rgba(${INK},${FASCIA_PICCO}) ${fermoFascia(FASCIA_SOPRA)}, rgba(${INK},${FASCIA_PICCO}) ${fermoFascia(FASCIA_SOPRA + 1)}, rgba(${INK},${FASCIA_PICCO / 2}) ${fermoFascia(FASCIA_SOPRA + 1 + FASCIA_SOTTO / 2)}, rgba(${INK},0) 100%)`;

/**
 * Hero homepage — full-bleed dark col video, H1 «Acciaio / e Colore.», paragrafo (da
 * `sm`), bottone, stat bar 4 voci. Senza occhiello dal 22/10/2026.
 *
 * Foto hero: nessun documento Sanity dedicato → placeholder Unsplash (M5 asset Andrea).
 * Stat bar: valori statici/derivati (vedi spec §9). 21 e Articoli passati come prop dal parent.
 */
export async function HomeHero({ locale }: HomeHeroProps) {
  const t = await getTranslations({ locale, namespace: "home" });
  const settings = await getSiteSettings(locale);

  // Poster: immagine Sanity nativa (pipeline WebP/AVIF) se popolata, altrimenti fallback.
  const poster = settings?.homeHeroPoster;
  const posterSrc =
    (poster ? urlFor(poster)?.width(2400).quality(82).url() : undefined) ?? HERO_POSTER_FALLBACK;

  // Video: Sanity (R2) ha precedenza; se entrambi i campi sono vuoti → fallback locale.
  const hasSanityVideo = Boolean(settings?.homeHeroVideoUrl || settings?.homeHeroVideoMp4Url);
  const videoWebmUrl = daInizio(settings?.homeHeroVideoUrl);
  const videoMp4Url =
    daInizio(settings?.homeHeroVideoMp4Url) ?? (hasSanityVideo ? null : HERO_VIDEO_FALLBACK);

  // Stat bar Hero — 4 voci. «Anni», «Articoli» e «Made in» restano statici per
  // decisione; «Collezioni» è l'unico numero che il sito può sapere da sé, quindi
  // lo legge dal dataset invece che da una stringa i18n che nessuno ricorda di
  // aggiornare quando nasce una collezione.
  //
  // NESSUN fallback, deliberatamente. `count()` non ritorna mai null (il tipo
  // generato è `number`, non nullable) e un fetch fallito in build deve fallire
  // RUMOROSAMENTE: una build rossa si vede, un «21» stantio no. La vecchia chiave
  // `heroStat2Value` è stata rimossa dall'i18n per lo stesso motivo — sopravvivere
  // come rete l'avrebbe resa un secondo valore autorevole, libero di divergere.
  const collectionsCount = await getCollectionsCount();
  const stats = [
    { value: t("heroStat1Value"), label: t("heroStat1Label") },
    { value: String(collectionsCount), label: t("heroStat2Label") },
    { value: t("heroStat3Value"), label: t("heroStat3Label") },
    { value: t("heroStat4Value"), label: t("heroStat4Label") },
  ];

  return (
    <section className="relative flex min-h-[max(560px,75vh)] flex-col overflow-hidden bg-fa-ink text-fa-white sm:min-h-[max(560px,80vh)] lg:min-h-screen">
      {/* Background image + multi-scrim per leggibilità (pattern collezioni/page.tsx) */}
      <div className="absolute inset-0 overflow-hidden">
        <HeroMediaBg
          posterSrc={posterSrc}
          videoWebmUrl={videoWebmUrl}
          videoMp4Url={videoMp4Url}
          priority
        />
        {/* Nessuna base sopra il video (vedi HERO_TESTO). Il verticale in basso resta
            solo sotto `sm`, per le etichette delle statistiche. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 sm:hidden"
          style={{
            background:
              "linear-gradient(180deg, transparent 55%, rgba(11,18,21,0.55) 82%, rgba(11,18,21,0.92) 100%)",
          }}
        />
        {/* Il direzionale sulla fascia del testo, da `sm`. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden sm:block"
          style={{ background: HERO_TESTO }}
        />
        {/* La sfumatura di /finiture verso l'inchiostro della sezione dopo (set 2026). */}
        <HeroFade />
      </div>

      {/* Contenuto hero. `z-36`: SOPRA lo scrim della nav (35, fisso, alto 320 px sotto
          `xl`), che fino al 22/10/2026 scuriva l'H1 da 360 a 1279 px di larghezza;
          sotto il pannello del menu (40) e la barra (50), che restano sopra al testo. */}
      <div className="relative z-36 flex flex-1 flex-col justify-center px-6 pt-28 pb-16">
        <div className="fa-container w-full text-left">
          {/* BLOCCO: testo + CTA. `w-fit` perche' i figli sono blocchi e
              riempirebbero tutta la fa-container. Nessun riflusso: la larghezza
              risultante e' quella del paragrafo, e le righe dell'H1 sono piu' corte.
              Sotto `sm` il paragrafo non c'e' e il blocco prende tutta la larghezza:
              largo quanto l'H1, il bottone centrato su di lui non sarebbe centrato
              sullo schermo. */}
          <div className="relative isolate w-full sm:w-fit">
            {/* Sotto `sm` l'orizzontale e' la forma sbagliata: il testo occupa
              tutta la larghezza. Al suo posto la fascia verticale ancorata al
              BLOCCO intero, titolo e bottone (vedi FASCIA_TESTO_MOBILE): fino al
              22/10/2026 stava sul solo testo e il bottone restava sulla foto chiara.
              `isolate` + `-z-10` la tengono dietro al blocco senza rimandarla anche
              dietro alla foto. */}
            <div
              aria-hidden="true"
              className="absolute -right-6 -left-6 -z-10 sm:hidden"
              style={{
                top: `-${FASCIA_SOPRA * 100}%`,
                bottom: `-${FASCIA_SOTTO * 100}%`,
                background: FASCIA_TESTO_MOBILE,
              }}
            />
            <div className="relative">
              {/* Niente occhiello sopra il titolo (22/10/2026): l'H1 apre il blocco.
                  Sotto `sm` è centrato come il bottone (Marco, 22/10/2026). */}
              <h1
                className="fa-hero-h1 mx-auto max-w-[16ch] text-center sm:mx-0 sm:text-left"
                style={{ color: "var(--fa-text-on-dark)" }}
              >
                {t("heroH1Top")} <br />
                {t("heroH1Bot")}
              </h1>
              {/* Sotto `sm` il paragrafo non si mostra, ma resta nell'HTML (22/10/2026). */}
              <p
                className="mt-title-text-hero hidden max-w-[560px] text-body-5 leading-lede sm:block"
                style={{ color: "var(--fa-text-on-dark)" }}
              >
                {t("heroSub")}
              </p>
            </div>
            {/* Sotto `sm` il bottone si centra e il testo resta a sinistra (set
                2026, Marco): stessa regola del teaser «Chi siamo» e del catalogo. */}
            <div className="relative mt-text-action text-center sm:text-left">
              <Button href="#progettare" variant="primary" size="l" dark>
                {t("heroProjectCta")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat bar condivisa con /collezioni (centrata, integrata nell'hero) */}
      <HeroStatBar stats={stats} />
    </section>
  );
}
