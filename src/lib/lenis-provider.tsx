"use client";

/**
 * Lenis smooth-scroll provider.
 *
 * COEXISTENCE WITH `use-scroll-reveal-classlist` (the boss's hook):
 *   - The boss's `useScrollRevealClassList`
 *     (src/lib/use-scroll-reveal-classlist.ts) uses
 *     IntersectionObserver to add a `.visible` class to any `.reveal`
 *     element when it crosses the viewport. It runs everywhere by default
 *     and provides the BASE reveal animation (translateY+opacity) defined
 *     in src/app/globals.css.
 *   - This provider adds Lenis (smooth virtualized scroll) and wires it to
 *     gsap.ticker so GSAP ScrollTrigger animations stay in sync. GSAP scenes
 *     (hero stepped, fullscreen slider, pinned slides — see ARCHITECTURE.md
 *     §7 patterns 1-3) opt-in by importing `initGsap()` and creating a
 *     `useGSAP()` hook with their own `.gsap-*` selectors.
 *   - Rule: never apply BOTH `.reveal` and a GSAP scrub on the same element.
 *     Pick one per element. The boss's hook handles 90% of reveals; GSAP
 *     handles the choreographed scenes.
 *
 * `prefers-reduced-motion` is honored: Lenis is disabled and gsap.ticker is
 * left untouched, so all CSS transitions degrade gracefully.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

import { gsap, initGsap } from "./gsap-init";

// Gesti che chiudono in anticipo la finestra di assestamento post-navigazione.
const GESTI = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/* L'ATTERRAGGIO degli anchor NON si tara qui.
 *
 * Il bordo alto del bersaglio deve fermarsi sotto la nav fissa, e il numero vive in
 * un posto solo: `scroll-margin-top: var(--fa-nav-h)` sui bersagli (`#main-content, #progettare`, `#catalogo`…)
 * in `globals.css`. Vale per **entrambi** i percorsi, e non per disciplina ma perché
 * lo legge anche Lenis: `scrollTo` fa `Number.parseFloat(getComputedStyle(node)
 * .scrollMarginTop)` e lo somma al bersaglio (letto in `lenis.mjs`, e misurato).
 *
 * ⚠️ Per questo NON va passato anche un `offset: -64` qui: si conterebbe due volte.
 * Misurato mentre si scriveva questo fix — con l'offset in più il bordo atterrava a
 * **128 px** invece di 64, cioè esattamente il doppio. Se un giorno l'atterraggio va
 * spostato, si cambia `--fa-nav-h` (o lo `scroll-margin-top`), mai questo file.
 */

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();
  const primoRender = useRef(true);
  // true = cambio pagina in corso, la posizione va tenuta in cima finché il documento
  // non ha finito di crescere. Letto dal ResizeObserver del body, poco più sotto.
  const assestamentoRef = useRef(false);
  // Il percorso a cui riporta un Indietro/Avanti del browser, letto dall'effetto su
  // [pathname]: se combacia, quella navigazione è un ritorno e la posizione la
  // rimette il browser. Diagnosi nel commento lungo, più sotto.
  const ritornoRef = useRef<string | null>(null);

  // Fuori dall'effetto di Lenis perché vale anche sotto prefers-reduced-motion. In
  // cattura: sul `window` scatta prima del listener di popstate di Next.
  useEffect(() => {
    const onPopState = () => {
      ritornoRef.current = window.location.pathname;
    };
    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, []);

  useEffect(() => {
    initGsap();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false,
      // ⚠️ REVOCATO il 31/08/2026, e non va riacceso: `anchors: true` chiama
      // `scrollTo` ma NON chiama `preventDefault`. Gli anchor li gestisce il
      // listener unico qui sotto. Diagnosi completa lì.
      anchors: false,
    });
    lenisRef.current = lenis;

    // TEST-ONLY: espone l'istanza a `window.__lenis` per l'e2e di regressione dello
    // scroll (assert sul limite Lenis). Gated dal build flag NEXT_PUBLIC_E2E → il
    // ramo è dead-code-eliminato dai build normali (flag ≠ "1"): zero impatto in prod.
    if (process.env.NEXT_PUBLIC_E2E === "1") {
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }

    // ── ANCHOR INTERNI · gestore unico ──────────────────────────────────────────
    /**
     * Perché non `anchors: true` di Lenis — revocato il 31/08/2026, misurato.
     *
     * La sua implementazione chiama `scrollTo` ma **non chiama `preventDefault`**:
     * l'azione predefinita del link resta viva accanto all'animazione. Al PRIMO
     * clic la cosa è invisibile, perché il salto nativo al frammento e
     * l'animazione hanno la stessa destinazione — si vede solo Lenis riportare
     * indietro la pagina e ri-scendere. Al SECONDO clic sullo stesso frammento,
     * con la pagina riportata in cima a mano, l'azione predefinita **abortisce
     * l'animazione dopo un solo frame**: misurati 349 px su 3594, e `isScrolling`
     * che resta `"smooth"` per sempre invece di tornare `false`. Dieci fallimenti
     * su dieci, desktop e mobile.
     *
     * ⚠️ L'ipotesi di partenza — «al secondo clic l'hash è già quello, nessun
     * evento parte, lo scroll non viene mai chiesto» — è FALSA, e a falsificarla
     * è stata la misura: azzerando l'hash con `replaceState` prima del secondo
     * clic parte un `hashchange` vero e il clic fallisce identico. Lo scroll viene
     * chiesto eccome; è l'azione predefinita a ucciderlo. La controprova che regge
     * questo fix è che con `preventDefault` lo stesso clic arriva a destinazione.
     *
     * Sotto `prefers-reduced-motion` questo effect è già uscito sopra: il listener
     * non viene registrato affatto e gli anchor restano il salto nativo del
     * browser, che è il comportamento voluto. Stessa cosa se Lenis non c'è.
     */
    const onAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      // cmd/ctrl/shift/alt+click aprono altrove: non sono clic nostri.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = (event.composedPath?.() ?? []).find(
        (n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement && !!n.href,
      );
      if (!link || link.hasAttribute("download")) return;
      if (link.target && link.target !== "_self") return;

      // Stesso documento: origin, pathname E query. Lenis confrontava solo host e
      // pathname, quindi da `?a=1` un `#x` scritto come URL pieno con query diversa
      // sarebbe stato trattato come interno.
      const meta = new URL(link.href);
      const qui = new URL(window.location.href);
      if (meta.origin !== qui.origin || meta.pathname !== qui.pathname) return;
      if (meta.search !== qui.search || !meta.hash) return;

      const bersaglio = document.getElementById(decodeURIComponent(meta.hash.slice(1)));
      if (!bersaglio) return;

      event.preventDefault();
      lenis.scrollTo(bersaglio);
      history.replaceState(null, "", meta.hash);

      // Lo scroll da solo NON sposta il punto di partenza della navigazione da
      // tastiera: senza questo lo skip-link scrolla ma non «salta», e il Tab
      // successivo riparte dalla nav. Lo faceva il salto nativo, che qui abbiamo
      // soppresso, quindi va rifatto a mano.
      //
      //
      // ⚠️ Un'annotazione precedente dava qui un difetto: «lo skip-link da tastiera
      // a pagina scrollata si ferma a scrollY − nav su desktop». NON esiste. Era la
      // sonda: premeva Enter nello STESSO frame in cui il Tab spostava il focus.
      // Curva del ritardo Tab→Enter, 5 giri per cella su 1440/1280/390: a **0 ms**
      // sbaglia a intermittenza, a **16 ms — un frame — è corretto 15 su 15**, e
      // così a 50, 100 e 250. Due tasti separati da meno di un frame non sono un
      // utente. Anche nel caso impossibile il FOCUS atterrava comunque giusto.
      if (!bersaglio.hasAttribute("tabindex")) bersaglio.setAttribute("tabindex", "-1");
      bersaglio.focus({ preventScroll: true });
    };
    window.addEventListener("click", onAnchorClick, true);

    // CINTURA — fix scroll intermittente a freddo. Lenis misura il limite di
    // scroll UNA volta al mount, ma `html { height: 100% }` (`h-full`, regge lo
    // sticky-footer) rende inefficace il suo contentResizeObserver di default:
    // osserva il BOX di `documentElement`, viewport-locked, non lo `scrollHeight`,
    // quindi non scatta quando il contenuto sotto la piega cresce (init carousel,
    // decode immagini, swap font). Osserviamo invece `document.body` — è
    // `min-h-full flex-col`, cresce col contenuto — e ri-misuriamo a ogni reflow.
    const bodyResizeObserver = new ResizeObserver(() => {
      lenis.resize();
      // Finestra di assestamento dopo una navigazione IN AVANTI: vedi il commento
      // lungo sotto. Tiene la pagina nuova in cima mentre cresce. Sul ritorno
      // (Indietro/Avanti del browser) non si apre: la posizione la rimette il browser.
      // Questo è anche l'UNICO scrittore del limite dopo un cambio pagina: l'effetto sul
      // pathname non chiama `resize()`, vedi il difetto 2.
      if (assestamentoRef.current) lenis.scrollTo(0, { immediate: true, force: true });
    });
    bodyResizeObserver.observe(document.body);

    // Ri-misura anche quando immagini/video hanno finito di caricare. In Next il
    // mount può avvenire DOPO che l'evento `load` è già scattato → il listener non
    // scatterebbe mai: guardia su `readyState`, altrimenti chiamata diretta.
    const onLoad = () => lenis.resize();
    if (document.readyState === "complete") lenis.resize();
    else window.addEventListener("load", onLoad);

    function raf(time: number) {
      lenis.raf(time * 1000);
    }
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      if (process.env.NEXT_PUBLIC_E2E === "1") {
        delete (window as unknown as { __lenis?: Lenis }).__lenis;
      }
      window.removeEventListener("click", onAnchorClick, true);
      window.removeEventListener("load", onLoad);
      bodyResizeObserver.disconnect();
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  /**
   * Scroll al cambio pagina: avanti in cima, Indietro/Avanti dove si era.
   *
   * DECISIONE (Marco, 12/10/2026): col tasto Indietro o Avanti del browser la pagina
   * torna dove era, la lista alla card cliccata; le navigazioni in avanti partono in
   * cima. Revoca la regola del 31/07/2026 («il Back riporta in cima, ed è
   * deliberato», PR #91). È anche il comportamento predefinito di Next: «maintain
   * scroll position, similar to how browsers handle back and forwards navigation»
   * (doc del `Link`, voce `scroll`:
   * `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md:232`).
   *
   * CHI RIMETTE LA POSIZIONE, misurato il 12/10 su Next 16.3.8: il BROWSER, con
   * `history.scrollRestoration` su `"auto"`, che qui non si imposta. Il riducer del
   * popState di Next non scrolla (`scrollRef: null`). Al `popstate` lo scroll vale
   * ancora quello della pagina che si lascia; la posizione salvata arriva dopo i
   * listener, senza nessuno scroll da JS. Quindi l'effetto qui sotto, sul ritorno,
   * non scrolla né ri-misura: Lenis si allinea da sé sull'evento di scroll nativo.
   *
   * ⚠️ PRIMA, il ritorno in cima era una GARA, non una regola. L'effetto chiamava
   * `scrollTo(0)` e il browser rimetteva la posizione per conto suo: vinceva chi
   * arrivava dopo. Nei giri headed il browser arrivava a ~5 ms e Lenis a 21-38 ms
   * (in cima); nello spec headless Lenis a +2 ms e il browser a +13 ms (rimasto a
   * 1600, cioè dov'era). Oggi non c'è niente che corra contro il browser.
   *
   * IL CASO DEL 31/07, rimisurato. Allora: dalla collezione scorsa oltre il fondo
   * della scheda modello, il ripristino arrivava mentre il DOM aveva ancora l'altezza
   * della scheda, veniva tagliato al suo fondo e lo scroll anchoring trascinava sul
   * footer. Il 12/10, nei casi peggiori (lista in fondo → collezione corta; Boss in
   * fondo → modello; Ille oltre 4000 → modello; desktop e 390) al primo fotogramma
   * del ritorno `scrollHeight` è già quello della pagina nuova e la posizione torna
   * esatta: nessun taglio. Se un giorno tornasse, NON si riscrive la restoration in
   * casa: si valuta una libreria (rule `nav-hero-scroll`).
   *
   * QUATTRO DIFETTI TROVATI NEL RITORNO (12/10, tutti misurati sul build E2E, `window.__lenis`):
   *
   * 1. Effetto in ritardo. React rimanda gli effetti passivi: se l'Indietro arriva meno di
   *    un fotogramma dopo il commit della scheda, al `popstate` l'effetto della scheda
   *    (`pathname` = scheda) non è ancora girato. Gira ORA, con `location` già sulla
   *    lista, trova il flag del ritorno e lo consuma; l'effetto vero del ritorno (+15 ms)
   *    lo trova vuoto, si crede una navigazione in avanti e chiama `scrollTo(0)` a +15 ms:
   *    Lenis accende `_preventNextNativeScrollEvent`, ignora lo scroll del ripristino
   *    (+23-25 ms) e resta con bersaglio 0 su una pagina a 2400. Traccia degli effetti:
   *    «pathname=/modello/… location=/collezioni/ille ritornoRef=/collezioni/ille» poi
   *    «pathname=/collezioni/ille ritornoRef=null». Cura: un effetto il cui `pathname` non
   *    è più quello dell'URL esce senza toccare niente, flag compreso.
   * 2. Limite di Lenis vecchio. `resize()` legge `scrollHeight` UNA volta e lo tiene
   *    (`Dimensions.onContentResize`, `lenis.mjs:186-194`; il `limit` è quella copia,
   *    `:195-199`). Chiamato a +2 ms dal `popstate`, quando il DOM è ancora quello della
   *    scheda, salvava 2876 (limite 2156); la lista (8176) arriva a ~+20 ms. Il
   *    ResizeObserver del body non rimediava: notifica solo se la misura al fotogramma
   *    differisce dall'ULTIMA da lui riportata, e quella era ancora la lista (8176), uguale
   *    alla finale. Risultato: dopo il Back `limit` 2156 su una pagina da 8176, la prima
   *    ruota tagliava il bersaglio (`clamp(0, target, limit)`, `:798`) e la pagina saliva
   *    da 2400 a 2156 (8 giri su 8). Due scrittori del limite, e il secondo campiona un
   *    istante che il primo non vedrà mai: cura, se ne tiene uno solo (il ResizeObserver,
   *    che per costruzione converge).
   * 3. Animazione in corso. Se si scorre la scheda e si preme Indietro mentre Lenis sta
   *    ancora animando (`isScrolling` "smooth", fino a ~1 s dopo la ruota), lo scroll del
   *    ripristino viene ignorato e l'animazione porta la pagina dove era diretta: 1200
   *    invece di 2400 (4 giri su 4). Cura: `stop()` + `start()`, cioè un `reset()`.
   * 4. Scroll del ripristino ignorato. Lo `scrollTo` immediato della navigazione in
   *    avanti accende `_preventNextNativeScrollEvent` fino al rAF successivo. Se
   *    l'Indietro arriva a ridosso (tracce: `scrollTo(0)` e `popstate` a 0-4 ms), il
   *    commit lungo della pagina nuova impedisce quel fotogramma e lo scroll del
   *    ripristino (+2 ms dopo `start()`) trova il flag ancora acceso: Lenis lo scarta e
   *    resta con bersaglio 0 su y=2400. Cura: un ascoltatore di `scroll`, registrato
   *    dopo quello di Lenis, che se Lenis è fermo e il bersaglio non è dove si è chiama
   *    `resize()`. Prima: 5 giri su 180; dopo: 0 su 180.
   * Dopo: `limit` 7456, bersaglio 2400, ruota di 2400 px → 4800 (8 giri su 8); Back
   * durante l'animazione → 2400 (4 su 4). Alternativa a costo zero misurato, NON adottata
   * (la scelta è di Marco): `naiveDimensions: true`, il limite letto dal vivo. Misurato
   * sul codice di prima: chiude il punto 2 (limite giusto 8 giri su 8), non il 3 (1200,
   * 3 giri su 3); i punti 1 e 4 sono di classificazione e di eventi, non di misura.
   *
   * Su `scrollRestoration = "manual"` (misurato il 12/10): non serve e non si usa.
   * Un `"manual"` scritto dopo la registrazione di ScrollTrigger torna `"auto"` al
   * primo resize: ScrollTrigger riscrive il valore letto alla registrazione
   * (`ScrollTrigger.js:452` via `:555`, valore preso a `:2018`).
   *
   * Navigazione in avanti: in cima, più la finestra di assestamento di 700 ms che
   * tiene la pagina nuova a 0 mentre cresce, chiusa al primo gesto dell'utente.
   */
  useEffect(() => {
    // Effetto in ritardo: l'URL è già altrove. React rimanda gli effetti passivi, e se
    // l'Indietro arriva prima che questo giri, `location` è già la pagina di ritorno.
    // Quella di cui parla questo effetto non c'è più: né scroll né finestra di
    // assestamento, e soprattutto NON si tocca `ritornoRef`, che spetta all'effetto del
    // ritorno, subito dopo.
    if (window.location.pathname !== pathname) return;

    // Si azzera a ogni cambio di percorso: un Indietro che non cambia percorso (un
    // frammento) non deve far passare per ritorno la navigazione in avanti dopo.
    const ritorno = ritornoRef.current === pathname;
    ritornoRef.current = null;

    // Primo render escluso: un ingresso diretto su un'ancora (#id, skip-to-content)
    // deve restare dov'è, non essere riportato in cima.
    if (primoRender.current) {
      primoRender.current = false;
      return;
    }
    if (window.location.hash) return;

    if (ritorno) {
      // La posizione la rimette il browser, a volte prima di questo effetto e a volte
      // dopo (misurato: +13 ms contro +2 ms), e Lenis si allinea DA SÉ sull'evento di
      // scroll nativo del ripristino (`onNativeScroll`). Qui si ferma solo l'animazione
      // in corso: se l'utente scorre la scheda e preme Indietro mentre Lenis sta ancora
      // animando, il ripristino verrebbe ignorato (`isScrolling` è "smooth") e la pagina
      // finirebbe dove l'animazione era diretta. `stop()` + `start()` fa un `reset()`:
      // ferma l'animazione e porta bersaglio e posizione animata allo scroll nativo.
      // ⛔ Niente `scrollTo`, nemmeno immediato alla posizione corrente: accende
      // `_preventNextNativeScrollEvent` per un fotogramma, e se il ripristino cade lì
      // Lenis lo ignora e resta col bersaglio della pagina vecchia.
      // ⛔ Niente `resize()`: a ~+2 ms dal `popstate` il DOM è ancora quello della pagina
      // che si lascia e ne salverebbe l'altezza (difetto 2 nel commento sopra). Il limite
      // lo scrive il ResizeObserver del body, che campiona il fotogramma.
      const lenis = lenisRef.current;
      if (!lenis || lenis.isStopped) return;
      lenis.stop();
      lenis.start();

      // Rete per lo scroll del ripristino IGNORATO (difetto 4 nel commento sopra): se un
      // `scrollTo` immediato di Lenis, quello della navigazione in avanti, ha acceso
      // `_preventNextNativeScrollEvent` a ridosso dell'Indietro, il flag cade al
      // fotogramma dopo, e il commit della pagina nuova può impedirlo: Lenis scarta lo
      // scroll del ripristino e resta col bersaglio della pagina vecchia. Questo
      // ascoltatore è registrato DOPO quello di Lenis, quindi vede il suo esito: se Lenis
      // è fermo e il bersaglio non è dove si è, `resize()` lo riallinea (a quel punto il
      // DOM è quello nuovo: il ripristino a 2400 esiste solo su una pagina alta). Una
      // volta sola, e solo se non sta già animando: la ruota dopo il ritorno non cambia.
      const riallinea = () => {
        if (lenis.isScrolling === false && Math.abs(lenis.targetScroll - window.scrollY) > 1) {
          lenis.resize();
        }
      };
      window.addEventListener("scroll", riallinea, { passive: true, once: true });
      return () => window.removeEventListener("scroll", riallinea);
    }

    const alTop = () => {
      const lenis = lenisRef.current;
      // Sotto prefers-reduced-motion Lenis non esiste: si usa lo scroll nativo.
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo(0, 0);
    };

    alTop();
    assestamentoRef.current = true;

    // La finestra si chiude da sola, ma soprattutto si chiude al PRIMO gesto
    // dell'utente: senza questa uscita, un'immagine che finisce di caricare mentre
    // si sta già scorrendo farebbe risalire la pagina sotto le dita.
    const chiudi = () => {
      assestamentoRef.current = false;
      clearTimeout(timer);
      for (const ev of GESTI) window.removeEventListener(ev, chiudi);
    };
    const timer = setTimeout(chiudi, 700);
    for (const ev of GESTI) window.addEventListener(ev, chiudi, { passive: true, once: true });

    return chiudi;
  }, [pathname]);

  return <>{children}</>;
}
