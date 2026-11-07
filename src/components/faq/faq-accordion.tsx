"use client";

import { track } from "@vercel/analytics";
import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { gsap } from "@/lib/gsap-init";

export interface FaqAccordionItem {
  /** L'id del link diretto (`faq-…`), sull'heading. */
  id: string;
  question: string;
  /** La risposta già resa dal server. */
  answer: ReactNode;
}

const BUTTON =
  "group relative flex min-h-(--fa-touch-min) w-full cursor-pointer items-center justify-between gap-6 bg-transparent px-4 py-5 text-left text-sub-heading font-semibold text-fa-text-primary transition-colors duration-(--dur-control) ease-(--ease-out-cubic) hover:bg-fa-navy/8 hover:text-fa-navy focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-fa-navy focus-visible:outline-none motion-reduce:transition-none";
const CHEVRON =
  "size-6 shrink-0 text-fa-text-secondary transition duration-(--dur-micro) ease-(--ease-out-cubic) group-hover:text-fa-navy motion-reduce:transition-none";
const CHEVRON_OPEN =
  "size-6 shrink-0 rotate-180 text-fa-text-secondary transition duration-(--dur-micro) ease-(--ease-out-cubic) group-hover:text-fa-navy motion-reduce:transition-none";

/** Apertura e chiusura: 200 ms (`--dur-micro`) con `power2.out`, che è `--ease-out-cubic`. GSAP vuole secondi. */
const MOTION_SECONDS = 0.2;

const riduciMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * L'accordion delle FAQ, sul pattern del W3C APG (spec FAQ § 3).
 *
 * - L'heading ha come unico figlio il bottone, che prende tutta la riga, icona a destra.
 *   Più domande aperte insieme, nessuna chiusura automatica, tutte chiuse all'arrivo.
 * - **Hover** (Marco, 30/10/2026): il velo del bottone secondario su chiaro, `bg-fa-navy/8`
 *   (DESIGN-SYSTEM.md § 9.1), che sul crema scurisce invece di schiarire, e domanda e freccia in
 *   navy. Tailwind 4 chiude `hover:` in `(hover: hover)`, quindi al tocco non resta nessuno stato.
 * - **Apertura e chiusura animate**, 200 ms, ferme con `prefers-reduced-motion`. In chiusura lo
 *   stato cambia subito (`aria-expanded`, freccia) e il pannello resta visibile finché l'altezza
 *   non arriva a zero: per questo c'è l'insieme `closing`.
 * - ⚠️ **La risposta è nell'HTML anche chiusa, ma il server scrive `hidden` e non
 *   `hidden="until-found"`**: React 19 tratta `hidden` come booleano e scrive `hidden=""` per
 *   qualunque stringa (provato con `renderToString` il 30/10/2026). Il valore `until-found` lo
 *   mette l'effetto qui sotto dopo l'idratazione, sui pannelli chiusi: da lì la ricerca nella
 *   pagina trova il testo e lo apre (`beforematch`). Senza JavaScript la risposta resta
 *   nell'HTML, nascosta.
 * - **Link diretto:** aprire una domanda scrive `#faq-…` con `replaceState` (il tasto Indietro
 *   torna alla pagina di prima, non alla domanda di prima); un indirizzo con quell'hash apre la
 *   domanda. Ci porta il salto del browser, che si ferma sotto la barra fissa con lo
 *   `scroll-margin-top` dell'heading, la leva unica della rule `nav-hero-scroll`.
 * - **Statistiche:** `faq_apri` di Vercel Web Analytics solo al clic che apre (non all'arrivo da
 *   un link, non alla ricerca nella pagina), con due proprietà, `pagina` (il percorso, che porta
 *   anche la lingua) e `domanda`: sul piano Pro un evento personalizzato ne porta al più 2 (doc
 *   Vercel, limits-and-pricing; 4/11/2026, prima erano tre). Senza cookie, e senza
 *   `<Analytics />` (anteprime, locale) `track()` non fa niente.
 */
export function FaqAccordion({ items }: { items: readonly FaqAccordionItem[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [closing, setClosing] = useState<ReadonlySet<string>>(() => new Set());
  const panels = useRef(new Map<string, HTMLDivElement>());
  const toAnimate = useRef<{ id: string; opening: boolean } | null>(null);

  const without = (set: ReadonlySet<string>, id: string) => {
    const next = new Set(set);
    next.delete(id);
    return next;
  };

  const openItem = (id: string) => setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  // L'hash all'arrivo e quando cambia: apre la domanda, se è di questa pagina.
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (items.some((item) => item.id === id)) openItem(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [items]);

  // La ricerca nella pagina: il browser toglie `hidden` e avvisa, lo stato lo segue.
  useEffect(() => {
    const cleanups = [...panels.current].map(([id, el]) => {
      const onBeforeMatch = () => openItem(id);
      el.addEventListener("beforematch", onBeforeMatch);
      return () => el.removeEventListener("beforematch", onBeforeMatch);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [items]);

  // Prima dell'idratazione il browser può aver già aperto un pannello (una ricerca, un link
  // `#:~:text=`): ha tolto `hidden`, e il suo `beforematch` è arrivato quando qui non ascoltava
  // nessuno. Lo stato lo segue, o l'effetto sotto lo richiuderebbe (sonda del 30/10/2026: aperto a
  // ~60 ms, richiuso all'idratazione a ~100 ms).
  useLayoutEffect(() => {
    const giaAperti = [...panels.current].filter(([, el]) => !el.hasAttribute("hidden"));
    if (giaAperti.length > 0) setOpen(new Set(giaAperti.map(([id]) => id)));
  }, []);

  // `until-found` sui chiusi (solo dove `hidden` c'è ancora), e l'animazione di quello appena
  // aperto o chiuso.
  useLayoutEffect(() => {
    for (const [id, el] of panels.current) {
      if (!open.has(id) && !closing.has(id) && el.hasAttribute("hidden")) {
        el.setAttribute("hidden", "until-found");
      }
    }
    const step = toAnimate.current;
    toAnimate.current = null;
    const el = step ? panels.current.get(step.id) : undefined;
    if (!step || !el) return;
    gsap.killTweensOf(el);
    if (step.opening) {
      gsap.fromTo(
        el,
        { height: 0, opacity: 0, overflow: "hidden" },
        {
          height: "auto",
          opacity: 1,
          duration: MOTION_SECONDS,
          ease: "power2.out",
          clearProps: "height,opacity,overflow",
        },
      );
      return;
    }
    gsap.to(el, {
      height: 0,
      opacity: 0,
      overflow: "hidden",
      duration: MOTION_SECONDS,
      ease: "power2.out",
      onComplete: () => {
        // Prima nascosto, poi via gli stili: altrimenti per un fotogramma tornerebbe intero.
        el.setAttribute("hidden", "until-found");
        gsap.set(el, { clearProps: "height,opacity,overflow" });
        setClosing((prev) => without(prev, step.id));
      },
    });
  }, [open, closing]);

  const toggle = (id: string) => {
    if (open.has(id)) {
      setOpen((prev) => without(prev, id));
      if (!riduciMovimento()) {
        toAnimate.current = { id, opening: false };
        setClosing((prev) => new Set(prev).add(id));
      }
      if (window.location.hash === `#${id}`) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      return;
    }
    if (!riduciMovimento()) toAnimate.current = { id, opening: true };
    setClosing((prev) => (prev.has(id) ? without(prev, id) : prev));
    openItem(id);
    window.history.replaceState(null, "", `#${id}`);
    track("faq_apri", { pagina: window.location.pathname, domanda: id });
  };

  return (
    <div className="border-b border-(--fa-stroke-color-on-light)">
      {items.map((item) => {
        const isOpen = open.has(item.id);
        return (
          <div key={item.id} className="border-t border-(--fa-stroke-color-on-light)">
            <h3 id={item.id} className="m-0 scroll-mt-(--fa-nav-h)">
              <button
                type="button"
                id={`${item.id}-button`}
                aria-expanded={isOpen}
                aria-controls={`${item.id}-panel`}
                onClick={() => toggle(item.id)}
                className={BUTTON}
              >
                <span>{item.question}</span>
                <ChevronDown aria-hidden className={isOpen ? CHEVRON_OPEN : CHEVRON} />
              </button>
            </h3>
            <div
              id={`${item.id}-panel`}
              role="region"
              aria-labelledby={`${item.id}-button`}
              hidden={!isOpen && !closing.has(item.id)}
              ref={(el) => {
                if (!el) return;
                panels.current.set(item.id, el);
                return () => {
                  panels.current.delete(item.id);
                };
              }}
              // Niente imbottitura qui: un pannello `until-found` chiuso è nascosto con
              // `content-visibility`, non con `display: none`, e terrebbe la sua.
              className="print:block! print:[content-visibility:visible]"
            >
              <div className="px-4 pt-3 pb-6">{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
