"use client";

import { useEffect } from "react";

/**
 * Tiene i `<details>` della pagina allineati a due cose che l'HTML da solo non fa.
 *
 * 1. **L'ancora apre la sua sezione.** Chi arriva da `/privacy-policy` (308 verso
 *    `#privacy`), dal footer o dalla riga sotto il modulo deve trovare la sezione
 *    aperta, non un titolo chiuso. Tre vie d'arrivo, tre ascoltatori: l'ancora al
 *    caricamento, `hashchange`, e il clic su un link della stessa pagina.
 *    ⚠️ **Il clic serve davvero**: gli anchor della stessa pagina li gestisce il
 *    `LenisProvider`, che aggiorna l'URL con `history.replaceState`, e
 *    `replaceState` **non** emette `hashchange`.
 * 2. **In stampa si stampano tutte.** Il contenuto di un `<details>` chiuso non si
 *    stampa, e il CSS da solo non lo apre su tutti i browser: `::details-content` in
 *    `globals.css` copre quelli recenti, `beforeprint` tutti gli altri. Dopo la stampa
 *    si richiudono solo le sezioni che erano chiuse.
 */
export function LegalDetailsSync({ ids }: { ids: readonly string[] }) {
  useEffect(() => {
    const apri = (hash: string) => {
      const id = decodeURIComponent(hash.replace(/^#/, ""));
      if (!ids.includes(id)) return;
      const sezione = document.getElementById(id);
      if (sezione instanceof HTMLDetailsElement) sezione.open = true;
    };

    apri(window.location.hash);

    const onHashChange = () => apri(window.location.hash);
    const onClick = (event: MouseEvent) => {
      const link = event
        .composedPath()
        .find((n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement && !!n.href);
      if (!link) return;
      const meta = new URL(link.href);
      if (meta.origin !== window.location.origin || meta.pathname !== window.location.pathname)
        return;
      apri(meta.hash);
    };

    let chiuseAllaStampa: HTMLDetailsElement[] = [];
    const onBeforePrint = () => {
      chiuseAllaStampa = [
        ...document.querySelectorAll<HTMLDetailsElement>("details[data-legal-section]"),
      ].filter((d) => !d.open);
      for (const d of chiuseAllaStampa) d.open = true;
    };
    const onAfterPrint = () => {
      for (const d of chiuseAllaStampa) d.open = false;
      chiuseAllaStampa = [];
    };

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("click", onClick, true);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [ids]);

  return null;
}
