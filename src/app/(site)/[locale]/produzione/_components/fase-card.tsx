"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useState, type CSSProperties } from "react";

export interface Fase {
  /** Numero mostrato in card, due cifre ("01"…"09"). Decorativo. */
  n: string;
  title: string;
  spec: string;
  paragraphs: string[];
  image: StaticImageData;
  alt: string;
}

interface FaseCardProps {
  fase: Fase;
  index: number;
  /** Stato VISIBILE: persistente oppure transitorio (hover/focus). */
  open: boolean;
  /** `(hover: hover)`: l'hover e' un'aggiunta, non un ramo alternativo. */
  hoverDisponibile: boolean;
  reduceMotion: boolean;
  /** Click / Enter / Space: rende l'apertura persistente, o la toglie. */
  onToggle: (index: number) => void;
  /** Hover: apertura e chiusura ritardate, gestite dall'accordion. */
  onHoverEntra: (index: number) => void;
  onHoverEsce: (index: number) => void;
  /** Focus di tastiera: senza ritardo. */
  onFocusEntra: (index: number) => void;
  onFocusEsce: (index: number) => void;
}

/** Apertura e chiusura hanno ORA la stessa curva e la stessa durata, quella di
 *  `--dur-reveal` (token, Fase 2, 23/10/2026: l'apertura era 580): con 400 ms
 *  contro 580 la card sottostante risaliva di scatto. */
const APERTURA_MS = 600;
const CHIUSURA_MS = 600;
/** Entrata della zona del testo, DOPO l'apertura (vedi `.fa-card-testo`): è
 *  `--dur-sheet` (token, Fase 2, 23/10/2026: era 240). */
const FILTRO_MS = 250;

const INK = "11, 18, 21";
/** Verticale di base: identico in ogni stato e a ogni breakpoint. */
const SCRIM_VERTICALE = `linear-gradient(180deg, rgba(${INK},0.60) 0%, rgba(${INK},0.34) 30%, rgba(${INK},0.46) 70%, rgba(${INK},0.86) 100%)`;

/** Diagonale: scuro a sinistra (titolo e testo), piu' chiaro a destra (numero).
 *  I quattro fermi arrivano da custom property, cosi' possono cambiare per
 *  breakpoint: su desktop il testo sta a sinistra e la meta' destra puo' restare
 *  leggera, su mobile occupa tutta la card e serve scuro ovunque. Valori in
 *  `FERMI_SCRIM` sotto. Il verticale non dipende dal breakpoint.
 *
 *  ⚠️ STATICO: identico da chiusa e da aperta, stessi fermi e stessa opacita'.
 *  Aprire una card non cambia PIU' NIENTE della fotografia — aperta e' chiusa
 *  piu' la zona del testo, e basta. Decisione di Marco sul preview, 8 settembre.
 *
 *  ⚠️ C'era una seconda variante per lo stato aperto, in dissolvenza incrociata
 *  con questa, ed e' rimossa. Le due erano quasi uguali a sinistra (.95 contro
 *  .97) e la CHIUSA e' piu' scura a destra (.30/.24 contro .18/.14): scambiarle
 *  rendeva la card piu' scura, col numero della foto chiara da 5,10 a 7,58. */
const SCRIM_DIAGONALE = `linear-gradient(100deg, rgba(${INK},var(--fa-sc0)) 0%, rgba(${INK},var(--fa-sc1)) 42%, rgba(${INK},var(--fa-sc2)) 72%, rgba(${INK},var(--fa-sc3)) 100%)`;

/**
 * Fermi del diagonale. Base = mobile, `sm:` = da 640px in su.
 * Devono stare in classi e non nello `style`: una regola inline vincerebbe
 * sulla variante `sm:` e il breakpoint non avrebbe effetto.
 */
const FERMI_SCRIM = [
  "[--fa-sc0:0.95] [--fa-sc1:0.82] [--fa-sc2:0.64] [--fa-sc3:0.58]",
  "sm:[--fa-sc0:0.97] sm:[--fa-sc1:0.80] sm:[--fa-sc2:0.30] sm:[--fa-sc3:0.24]",
].join(" ");

/**
 * FaseCard — una delle nove fasi, come accordion APG:
 * `<h3><button aria-expanded aria-controls>` con il titolo DENTRO il button.
 * L'intera fascia chiusa resta cliccabile grazie allo pseudo-elemento `after`
 * del button, che si posiziona sulla riga di testata (l'unico antenato
 * `relative`): NON copre il pannello aperto, quindi un click sul testo non
 * richiude la card.
 *
 * Apertura su due livelli:
 *  - TRANSITORIA, da hover (dove `(hover: hover)` risponde, dopo 120 ms di
 *    permanenza) o da focus di tastiera, senza ritardo. Si chiude 120 ms dopo
 *    l'uscita del mouse, subito al blur, e in ogni caso con Esc (WCAG 1.4.13,
 *    dismissable). I timer vivono nell'accordion, che con Esc li annulla.
 *  - PERSISTENTE, da click / Enter / Space. Una sola alla volta. Il secondo
 *    click la toglie: se il mouse e' ancora sulla card, resta aperta come
 *    transitoria finche' non esce, ed e' il comportamento del prototipo.
 * `aria-expanded` e `inert` seguono SEMPRE lo stato visibile, hover incluso.
 *
 * Nessun rilevamento del dispositivo: click, tap e tastiera funzionano sempre.
 * Dove l'hover non esiste, il tap apre e richiude come prima.
 *
 * BORDO: `border-(length:--fa-stroke) border-(--fa-stroke-color)`, identico a quello delle card di
 * /collezioni e /finiture, che usano la stessa identica classe. E' STATICO,
 * come li': non cambia in hover ne' all'apertura. Il bordo del prototipo
 * (1px rgba(246,244,240,.12) che passava a white-warm in hover) e' stato
 * sostituito, non sovrapposto. Il raggio resta 30 e non 24: e' la forma della
 * card, non la traccia. Il focus è bianco (era oro fino al 20/10/2026) su `::after` invece del ring
 * navy-bright di /collezioni, perche' navy-bright su fondo `--fa-ink` non si
 * vedrebbe; la differenza e' voluta ed e' annotata nella PR.
 *
 * Il pannello resta SEMPRE nel DOM (il testo e' contenuto, non decorazione) ma
 * da chiuso e' `inert` + `aria-hidden`, e passa a `visibility:hidden` solo a
 * transizione finita, altrimenti il collasso sparirebbe di scatto.
 *
 * NUMERO. Regola: cap-top del numero = cap-top del titolo, baseline del numero
 * = baseline dell'eyebrow (e' maiuscolo, niente discendenti). E' un'eccezione
 * VOLUTA alla scala display, che si ferma a 4rem: elemento decorativo a uso
 * singolo, non un token nuovo. Peso 400: Satoshi e' un font VARIABILE con asse
 * `wght` 300-900 continuo — ogni peso da 300 in su e' reale, non arrotondato a
 * uno dei tre canonici — ma sotto 300 l'asse viene tagliato, quindi un 200 o un
 * 100 renderebbero come un 300. Il 400 resta finche' non si decide sul 300.
 *
 * Metriche lette da src/app/fonts/Satoshi-Variable.woff2 con fontkit (upem
 * 1000, capHeight 740, ascender 1010, descender -240) e non stimate. Chromium
 * arrotonda ascender e descender a px interi prima di comporre la line box:
 * validato su 13px (13+3=16), 32px (32+8=40) e 48px (48+12=60).
 *
 * Con F = corpo del titolo:
 *   mezza interlinea titolo = (1.08 - 1.25)/2 · F = -0.085·F
 *   cap-top titolo          = (-0.085 + 1.010 - 0.740)·F = 0.185·F
 *   baseline eyebrow        = 1.08·F + 22.75   (8 mt-2 + 1.75 half-leading + 13 ascPx)
 *   H                       = 0.895·F + 22.75
 *   corpo numero            = H / 0.740
 *   cap-top numero nel box  = ((1 - 1.25)/2 + 1.010 - 0.740)·Fn = 0.145·Fn
 *   offset                  = 0.185·F - 0.145·Fn
 *
 * Il titolo e' `clamp(2rem, 4vw + 1rem, 3rem)` e scala con continuita' fra 400
 * e 800px: il numero lo segue con la stessa clamp invece di cambiare a gradino
 * su un breakpoint, che nella fascia intermedia derivava fino a 10px. Tutto in
 * CSS, nessun calcolo a runtime. Il modello e' lineare mentre l'arrotondamento
 * di Chromium e' a gradini, quindi resta uno scarto sub-pixel: campionato ogni
 * 10px da 390 a 1440 in tmp/visual-check-produzione/campiona.mjs.
 */
export function FaseCard({
  fase,
  index,
  open,
  hoverDisponibile,
  reduceMotion,
  onToggle,
  onHoverEntra,
  onHoverEsce,
  onFocusEntra,
  onFocusEsce,
}: FaseCardProps) {
  const panelId = `fase-panel-${fase.n}`;
  const buttonId = `fase-button-${fase.n}`;

  // `settled` = la transizione in corso e' finita. Il cambio di `open` si
  // registra IN FASE DI RENDER (pattern react.dev "adjusting state when a prop
  // changes"), non dentro un effect: un setState sincrono in useEffect
  // provocherebbe un render a cascata ed e' vietato da react-hooks.
  const [prevOpen, setPrevOpen] = useState(open);
  const [settled, setSettled] = useState(true);
  // `will-change` della sfocatura: acceso mentre il filtro entra, TOLTO a regime.
  // Stesso schema di `settled` — si registra in fase di render, mai un setState
  // sincrono dentro un effect. Chiudendo va a regime subito, perche' in uscita
  // la transizione non c'e'.
  const [filtroARegime, setFiltroARegime] = useState(true);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setSettled(false);
    setFiltroARegime(!open);
  }

  useEffect(() => {
    if (open || settled) return;
    const id = window.setTimeout(() => setSettled(true), reduceMotion ? 0 : CHIUSURA_MS);
    return () => window.clearTimeout(id);
  }, [open, settled, reduceMotion]);

  useEffect(() => {
    if (filtroARegime) return;
    const id = window.setTimeout(
      () => setFiltroARegime(true),
      reduceMotion ? 0 : APERTURA_MS + FILTRO_MS,
    );
    return () => window.clearTimeout(id);
  }, [filtroARegime, reduceMotion]);

  const nascosto = !open && settled;

  const cardStyle = {
    // Il raggio resta 30: e' la forma della card, non la traccia.
    borderRadius: 30,
    "--fa-fase-dur": open ? `${APERTURA_MS}ms` : `${CHIUSURA_MS}ms`,
    // Geometria del numero, FLUIDA come il titolo. Vedi il blocco NUMERO nel
    // commento del componente: `--fa-titolo` è il corpo di `.fa-h2`, letto dal
    // suo token (26/10/2026: prima ne ripeteva il valore), le tre righe dopo
    // sono la catena H -> corpo -> offset. Solo CSS.
    "--fa-titolo": "var(--text-heading-2)",
    "--fa-num-h": "calc(0.895 * var(--fa-titolo) + 22.75px)",
    "--fa-num-size": "calc(var(--fa-num-h) / 0.74)",
    "--fa-num-top": "calc(0.185 * var(--fa-titolo) - 0.145 * var(--fa-num-size))",
  } as CSSProperties;

  return (
    <article
      className={`group/card reveal relative isolate overflow-hidden border-(length:--fa-stroke) border-(--fa-stroke-color) ${FERMI_SCRIM}`}
      data-aperta={open ? "true" : "false"}
      style={cardStyle}
      onMouseEnter={() => hoverDisponibile && onHoverEntra(index)}
      onMouseLeave={() => hoverDisponibile && onHoverEsce(index)}
    >
      <Image
        src={fase.image}
        alt={fase.alt}
        fill
        sizes="(max-width: 1024px) 100vw, 1120px"
        placeholder="blur"
        className="-z-10 object-cover"
        style={{ objectPosition: "center 52%" }}
      />
      {/* Diagonale e verticale: la base della card. Nessuno dei due dipende
          dallo stato, quindi nessuno dei due ha una transizione: aprendo, la
          fotografia resta esattamente quella che era. `data-strato` e' l'appiglio
          delle asserzioni, che devono poterli trovare senza contare i fratelli. */}
      <div
        aria-hidden="true"
        data-strato="diagonale"
        className="absolute inset-0 -z-10"
        style={{ background: SCRIM_DIAGONALE }}
      />
      <div
        aria-hidden="true"
        data-strato="verticale"
        className="absolute inset-0 -z-10"
        style={{ background: SCRIM_VERTICALE }}
      />
      {/* ZONA DEL TESTO: sfocatura e fondo scuro, e solo qui. Sta sull'`article`
          e non dentro il pannello perche' deve coprire anche titolo ed eyebrow,
          che vivono nella riga di testata; dentro il pannello sarebbe clippata
          dal suo `overflow-hidden`. Forma e taratura in `.fa-card-testo`. */}
      <div
        aria-hidden="true"
        className="fa-card-testo"
        style={filtroARegime ? undefined : { willChange: "backdrop-filter, opacity" }}
      />

      {/* Riga di testata: unico antenato `relative`, quindi delimita l'area
          cliccabile del button. Il numero e' un FRATELLO flex del blocco
          titolo+eyebrow, allineato al suo top: cosi' si aggancia al testo e non
          alla card, e non crea un contesto di posizionamento che ridurrebbe
          l'area cliccabile. */}
      <div className="relative flex min-h-[172px] flex-col justify-end px-6 pt-16 pb-7 sm:min-h-[208px] sm:px-10 sm:pb-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h3 className="fa-h2 m-0" style={{ color: "var(--fa-text-on-dark)", fontWeight: 400 }}>
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => onToggle(index)}
                onFocus={() => onFocusEntra(index)}
                onBlur={() => onFocusEsce(index)}
                className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:[border-radius:30px] focus-visible:after:outline-2 focus-visible:after:outline-offset-[-8px] focus-visible:after:outline-(--fa-stroke-color)"
              >
                {fase.title}
              </button>
            </h3>
            <span className="fa-eyebrow mt-2 block" style={{ color: "var(--fa-text-on-dark)" }}>
              {fase.spec}
            </span>
          </div>

          {/* Numero: cap-top allineato al cap-top del titolo, baseline allineata
              alla baseline dell'eyebrow. Le costanti stanno in `cardStyle`. */}
          <span
            aria-hidden="true"
            className="pointer-events-none shrink-0 font-normal"
            style={{
              marginTop: "var(--fa-num-top)",
              fontSize: "var(--fa-num-size)",
              lineHeight: 1,
              color: "var(--fa-text-on-dark)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fase.n}
          </span>
        </div>
      </div>

      <div
        id={panelId}
        inert={!open}
        aria-hidden={!open}
        className="relative grid motion-safe:transition-[grid-template-rows] motion-safe:duration-(--fa-fase-dur) motion-safe:ease-out-cubic"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          visibility: nascosto ? "hidden" : "visible",
        }}
      >
        <div className="overflow-hidden">
          <div className="relative px-6 pb-10 sm:px-10 sm:pb-12">
            {fase.paragraphs.map((p, i) => (
              // `min(62ch, 540px)`, e il 540 non e' un residuo: e' un TETTO.
              // 62ch sta nella fascia leggibile documentata (50-75 caratteri per
              // riga, WCAG <= 80), ma su desktop vale 678px e porta i glifi al
              // 58,6% della card invece del 45,8% — cioe' dentro la meta' DESTRA,
              // dove il diagonale e' deliberatamente chiaro (--fa-sc2 .30,
              // --fa-sc3 .24). Misurato: il p99 sui glifi scendeva su 7 card su 9
              // (card 01 da 13,13 a 7,99). Col tetto la riga resta dove lo scrim
              // e' scuro e il guadagno di ombra e sfocatura si somma invece di
              // compensare. Su mobile `min()` non cambia niente: li' il box e'
              // gia' tappato dalla card a 288px.
              // Interlinea 1.6, dentro la fascia 1,5-1,6. L'ombra e' sul SOLO
              // paragrafo: non titolo, non eyebrow, non numero. `relative` per
              // stare sopra lo strato sfocato, che e' a z-index 0.
              <p
                key={i}
                className="relative mt-4 max-w-[min(62ch,540px)] first:mt-0"
                style={{
                  color: "var(--fa-text-on-dark)",
                  lineHeight: 1.6,
                  textShadow: "var(--fa-text-shadow-photo)",
                }}
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
