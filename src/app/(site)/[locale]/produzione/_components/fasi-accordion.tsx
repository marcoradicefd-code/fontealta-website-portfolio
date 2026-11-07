"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useScrollRevealClassList } from "@/lib/use-scroll-reveal-classlist";

import { FaseCard, type Fase } from "./fase-card";

interface FasiAccordionProps {
  fasi: Fase[];
}

/**
 * L'HOVER NON APRE PIU' LE CARD — revocato ad agosto 2026, dopo averlo costruito,
 * misurato e provato. Si apre con click, tap o focus; l'hover fa solo il bordo.
 *
 * NON rimettere `true` finche' W3C pointerevents #611 e' aperto. Il motivo non e'
 * un nostro difetto: `mouseenter` NON e' affidabile su elementi che cambiano
 * geometria sotto un puntatore fermo, e i browser divergono — Chrome e Firefox da
 * una parte, Safari ed Edge dall'altra. Misurato qui: con tre o piu' card che si
 * aprono a cascata, la successiva non si apre. Non esiste una cura affidabile
 * lato nostro, e una che funziona su meta' dei browser e' peggio di nessuna.
 *
 * Il ramo `true` resta, con la sua guardia sullo scroll (sotto), perche' il
 * giorno che la questione si chiude il lavoro e' gia' fatto e misurato.
 */
const HOVER_APRE = false;

/**
 * Ritardo dell'hover, SIMMETRICO fra entrata e uscita: in entrata evita le
 * aperture di passaggio, in uscita evita che passando da una card alla vicina
 * la prima collassi prima che la seconda cominci ad aprirsi.
 */
const HOVER_DELAY_MS = 120;

/**
 * HOVER INTENZIONALE (ago 2026). Mentre la pagina SCORRE, e per 150 ms dopo
 * l'ultimo movimento, `mouseenter` non apre niente: il timer dei 120 ms non
 * parte proprio. Senza questa guardia le card si aprivano da sole — bastava
 * che scorressero sotto un puntatore fermo, che non e' un gesto ma una
 * coincidenza geometrica.
 *
 * `mouseleave` NON e' guardato: durante lo scroll una card aperta in hover si
 * chiude normalmente. Click, tap, focus ed Esc non passano di qui e restano
 * invariati sempre, scroll compreso.
 *
 * Si ascolta lo `scroll` nativo e non l'istanza Lenis: Lenis muove lo scroll
 * VERO del documento, quindi l'evento nativo e' il suo effetto osservabile — e
 * in piu' copre i casi in cui Lenis non c'e' affatto (sotto
 * `prefers-reduced-motion` non viene nemmeno istanziato) o non e' lui a
 * scrollare: tastiera, barra di scorrimento, ancore native.
 */
const SCROLL_CODA_MS = 150;

/**
 * Media query come external store: e' il modo che React offre per leggere una
 * sorgente esterna senza `setState` dentro un effect, che react-hooks vieta.
 * Lo snapshot server e' `false`, quindi la prima resa e' identica a quella del
 * server e non c'e' mismatch di idratazione: hover e ritardo si attivano dopo.
 */
function useMediaQuery(query: string) {
  return useSyncExternalStore(
    useCallback(
      (notifica: () => void) => {
        const mq = window.matchMedia(query);
        mq.addEventListener("change", notifica);
        return () => mq.removeEventListener("change", notifica);
      },
      [query],
    ),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * FasiAccordion — stato dell'accordion delle nove fasi, su due livelli.
 *
 *  - `persistente`: aperta da click / Enter / Space. UNA sola alla volta.
 *  - `transitoria`: aperta da hover o focus. Si chiude da sola.
 *
 * Esc chiude entrambe (WCAG 1.4.13, dismissable).
 *
 * I timer dell'hover vivono QUI e non nella card: solo da qui Esc puo'
 * annullarli, altrimenti un'apertura gia' schedulata riaprirebbe la card
 * subito dopo averla chiusa.
 *
 * Una card e' visibilmente aperta se e' l'una o l'altra. Con una persistente
 * gia' aperta, passare col mouse su un'altra apre anche quella: e' quanto fa il
 * prototipo, dove il selettore e' `.fase.is-open, .fase:hover`. Il vincolo
 * "una sola" riguarda la persistenza, non la visibilita'.
 *
 * NESSUNA aperta al caricamento: la pagina si legge prima come indice dei
 * passaggi, il dettaglio si chiede. Reveal con `useScrollRevealClassList` come
 * chi-siamo (IntersectionObserver + .reveal/.visible), niente GSAP.
 */
export function FasiAccordion({ fasi }: FasiAccordionProps) {
  const ref = useScrollRevealClassList<HTMLDivElement>();
  const [persistente, setPersistente] = useState<number | null>(null);
  const [transitoria, setTransitoria] = useState<number | null>(null);

  // SOLO `(hover: hover)`: niente `pointer: fine`, niente `any-hover`, nessun
  // rilevamento del dispositivo. Click, tap e tastiera funzionano sempre;
  // l'hover e' un'aggiunta per chi ce l'ha, non un ramo alternativo.
  const hoverDisponibile = useMediaQuery("(hover: hover)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Un solo timer basta: `transitoria` e' un indice singolo, quindi aprire B
  // chiude A da se'. Passando da A a B, l'uscita di A viene sostituita
  // dall'entrata di B e le due cose avvengono nello stesso istante.
  // Istante fino al quale lo scroll e' considerato "in corso".
  const fineScroll = useRef(0);
  useEffect(() => {
    const suScroll = () => {
      fineScroll.current = performance.now() + SCROLL_CODA_MS;
    };
    window.addEventListener("scroll", suScroll, { passive: true });
    return () => window.removeEventListener("scroll", suScroll);
  }, []);

  const timer = useRef<number | null>(null);
  const fermaTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => fermaTimer, [fermaTimer]);

  const ritardo = reduceMotion ? 0 : HOVER_DELAY_MS;

  const onHoverEntra = (index: number) => {
    if (!HOVER_APRE) return;
    // La guardia sta PRIMA di `fermaTimer`: durante lo scroll non si apre e non
    // si annulla nulla di gia' schedulato.
    if (performance.now() < fineScroll.current) return;
    fermaTimer();
    timer.current = window.setTimeout(() => setTransitoria(index), ritardo);
  };
  const onHoverEsce = (index: number) => {
    fermaTimer();
    timer.current = window.setTimeout(
      () => setTransitoria((corrente) => (corrente === index ? null : corrente)),
      ritardo,
    );
  };
  const onFocusEntra = (index: number) => {
    fermaTimer();
    setTransitoria(index);
  };
  const onFocusEsce = (index: number) => {
    setTransitoria((corrente) => (corrente === index ? null : corrente));
  };
  const onToggle = (index: number) => {
    fermaTimer();
    setPersistente((corrente) => (corrente === index ? null : index));
  };

  // WCAG 1.4.13 "Content on Hover or Focus", criterio dismissable: il contenuto
  // apparso per hover o focus deve potersi chiudere SENZA spostare il puntatore
  // ne' il focus. Listener sul documento, non sulla card, proprio perche' con
  // l'apertura da hover il focus puo' essere altrove. Esc e' IMMEDIATO e
  // annulla anche l'eventuale timer in volo. Dopo Esc la card resta chiusa
  // finche' il puntatore non esce e rientra: `mouseenter` non si ripete.
  const qualcosaAperto = persistente !== null || transitoria !== null;
  useEffect(() => {
    if (!qualcosaAperto) return;
    const suTasto = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      fermaTimer();
      setPersistente(null);
      setTransitoria(null);
    };
    document.addEventListener("keydown", suTasto);
    return () => document.removeEventListener("keydown", suTasto);
  }, [qualcosaAperto, fermaTimer]);

  return (
    <div ref={ref} className="flex flex-col gap-4 sm:gap-5">
      {fasi.map((fase, index) => (
        <FaseCard
          key={fase.n}
          fase={fase}
          index={index}
          open={persistente === index || transitoria === index}
          hoverDisponibile={hoverDisponibile}
          reduceMotion={reduceMotion}
          onToggle={onToggle}
          onHoverEntra={onHoverEntra}
          onHoverEsce={onHoverEsce}
          onFocusEntra={onFocusEntra}
          onFocusEsce={onFocusEsce}
        />
      ))}
    </div>
  );
}
