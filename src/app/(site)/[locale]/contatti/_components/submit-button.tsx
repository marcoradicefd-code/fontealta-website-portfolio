"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { initGsap } from "@/lib/gsap-init";

import { animazioniPronte } from "./carica-animazioni";
import { FRECCIA, SPUNTA } from "./icone-invio";

// Vedi `navigation.tsx`: `useGSAP` va registrato sull'istanza di gsap che usa il componente.
gsap.registerPlugin(useGSAP);

/**
 * Il bottone di invio che diventa la conferma (14/10/2026, decisioni di Marco).
 *
 * Usa il `Button` di sempre, con le sue varianti: contorno bianco su fondo scuro (`/contatti`,
 * `ProgettareCta`) e pillola navy sulla home. Tutto quello che aggiunge (freccia, spunta, linea
 * dell'invio) prende il colore del testo del bottone, quindi regge su tutti e due.
 *
 * ⚠️ React rende SEMPRE lo stato finale: testo, tracciato della spunta, chi è in flusso. GSAP
 * anima soltanto il passaggio, e solo se i plugin sono arrivati e il movimento non è ridotto. Così
 * senza plugin, con `prefers-reduced-motion` o dopo un errore, quello che si vede è comunque giusto.
 */

export type StatoInvio = "idle" | "pending" | "success" | "error";

interface Props {
  stato: StatoInvio;
  variant: "primary" | "secondary";
  dark?: boolean;
  testi: { invia: string; inviato: string; invioInCorso: string };
}

export function SubmitButton({ stato, variant, dark = false, testi }: Props) {
  const radice = useRef<HTMLSpanElement>(null);
  const ridotto = usePrefersReducedMotion();

  // In invio: la linea scorre in ciclo finché la Server Action non risponde.
  useGSAP(
    () => {
      if (stato !== "pending" || ridotto) return;
      initGsap();
      gsap.fromTo(
        ".fa-invio-linea",
        { xPercent: -100, opacity: 1 },
        { xPercent: 100, duration: 0.8, ease: "fa-water", repeat: -1 },
      );
    },
    { scope: radice, dependencies: [stato, ridotto], revertOnUpdate: true },
  );

  // Successo: linea che si spegne, freccia → spunta, «Invia» → «Inviato», larghezza (Flip).
  // Totale 350 ms; la riga di conferma arriva dopo (300-600 ms, `conferma-invio.tsx`).
  useGSAP(
    () => {
      const a = animazioniPronte();
      const el = radice.current;
      if (stato !== "success" || ridotto || !a || !el) return;
      const bottone = el.querySelector("button");
      // Flip: React ha già reso «Inviato». Si rimette per un istante lo stato di prima, si prende
      // la geometria, e si torna allo stato finale: tutto prima del disegno, a schermo non passa.
      el.dataset.stato = "pending";
      const prima = bottone ? a.Flip.getState(bottone) : null;
      el.dataset.stato = "success";
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.fromTo(".fa-invio-linea", { xPercent: 0, opacity: 1 }, { opacity: 0, duration: 0.15 }, 0)
        .fromTo(
          ".fa-invio-icona path",
          { morphSVG: FRECCIA },
          { morphSVG: SPUNTA, duration: 0.4 },
          0,
        )
        .fromTo(".fa-invio-e-invia", { opacity: 1 }, { opacity: 0, duration: 0.25 }, 0.05)
        .fromTo(".fa-invio-e-inviato", { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0.05);
      if (prima && bottone) {
        // `scale: false`: si anima la larghezza, non una scala, che stirerebbe testo e contorno
        // (impeccable · animate). La `transition` del `Button` si spegne durante, o la larghezza
        // verrebbe animata due volte.
        gsap.set(bottone, { transition: "none" });
        tl.add(
          a.Flip.from(prima, {
            targets: bottone,
            scale: false,
            duration: 0.4,
            ease: "power2.out",
            onComplete: () => {
              gsap.set(bottone, { clearProps: "transition,width,height" });
            },
          }),
          0,
        );
      }
    },
    { scope: radice, dependencies: [stato, ridotto], revertOnUpdate: true },
  );

  // «Invia un'altra richiesta»: dal successo si torna a «Invia →» con una dissolvenza di 200 ms
  // (`--dur-micro`), non con la sequenza al contrario.
  const precedente = useRef<StatoInvio>(stato);
  useGSAP(
    () => {
      const era = precedente.current;
      precedente.current = stato;
      if (era !== "success" || stato !== "idle" || ridotto || !animazioniPronte()) return;
      gsap.fromTo(
        [".fa-invio-e-invia", ".fa-invio-icona"],
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: "power2.out" },
      );
    },
    { scope: radice, dependencies: [stato, ridotto], revertOnUpdate: true },
  );

  const bloccato = stato === "pending" || stato === "success";
  const fatto = stato === "success";

  return (
    <span ref={radice} className="fa-invio inline-flex" data-stato={stato}>
      <Button
        type="submit"
        variant={variant}
        dark={dark}
        size="m"
        aria-disabled={bloccato || undefined}
        aria-label={stato === "pending" ? testi.invioInCorso : undefined}
        className="relative min-w-[140px] overflow-hidden aria-disabled:pointer-events-none"
      >
        <span className="inline-flex items-center gap-2">
          <span className="fa-invio-etichette">
            <span className="fa-invio-e-invia" aria-hidden={fatto || undefined}>
              {testi.invia}
            </span>
            <span className="fa-invio-e-inviato" aria-hidden={!fatto || undefined}>
              {testi.inviato}
            </span>
          </span>
          <svg
            className="fa-invio-icona"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={fatto ? SPUNTA : FRECCIA} />
          </svg>
        </span>
        <span className="fa-invio-binario" aria-hidden="true">
          <span className="fa-invio-linea" />
        </span>
      </Button>
      <style>{`
        .fa-invio-etichette { position: relative; display: inline-block; white-space: nowrap; }
        .fa-invio:not([data-stato="success"]) .fa-invio-e-inviato,
        .fa-invio[data-stato="success"] .fa-invio-e-invia {
          position: absolute; left: 0; top: 0; opacity: 0;
        }
        .fa-invio-binario {
          position: absolute; left: var(--btn-pad-m); right: var(--btn-pad-m); bottom: 9px;
          height: var(--fa-stroke-control); overflow: hidden; pointer-events: none; opacity: var(--fa-opacity-muted);
        }
        .fa-invio-linea {
          position: absolute; inset: 0; background: currentColor; opacity: 0;
          transform: translateX(-100%);
        }
      `}</style>
    </span>
  );
}
