"use client";

import { track } from "@vercel/analytics";
import { useEffect, useRef } from "react";

import { parseWorkshopEvent } from "@/lib/workshop-events";

interface WorkshopFrameProps {
  src: string;
  title: string;
}

/**
 * L'iframe della tavola, e l'ascolto dei suoi eventi per le statistiche.
 *
 * ⚠️ **Nessun `sandbox`** (spec, «La pagina della tavola»): senza `allow-same-origin` i
 * font della tavola non arrivano (richieste CORS con `Origin: null`) e Safari rallenta il
 * disegno; con `allow-same-origin` lo `sandbox` non protegge più niente.
 *
 * ⚠️ La pagina lo monta con `key={locale}`: al cambio di lingua l'iframe si ricrea invece
 * di cambiare `src`, che lascerebbe una voce nella cronologia dell'iframe (Indietro
 * tornerebbe alla tavola nella lingua di prima).
 *
 * I messaggi si accettano solo dalla stessa origine, solo da QUESTO iframe e solo se
 * `parseWorkshopEvent` li riconosce. `track()` senza `<Analytics />` (anteprime, locale)
 * non fa niente.
 *
 * ⚠️ L'origine si confronta QUI, nel gestore, anche se `parseWorkshopEvent` la confronta
 * di nuovo: Sonar (S2819, vulnerabilità critica) guarda il solo gestore di `message`, e
 * col controllo in un'altra funzione dava «D Security Rating» sulla PR #313.
 */
export function WorkshopFrame({ src, title }: Readonly<WorkshopFrameProps>) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const origin = globalThis.location.origin;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      if (e.source !== frame.current?.contentWindow) return;
      const event = parseWorkshopEvent(e, origin);
      if (event) track(event.name, event.props);
    };
    globalThis.addEventListener("message", onMessage);
    return () => globalThis.removeEventListener("message", onMessage);
  }, []);

  return <iframe ref={frame} src={src} title={title} className="block h-full w-full border-0" />;
}
