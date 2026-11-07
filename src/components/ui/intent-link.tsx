"use client";

import { useState, type ComponentProps } from "react";

import { Link } from "@/i18n/navigation";

type IntentLinkProps = ComponentProps<typeof Link>;

/**
 * Il `Link` di next-intl che fa il prefetch solo quando l'utente mostra
 * l'intenzione di aprirlo: mouse sopra, dito sopra, fuoco da tastiera.
 *
 * ⚠️ **Perché esiste (7/10/2026).** Col prefetch di default ogni link in vista
 * chiede la sua pagina al server: una visita a una collezione faceva partire
 * 65-76 richieste RSC, e una sola visita lenta a `/collezioni/twiggy` ha
 * generato **44 schede modello** che nessuno aveva aperto. Sono pagine nate su
 * richiesta, quindi dopo ogni deploy ognuna era una scrittura ISR, e ogni
 * richiesta passava dal proxy, cioè era un'invocazione. Misure in
 * `tmp/isr-2026-10-07/rapporto.md`.
 *
 * ⚠️ **È il modello della guida di Next 16** (Prefetching, «Preventing too
 * many prefetches»): `prefetch={active ? null : false}`. NON `prefetch={false}`
 * secco: la guida dice che così le rotte statiche si caricano solo al click e
 * quelle dinamiche aspettano il server prima di navigare. Qui il prefetch parte
 * appena c'è l'intenzione.
 *
 * ⚠️ **`null` (auto): su rotte non prerenderizzate il prefetch scarica solo
 * l'albero; al click parte l'RSC completo, come su main.** `true` scaricherebbe
 * la pagina intera a ogni hover: scartato il 7/10.
 *
 * ⚠️ **Dove si usa e dove no** sta nella rule `cache-isr`: card e footer sì,
 * navigazione principale e link dentro la pagina no.
 */
export function IntentLink({ onMouseEnter, onTouchStart, onFocus, ...props }: IntentLinkProps) {
  const [active, setActive] = useState(false);

  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(e) => {
        setActive(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setActive(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setActive(true);
        onFocus?.(e);
      }}
    />
  );
}
