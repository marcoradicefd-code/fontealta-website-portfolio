"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Autoplay, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";

export interface FeaturedCarouselLabels {
  /** aria-label della freccia sinistra */
  prev: string;
  /** aria-label della freccia destra */
  next: string;
  /**
   * aria-label dei pallini, UNO PER SLIDE e già formattato.
   *
   * ⚠️ **Era una stringa sola con `{n}` dentro, sostituito qui a mano**, e per
   * arrivare fin qui col segnaposto intatto il chiamante doveva chiedere a
   * next-intl una stringa ICU **senza darle il suo argomento**: sotto `pnpm dev`
   * la home lanciava `FORMATTING_ERROR` a ogni render. Il `.replace()` era la
   * seconda metà dello stesso difetto, una formattazione fatta fuori dal
   * formattatore. Ora le etichette si compongono dove i nomi ci sono, cioè lato
   * server, e qui arrivano fatte: il pallino dice «Vai alla collezione Boss»
   * invece di «Vai alla collezione 3», che a chi ascolta serve di più.
   */
  goTo: string[];
}

/**
 * L'escape per un valore che finisce dentro un attributo HTML costruito a
 * stringa. Stessa famiglia di `serializzaJsonLd`: il markup si compone, quindi
 * il contenuto va neutralizzato prima, non dopo.
 */
function attributoHtml(valore: string): string {
  return valore
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * FeaturedCarousel (home) — coverflow 3D, SEMPRE 3 slide visibili (LOCK
 * CLAUDE.md «Homepage featured»): le slide che non sono
 * `swiper-slide-{active,prev,next}` vanno a `opacity: 0`, perche' ne'
 * mask-gradient ne' `slidesPerView` bastano — la rotazione coverflow proietta
 * le card lontane verso l'interno.
 *
 * LARGHEZZA DELLE CARD: `slidesPerView="auto"` + `width` in CSS, cioe' una
 * larghezza DECISA per breakpoint. Con `slidesPerView` numerico la larghezza
 * era il contenitore diviso quel numero, quindi cambiava a salti insieme al
 * contenitore: misurato prima del cambio, 271px a 360, **450 a 768** (la card
 * piu' grande di tutta la scala, su un tablet) e **325 a 1024** (la piu'
 * piccola sopra il telefono), cioe' un crollo di 125px attraversando un solo
 * pixel di viewport. La scala qui sotto e' monotona per costruzione: il
 * pavimento di ogni banda e' il tetto della banda precedente.
 *
 * Autoplay e transizioni spenti se l'utente ha `prefers-reduced-motion`.
 */
export function FeaturedCarousel({
  children,
  labels,
}: {
  children: ReactNode;
  labels: FeaturedCarouselLabels;
}) {
  const reducedMotion = usePrefersReducedMotion();
  // L'istanza Swiper e' un handle IMPERATIVO, non un dato di stato: sta in un
  // ref perche' la configuriamo mutandola (`params.speed`), ed e' esattamente
  // cio' per cui esistono i ref. Lo stato `pronto` serve solo a far ripartire
  // l'effetto quando l'istanza arriva.
  const swiperRef = useRef<SwiperType | null>(null);
  const [pronto, setPronto] = useState(false);

  // REDUCED-MOTION SULL'ISTANZA, non sulle prop e non da CSS. Tre misure, in
  // quest'ordine, tutte lette su `element.swiper` e non dedotte:
  //
  //  1. Le prop non bastano. `usePrefersReducedMotion` usa `useSyncExternalStore`
  //     e allo snapshot di hydration vale `false`: Swiper si inizializza con
  //     quel valore. Il cambio di prop poi aggiorna `params` — misurato
  //     `params.autoplay: false` — ma NON ferma il timer gia' avviato, quindi
  //     l'autoplay continuava a girare per un utente in reduced-motion. E'
  //     un difetto che c'era anche prima di questo giro.
  //  2. `params.speed` come prop non arrivava affatto: restava 300.
  //  3. Azzerare la durata da CSS (`transition-duration: 0ms !important` sul
  //     wrapper) e' peggio che inutile: senza transizione non arriva
  //     `transitionend`, `animating` non torna mai false e LE FRECCE SMETTONO
  //     DI RISPONDERE. Misurato: click sulla freccia, `realIndex` fermo.
  //
  // Da qui: `autoplay` si passa SEMPRE come oggetto, cosi' il modulo esiste ed
  // e' pilotabile, e lo stato lo decide questo effetto. `slideTo` rilegge
  // `params.speed` a ogni chiamata e Swiper ha un ramo dedicato a `speed === 0`.
  useEffect(() => {
    const s = swiperRef.current;
    if (!s) return;
    s.params.speed = reducedMotion ? 0 : 300;
    if (reducedMotion) s.autoplay?.stop();
    else if (!s.autoplay?.running) s.autoplay?.start();
  }, [pronto, reducedMotion]);

  // Altezza riservata: Swiper calcola la propria altezza SOLO a init client-side,
  // quindi il container cambia altezza dopo il render → la pagina cresce/cambia
  // dopo che Lenis ha misurato (bug scroll a freddo). I tre valori sono misurati
  // sulla scala di larghezze qui sotto, per difetto; il delta residuo entro-banda
  // è coperto dalla cintura ResizeObserver nel LenisProvider.
  return (
    <div className="fa-coverflow relative min-h-[505px] sm:min-h-[610px] lg:min-h-[670px]">
      <style>{`
        /* LA PROSPETTIVA SU SAFARI. Senza questa riga il coverflow nasce PIATTO
           su Safari desktop e si raddrizza solo ridimensionando la finestra:
           le card laterali escono come rettangoli stretti del 29,3% e alti
           uguale alla centrale, cioè \`rotateY(45deg)\` proiettata in ortogonale
           (0,707 = coseno di 45°) con la \`translateZ\` che non rimpicciolisce
           nulla. Non è "3D appiattito": è la \`perspective: 1200px\` di
           \`.swiper-3d\` che NON viene applicata.

           Il meccanismo, letto nel sorgente di WebKit e non in una issue: un
           livello con \`perspective\` diventa composito solo se
           \`has3DTransformedDescendant()\` è vero
           (RenderLayerCompositor::computeIndirectCompositingReason), e quel
           flag lo aggiorna RenderLayer::dirty3DTransformedDescendantStatus(),
           che dal discendente sale FINCHÉ l'antenato è \`preserve-3d\`: arriva
           qui, che è \`transform-style: flat\`, e si ferma senza marcarlo. Da
           noi il primo disegno è l'HTML del server, che non ha trasformazioni —
           le scrive Swiper dopo l'idratazione — quindi il flag nasce falso e
           resta falso. Il resize "ripara" perché i livelli si ricreano.
           Con un backing proprio la prospettiva viene applicata comunque
           (RenderLayerBacking::updateChildrenTransformAndAnchorPoint).

           ⚠️ Provato su Safari vero con quattro scene identiche in cui cambiava
           solo QUANDO arriva il 3D: col 3D già nell'HTML si vede, aggiunto dopo
           800 ms no, e torna a vedersi sia con \`will-change: transform\` sia con
           \`transform: translateZ(0)\` sul contenitore. ⛔ Il WebKit che Playwright
           installa non dipinge la prospettiva nemmeno nel caso di controllo,
           quindi da lì non si misura: la guardia automatica è STRUTTURALE.
           ⚠️ E non c'entrano \`Reveal\` né la section con \`overflow: hidden\`:
           sono raggruppamenti da specifica, identici su Chrome, dove il
           carosello è sempre stato giusto.

           Costo: un livello composito, per il solo carosello. */
        .fa-coverflow .swiper { will-change: transform; }

        /* Le 3 centrali visibili, le altre spente: è il LOCK. */
        .fa-coverflow .swiper-slide { opacity: 0; transition: opacity var(--dur-standard) var(--ease-out-expo); }
        .fa-coverflow .swiper-slide-active,
        .fa-coverflow .swiper-slide-prev,
        .fa-coverflow .swiper-slide-next { opacity: 1; }

        /* Larghezza DECISA, non derivata dal contenitore. Monotona: il pavimento
           di ogni banda è il tetto della precedente, così non esiste un viewport
           in cui la card rimpicciolisce crescendo lo schermo. */
        .fa-coverflow .swiper-slide { width: clamp(260px, 76vw, 330px); }
        @media (min-width: 640px)  { .fa-coverflow .swiper-slide { width: clamp(330px, 44vw, 370px); } }
        @media (min-width: 1024px) { .fa-coverflow .swiper-slide { width: clamp(370px, 29vw, 384px); } }

        /* Pallini: uno per card. Con coverflow centrato NON esistono "pagine" —
           ogni scatto avanza di una card e ognuna può diventare attiva, quindi
           un pallino per pagina sarebbe un'astrazione senza referente. */
        .fa-coverflow .swiper-pagination { position: static; margin-top: calc(var(--spacing) * 7); display: flex; justify-content: center; gap: var(--spacing); }
        /* Classe SOLO del carosello (set 2026): prima era la stessa dei
           pallini delle finiture. Da quella il pallino riceveva due sole
           cose, misurate togliendo la classe dal vivo — la transizione e lo
           scale in hover — e sono le due righe qui sotto. 26px e ombra interna
           no: li battevano questa regola e Swiper. Lo scale in hover è la
           collisione annotata il 17/09: resta finché non si decide a parte. */
        .fa-coverflow .fa-coverflow-dot {
          width: 24px; height: 24px; padding: 0; border: 0; background: none;
          display: grid; place-items: center; cursor: pointer;
          transition: transform var(--dur-sheet) ease;
        }
        .fa-coverflow .fa-coverflow-dot:hover { transform: scale(1.15); }
        .fa-coverflow .fa-coverflow-dot::before {
          content: ""; width: 8px; height: 8px; border-radius: var(--radius-pill);
          border: var(--fa-stroke-hairline) solid rgb(255 255 255 / .55); background: transparent;
          transition: background-color var(--dur-micro), border-color var(--dur-micro);
        }
        /* Il pallino è un controllo: bianco puro, come il bordo dei pallini spenti (token, Fase 2). */
        .fa-coverflow .fa-coverflow-dot.swiper-pagination-bullet-active::before {
          background: var(--fa-paper); border-color: var(--fa-paper);
        }
        .fa-coverflow .fa-coverflow-dot:focus-visible { outline: 2px solid var(--fa-paper); outline-offset: 2px; border-radius: 4px; }
        /* Swiper spegne i pallini inattivi a opacità .2 di suo (--swiper-pagination-bullet-inactive-opacity):
           moltiplicata sul bordo al 55%, il pallino misurava 1,33:1 sul fondo, sotto il 3:1 di WCAG 1.4.11.
           A opacità piena il bordo misura 6,19:1; l'attivo resta distinto perché è pieno. */
        .fa-coverflow .swiper-pagination-bullet { opacity: 1; }
        ${
          reducedMotion
            ? `
        /* reduced-motion: niente dissolvenze NOSTRE. Lo scorrimento lo azzera
           l'effetto qui sopra scrivendo \`params.speed\`, non una regola sul
           wrapper: quella romperebbe la macchina a stati di Swiper. */
        .fa-coverflow .swiper-slide { transition: none; }
        .fa-coverflow .fa-coverflow-dot::before { transition: none; }
        `
            : ""
        }
      `}</style>
      <Swiper
        onSwiper={(s) => {
          swiperRef.current = s;
          setPronto(true);
        }}
        modules={[EffectCoverflow, Autoplay, Pagination]}
        effect="coverflow"
        grabCursor
        centeredSlides
        loop
        // ⚠️ RICALCOLO: delle quattro opzioni che lo governano, due erano spente
        // e due accese — letto da `swiper.params` sul sito servito, non dai
        // documenti: `resizeObserver` e `updateOnWindowResize` sono `true` di
        // default in Swiper 12 e 14 (la 14 riletta nel sorgente il 26/10/2026),
        // `observer` e `observeParents` sono `false`.
        // Queste due accendono l'osservatore sulle MUTAZIONI del DOM, cioè il
        // caso in cui il carosello nasce mentre il suo contenitore non ha
        // ancora la misura definitiva. Marco riporta su Safari un carosello
        // «piatto alla nascita, che si sistema ridimensionando la finestra».
        // ⚠️ Non è la cura dimostrata: misurata la `matrix3d` delle slide subito
        // dopo il load e dopo un resize, su Chromium e su WebKit, a 1440 e a
        // 390, è **identica** — quindi le misure di Swiper all'init sono già
        // giuste qui, e quello che il resize cambia è la PITTURA. Queste due
        // opzioni coprono il caso in cui, su una rete vera e con le foto che
        // arrivano tardi, l'init capiti davvero su misure acerbe.
        observer
        observeParents
        slidesPerView="auto"
        spaceBetween={0}
        coverflowEffect={{ rotate: 45, stretch: 0, depth: 240, modifier: 1, slideShadows: true }}
        autoplay={{ delay: 3500, disableOnInteraction: false }}
        pagination={{
          clickable: true,
          bulletClass: "fa-coverflow-dot swiper-pagination-bullet",
          bulletActiveClass: "swiper-pagination-bullet-active",
          // I pallini nascono come <button>: sono comandi, quindi devono essere
          // raggiungibili da tastiera e annunciati come tali. Lo <span> di serie
          // non lo è, nemmeno con `clickable`.
          // ⚠️ L'etichetta finisce dentro una STRINGA DI HTML, quindi va
          // sfuggita: i nomi arrivano da Sanity, e un apice doppio chiuderebbe
          // l'attributo. Col vecchio `{n}` il valore era un numero e la
          // questione non si poneva.
          renderBullet: (index, className) =>
            `<button type="button" class="${className}" aria-label="${attributoHtml(
              labels.goTo[index] ?? labels.goTo[0] ?? "",
            )}"></button>`,
        }}
        className="!overflow-visible !py-8"
      >
        {Children.map(children, (child) => (
          <SwiperSlide className="!h-auto">{child}</SwiperSlide>
        ))}
      </Swiper>

      {/* Frecce: visibili SEMPRE, touch compreso. Prima erano `hidden sm:flex`,
          cioè assenti sotto 640 — il difetto segnalato. La visibilità non è
          legata a `hover`, e non deve tornare a esserlo.
          Pastiglia da 44×44 (bersaglio tattile) con fondo ink .72: a 640 e 768
          la freccia cade sopra la FOTO della card e senza fondo misurava
          1,76:1 e 2,14:1, sotto il 3:1 di WCAG 1.4.11.
          Nessuno stato disabilitato: `loop` è attivo, gli estremi non esistono.
          STATI E CURVA DEL BUTTON (set 2026, Marco): hover col velo bianco al 10%
          del secondario su scuro, pressione a .97 come le pill blu, 300 ms con la
          stessa curva, anello di focus bianco come il Button su fondo scuro (era oro
          fino al 20/10/2026). Prima
          l'hover passava l'inchiostro da .72 a .88: sulla sezione scura i due colori
          erano identici, e l'hover non si vedeva. Il velo si SOMMA al fondo invece
          di sostituirlo, così sopra la foto il contrasto della pastiglia resta.
          ⚠️ IL VELO È UN'OMBRA INTERNA, non un gradiente (giro 2 di Marco): i gradienti
          non si animano, quindi comparivano e sparivano di colpo. Un'ombra `inset` si
          dipinge sopra il fondo e sotto la freccia, come il velo, e SI anima.
          ⚠️ AL TOCCO NON C'È HOVER: Tailwind v4 chiude `hover:` in `(hover: hover)`, e su
          iPhone la freccia sembrava morta (solo scala .97, misurata). Lo stato del tocco è
          `:active`, con lo stesso velo: acceso in 0 ms (`active:duration-0`) e spento coi
          300 ms della transizione a riposo, così anche un tocco da 40 ms resta visibile.
          TAGLIA: M (44) sotto `lg`, L (48) da 1024, dai token dei bottoni.
          TRACCIA: 1 px col colore delle card e dei CTA outline, `--fa-stroke-color` (era bianco
          al 25%); i 3 px restano ai soli CTA outline, deciso da Marco a video. La pastiglia
          resta: il bordo non basta sopra la foto. */}
      <button
        type="button"
        aria-label={labels.prev}
        onClick={() => swiperRef.current?.slidePrev()}
        className="fa-carousel-arrow absolute top-1/2 left-0 z-10 flex size-(--btn-height-m) -translate-y-1/2 items-center justify-center rounded-full border-(length:--fa-stroke-hairline) border-(--fa-stroke-color) bg-fa-ink-72 text-white transition-all duration-(--dur-control) hover:shadow-[inset_0_0_0_100px_var(--fa-veil-hover-dark)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--fa-stroke-color) active:scale-[0.97] active:shadow-[inset_0_0_0_100px_var(--fa-veil-hover-dark)] active:duration-0 lg:-left-5 lg:size-(--btn-height-l)"
      >
        <ChevronLeft size={22} strokeWidth={1.75} aria-hidden className="lg:size-6" />
      </button>
      <button
        type="button"
        aria-label={labels.next}
        onClick={() => swiperRef.current?.slideNext()}
        className="fa-carousel-arrow absolute top-1/2 right-0 z-10 flex size-(--btn-height-m) -translate-y-1/2 items-center justify-center rounded-full border-(length:--fa-stroke-hairline) border-(--fa-stroke-color) bg-fa-ink-72 text-white transition-all duration-(--dur-control) hover:shadow-[inset_0_0_0_100px_var(--fa-veil-hover-dark)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--fa-stroke-color) active:scale-[0.97] active:shadow-[inset_0_0_0_100px_var(--fa-veil-hover-dark)] active:duration-0 lg:-right-5 lg:size-(--btn-height-l)"
      >
        <ChevronRight size={22} strokeWidth={1.75} aria-hidden className="lg:size-6" />
      </button>
    </div>
  );
}
