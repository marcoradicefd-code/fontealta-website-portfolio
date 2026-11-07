"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";

interface RevealProps {
  children: ReactNode;
  /** Stagger delay in ms applied to the transition (default 0). */
  delay?: number;
  /** Vertical travel distance in px before reveal (default 28). */
  distance?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Client wrapper that fades + rises its children as they scroll into view,
 * once. Receives (often Server-rendered) children as a prop so the
 * Client/Server boundary stays clean. Honours `prefers-reduced-motion`
 * (renders revealed immediately, no motion) via {@link useScrollReveal}.
 *
 * Matches the house idiom in `CollectionCardAnimated`: opacity + translateY
 * with the `--dur-hero` / `--ease-out-expo` tokens. CSS-only (Sprint 2
 * constraint — no GSAP/ScrollTrigger until Sprint 3+).
 */
/**
 * La durata della rivelazione (`--dur-hero`), più un margine. Serve solo alla
 * rete di sicurezza qui sotto: se `transitionend` non arriva — transizione mai
 * partita, elemento già rivelato al primo render, evento perso — la pulizia
 * deve avvenire lo stesso.
 */
const DURATA_RIVELAZIONE = 800;

export function Reveal({ children, delay = 0, distance = 28, className, style }: RevealProps) {
  const { ref, isRevealed } = useScrollReveal<HTMLDivElement>({
    threshold: 0.15,
    rootMargin: "0px 0px -60px 0px",
  });
  /**
   * A rivelazione finita l'elemento **smette di essere un livello di
   * composizione**: via `will-change`, e `transform: none` al posto del
   * `translateY(0)` che non sposta nulla ma continua a creare un contesto.
   *
   * È **igiene, non una cura**: `will-change` è un suggerimento per
   * l'animazione in corso, non un attributo permanente, e lasciarlo acceso
   * costa un livello di composizione su ogni `Reveal` della pagina.
   *
   * ⛔ **Questo `div` NON è la causa del coverflow piatto su Safari, e per un
   * giro l'abbiamo creduto.** Il `div` avvolge il carosello della home e
   * teneva due proprietà di raggruppamento sopra un sottoalbero 3D, il che lo
   * rendeva un sospettato plausibile; la cura è stata scritta, misurata,
   * messa in anteprima — e su Safari il carosello era piatto identico. La
   * causa vera è un'altra e sta in `featured-carousel.tsx`: la `perspective`
   * non veniva proprio applicata, perché il contenitore non aveva un livello
   * proprio e il flag che glielo darebbe non viene ricalcolato quando il 3D
   * arriva dopo il primo disegno. `Reveal` e la section con `overflow: hidden`
   * sono raggruppamenti da specifica, identici su Chrome, dove il carosello è
   * sempre stato giusto.
   *
   * ⚠️ La lezione, che è costata una PR: era stato misurato che le due
   * proprietà **sparivano**, non che **servisse** toglierle. Una causa si
   * verifica sul motore che mostra il difetto, e qui il WebKit del banco non
   * dipinge la prospettiva nemmeno nel caso di controllo — la verifica era
   * quattro scene in un file a parte, aperte su Safari vero.
   */
  const [finita, setFinita] = useState(false);

  useEffect(() => {
    if (!isRevealed || finita) return;
    // La rete di sicurezza: `transitionend` non arriva se la transizione non
    // parte mai — per esempio quando l'elemento nasce già rivelato.
    const t = setTimeout(() => setFinita(true), DURATA_RIVELAZIONE + delay + 100);
    return () => clearTimeout(t);
  }, [isRevealed, finita, delay]);

  return (
    <div
      ref={ref}
      className={className}
      onTransitionEnd={() => setFinita(true)}
      style={{
        ...style,
        opacity: isRevealed ? 1 : 0,
        transform: finita ? "none" : isRevealed ? "translateY(0)" : `translateY(${distance}px)`,
        transition: finita
          ? undefined
          : `opacity var(--dur-hero) var(--ease-out-expo) ${delay}ms, transform var(--dur-hero) var(--ease-out-expo) ${delay}ms`,
        willChange: finita ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
