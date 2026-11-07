"use client";

import Image from "next/image";
import { imageLoader } from "next-sanity/image";
import ReactDOM from "react-dom";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

interface HeroMediaBgProps {
  /** URL poster già risolto (Sanity urlFor o fallback). Sempre renderizzato: LCP, poster del video e stato reduced-motion. */
  posterSrc: string;
  /** Source video R2 (webm e/o mp4). Basta uno solo dei due. */
  videoWebmUrl?: string | null;
  videoMp4Url?: string | null;
  /** Poster priority per hero above-the-fold (LCP). */
  priority?: boolean;
}

/**
 * Il poster arriva gia' risolto in stringa e puo' venire da DUE posti: `urlFor()`
 * su Sanity, oppure il fallback Unsplash quando il campo e' vuoto. Solo il primo
 * puo' passare da `imageLoader`, che costruisce un URL con la grammatica del CDN
 * di Sanity. Sull'altro si resta sull'ottimizzatore di Vercel — un loader
 * indiscriminato e' esattamente il modo di rompere in silenzio le sorgenti che
 * non sono Sanity.
 */
const isSanityCdn = (url: string) => url.startsWith("https://cdn.sanity.io/");

/** Tipo MIME dedotto dall'estensione URL (robusto se un mp4 sta nel campo "webm" e viceversa). */
function sourceType(url: string): string | undefined {
  if (/\.webm(\?|#|$)/i.test(url)) return "video/webm";
  if (/\.mp4(\?|#|$)/i.test(url)) return "video/mp4";
  return undefined;
}

/**
 * HeroMediaBg — sfondo hero condiviso (home + collezioni). Cascata graceful:
 *  - base scura brand (#0b1215, fa-ink) SEMPRE → placeholder sotto tutto;
 *  - video presente E motion ok → `<video autoPlay muted loop poster>` sopra la base;
 *  - reduced-motion oppure nessun video → `<Image>` poster (still) sopra la base.
 *
 * ⚠️ **Il `poster` sul video c'è, e la nota di giugno che diceva il contrario è
 * SUPERATA, non ignorata.** Il fix `4e15163` («remove jarring image flash during
 * client navigation») tolse il poster perché quello che lampeggiava era una foto
 * ESTRANEA al video: il segnaposto Unsplash della home. Oggi il poster di ogni
 * hero con video è un fotogramma del PROPRIO video, quindi poster e primo frame
 * sono la stessa immagine e non c'è nessuna transizione da vedere. Misurato:
 * `/hero-poster.webp` è il frame a t=0 del video home; il
 * `chi-siamo/hero-poster.webp` già committato sta a **SSIM 0,953** dal frame a
 * t=0 del suo video. Se un giorno qualcuno popola `homeHeroPoster` su Sanity con
 * un'immagine di brand DIVERSA dal video, il lampo torna: è quello il caso da
 * guardare, non il poster in sé.
 *
 * Perché è stato rimesso: senza poster l'elemento LCP della home era il `<video>`
 * e l'LCP misurava **6077,8 ms** su mobile, di cui 5298 ms di solo render delay,
 * cioè attesa della decodifica. Un poster dà al browser un'immagine dipingibile
 * subito.
 *
 * `preload="metadata"` e non `"auto"`: con `"auto"` il video si prendeva ~4,7 MB
 * di banda prima del primo paint, in concorrenza col poster che è l'LCP.
 * Funziona anche con un solo URL compilato (l'altro vuoto → niente `<source>`).
 * Da posizionare in un contenitore `relative`/`absolute inset-0` (usa `fill`).
 */
export function HeroMediaBg({ posterSrc, videoWebmUrl, videoMp4Url, priority }: HeroMediaBgProps) {
  const reducedMotion = usePrefersReducedMotion();

  const sources = [videoWebmUrl, videoMp4Url].filter((u): u is string => Boolean(u));
  const showVideo = sources.length > 0 && !reducedMotion;

  // Preload del poster SOLO nel ramo video. Nell'altro ramo il poster lo dipinge
  // `<Image priority>`, che il suo preload lo emette già da sé: chiederlo due
  // volte significherebbe due `<link>` per la stessa risorsa. Qui invece il
  // poster è un ATTRIBUTO di `<video>`, e per quello il browser non alza la
  // priorità da solo. La condizione è `sources.length`, non `showVideo`, perché
  // `usePrefersReducedMotion` vale `false` allo snapshot di hydration e il
  // server deve emettere lo stesso markup del client.
  if (priority && sources.length > 0) {
    ReactDOM.preload(posterSrc, { as: "image", fetchPriority: "high" });
  }

  return (
    <>
      {/* Base scura brand: sta sotto a tutto e copre l'istante prima che il
          poster sia decodificato, più il caso in cui il poster non arrivi. */}
      <div className="absolute inset-0" style={{ backgroundColor: "#0b1215" }} aria-hidden />
      {/* `<Image>` SOLO quando NON si riproduce il video (reduced-motion o nessuna
          source — es. CollectionHero senza heroVideo). Col video la stessa
          immagine arriva dall'attributo `poster`, quindi montarla due volte
          sarebbe una richiesta in più per lo stesso file. */}
      {!showVideo && (
        <Image
          src={posterSrc}
          // `undefined` = loader di default, cioe' /_next/image. Vedi `isSanityCdn`.
          loader={isSanityCdn(posterSrc) ? imageLoader : undefined}
          alt=""
          fill
          priority={priority}
          sizes="100vw"
          aria-hidden
          className="object-cover"
        />
      )}
      {showVideo && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc}
          aria-hidden
          tabIndex={-1}
          // object-center: su portrait il cover taglia la larghezza; i soggetti
          // (colonne doccia) sono centrati nel video home → crop centrato li tiene in frame.
          className="absolute inset-0 h-full w-full object-cover object-center"
        >
          {sources.map((url) => (
            <source key={url} src={url} type={sourceType(url)} />
          ))}
        </video>
      )}
    </>
  );
}
