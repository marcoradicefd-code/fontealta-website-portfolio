"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Menu, X } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ACTIVE_LOCALES, ALL_LOCALES } from "@/i18n/routing";
import { nomeLingua } from "@/lib/lingue";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { LocaleFlag } from "./locale-flag";

// `useGSAP` registrato QUI, sotto gli import, e non in `initGsap()` accanto agli
// altri plugin (22/09/2026, B3). La registrazione dice all'hook quale istanza di
// gsap usare; se l'hook ne tiene un'altra, il suo context non vede i tween creati
// qui e alla smontatura non li revoca. `initGsap()` la chiama `LenisProvider` in
// un effetto, cioè DOPO il primo render della nav, quando il context di `useGSAP`
// è già nato. Misurato in `navigation-gsap.test.tsx`: senza questa riga i tween
// restano orfani.
gsap.registerPlugin(useGSAP);

// Path keys → entries in src/i18n/routing.ts pathnames map. Ogni voce qui DEVE
// avere una pagina: il ramo `href: null` descritto in passato non esiste piu' nel
// render, e una voce senza pagina darebbe 404. Area Riservata resta fuori da
// questa lista perche' e' una pill a destra, non una voce di menu: ha la sua
// pagina da settembre 2026 ed e' un Link a tutti gli effetti.
const navLinks = [
  { key: "chiSiamo", href: "/chi-siamo" },
  { key: "collezioni", href: "/collezioni" },
  { key: "produzione", href: "/produzione" },
  { key: "finiture", href: "/finiture" },
  { key: "blog", href: "/blog" },
  { key: "contatti", href: "/contatti" },
] as const;

export function Navigation() {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = useLocale();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const langPanelRef = useRef<HTMLUListElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const prefersReduced = usePrefersReducedMotion();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Chiude il menu mobile a ogni cambio route. Navigation vive nel layout e NON
  // smonta sulla navigazione client-side → senza, aprire il menu e navigare
  // lascerebbe `mobileOpen` true e quindi `body.overflow:"hidden"` (effetto sopra)
  // sulla pagina di destinazione = scroll bloccato. Reset DURANTE il render
  // (pattern React "adjust state on changed input"), NON in un effetto → evita la
  // regola lint `react-hooks/set-state-in-effect` e copre OGNI navigazione (link,
  // back/forward, programmatica); l'effetto sopra rilascia poi il body-lock.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  // Menu mobile FISSO (set 2026, decisione di Marco dopo due giri sull'iPhone): al tap il
  // pannello compare intero e già dipinto, e alla chiusura sparisce di colpo. Niente
  // rivelazione a clip-path, niente discesa, niente dissolvenza del contenuto: senza
  // animazione non esiste un fotogramma intermedio, e un lampo che restasse andrebbe
  // cercato FUORI dal pannello (tap highlight, header). La visibilità la decide il
  // render stesso (`style` qui sotto), quindi cambia nello stesso commit del tap e non
  // in un effetto che parte dopo il disegno.
  // ⚠️ Storia: fino al primo giro animava `autoAlpha` col clip (il fondo arrivava con la
  // transizione, a +16 ms opacità .12); poi solo il clip col pannello opaco, verde in
  // emulazione a passi di 16 ms e ancora col lampo sul telefono di Marco.

  // GSAP — espansione del box lingua: è il riquadro del bottone che cresce
  // (height 0 → auto). Misura fresh a ogni toggle: col pannello nascosto una misura
  // presa prima sarebbe stale. `overwrite:auto`
  // gestisce i toggle rapidi. `prefers-reduced-motion` → stato istantaneo.
  // `useGSAP` e non `useEffect` (22/09/2026, B3): stesso tween, ma registrato in
  // un `gsap.context()` che lo revoca quando il menu si smonta, così non restano
  // tween orfani (anche col doppio montaggio dello Strict Mode). ⚠️ `revertOnUpdate`
  // resta `false`, il default: con `true` il context riporterebbe gli stili inline
  // allo stato iniziale a OGNI cambio di `langOpen`, e la lista salterebbe prima
  // del tween. Niente `contextSafe`: i gestori cambiano solo lo stato, i tween
  // nascono tutti qui dentro.
  useGSAP(
    () => {
      const el = langPanelRef.current;
      if (!el) return;
      if (prefersReduced) {
        gsap.set(el, { height: langOpen ? "auto" : 0, opacity: langOpen ? 1 : 0 });
        return;
      }
      gsap.to(el, {
        height: langOpen ? "auto" : 0,
        opacity: langOpen ? 1 : 0,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      });
    },
    { dependencies: [langOpen, prefersReduced], scope: mobileMenuRef },
  );

  const languages = ALL_LOCALES.map((code) => ({
    code,
    name: nomeLingua(code),
    active: (ACTIVE_LOCALES as readonly string[]).includes(code),
  }));

  const handleLocaleChange = (code: string) => {
    setLangOpen(false);
    if (code === currentLocale) return;
    if (!(ACTIVE_LOCALES as readonly string[]).includes(code)) return;
    // M18: pathname può essere un template dinamico ("/collezioni/[slug]"…).
    // Passare i params correnti (useParams) in object-form risolve [slug].
    router.replace(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { pathname: pathname as any, params: params as any },
      { locale: code as (typeof ACTIVE_LOCALES)[number] },
    );
  };

  // Header trasparente sulle route con hero scuro full-bleed (home + collezioni):
  // nav trasparente in cima, solida allo scroll. Su ogni altra route → barra scura
  // solida (testo bianco leggibile anche su pagine light, es. legali/chi-siamo/
  // finiture). Evita nav invisibile su sfondo chiaro.
  const TRANSPARENT_HERO_ROUTES = ["/", "/collezioni", "/chi-siamo", "/produzione"];
  const conHeroScuro = TRANSPARENT_HERO_ROUTES.includes(pathname);
  const solidHeader = scrolled || !conHeroScuro;

  return (
    <>
      {/* Lo scrim serve al testo della barra sopra una FOTO, e sta FUORI dall'header,
          SOTTO il pannello del menu (z 35 < 40 < 50). ⚠️ Fino a settembre 2026
          stava dentro l'header, che è z-50: dipingeva SOPRA il pannello, quindi si
          smontava all'apertura (`!mobileOpen`). Ma si smontava nello stesso commit
          del tap, uno o due fotogrammi prima che il pannello si dipingesse, e per
          quei fotogrammi la parte alta della foto restava scoperta: la barra
          passava da luminanza 70 a 141 su Android e da 40 a 63 su iOS, misurato a
          passi di 16 ms. È l'abbaglio «al clic sull'hamburger». Qui sotto il
          pannello opaco lo COPRE invece di sostituirlo, e al tap non cambia niente.
          SFUMA, non si smonta (16/10/2026, decisione di Marco: la barra sfuma in 300 ms,
          e il cambio di colpo era troppo brusco). Lo scrim resta montato sulle rotte col
          hero scuro e passa da opacità 1 a 0 in sincronia col fondo dell'header, e al
          ritorno il contrario. Smontato di colpo mentre il fondo partiva da alfa 0, al
          primo fotogramma la barra SALIVA (390, home: luminanza 93 → 156) prima di
          scendere. Custodito da `tests/regression/barra-scorrimento.spec.ts`. */}
      {conHeroScuro && (
        <div
          aria-hidden="true"
          className={
            solidHeader
              ? "fa-nav-scrim opacity-0 transition-opacity duration-(--dur-control)"
              : "fa-nav-scrim transition-opacity duration-(--dur-control)"
          }
        />
      )}
      <header
        className={`fixed top-0 right-0 left-0 z-50 h-(--fa-nav-h) transition-all duration-(--dur-control) ${
          solidHeader
            ? "border-b border-fa-white-08 bg-fa-ink/90 backdrop-blur-xl backdrop-saturate-[180%]"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <nav
          // Stringhe INTERE e non concatenate: `prettier-plugin-tailwindcss`
          // riordina le classi anche dentro le interpolazioni e si mangia lo
          // spazio, saldando due classi in una che non esiste in nessun foglio.
          className={
            solidHeader
              ? "mx-auto flex h-full max-w-site items-center justify-between px-6"
              : "fa-nav-chiara mx-auto flex h-full max-w-site items-center justify-between px-6"
          }
          aria-label={t("ariaLabel")}
        >
          {/* Logo: monogram + wordmark. Lo stesso lockup sta nel footer: si cambiano insieme.
              Il simbolo è alto 36 px e largo in proporzione al file (1146 × 1241, circa 33,2 px):
              fino al 27/10/2026 era un quadrato 36 × 36 e il disegno usciva stirato dell'8%.
              Servito da next/image (circa 1,9 KB invece dei 16 KB del PNG originale). */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/fontealta-monogram-gray.png"
              alt=""
              width={33}
              height={36}
              aria-hidden
              className="aspect-[1146/1241] h-9 w-auto"
            />
            <span className="text-lg font-bold tracking-7 text-fa-text-on-dark uppercase">
              FONTEALTA
            </span>
          </Link>

          {/* Desktop nav */}
          {/* ⚠️ `xl` e non `lg` (set 2026, PR 5): la soglia è MISURATA sulla lingua più
              lunga. A 1152 px di contenuto le voci tedesche più le due pill ne vogliono
              1113, e fra 1024 e 1279 «Über uns» andava a capo sul logo; in italiano
              succedeva lo stesso a 1024. Sotto questa soglia comanda l'hamburger, che le
              voci le mostra tutte. Le quattro classi qui sotto e la fascia `.fa-nav-scrim`
              si muovono INSIEME: una barra che cambia forma a una larghezza e la sua
              protezione a un'altra è un'incoerenza che non si ritrova più. */}
          <ul className="hidden items-center gap-8 xl:flex">
            {navLinks.map((link) => (
              <li key={link.key}>
                <Link
                  href={link.href}
                  className="text-nav font-medium text-fa-text-on-dark/82 uppercase transition-colors duration-(--dur-micro) hover:text-fa-text-on-dark"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right: language dropdown (stylized brand flags, enlarged) + Area Riservata */}
          <div className="hidden items-center gap-4 xl:flex">
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                aria-label={t("langLabel")}
                className="fa-nav-pill flex h-(--btn-height-s) items-center gap-3 rounded-pill border-(length:--fa-stroke-hairline) border-(--fa-stroke-color) px-(--btn-pad-s) text-(length:--btn-font-s) font-medium text-fa-text-on-dark transition-colors duration-(--dur-micro) hover:bg-white/10 pointer-coarse:min-h-(--fa-touch-min)"
              >
                <LocaleFlag code={currentLocale} className="h-4 w-[22px]" />
                {nomeLingua(currentLocale)}
                <ChevronDown
                  size={17}
                  className={`transition-transform duration-(--dur-micro) ${langOpen ? "rotate-180" : ""}`}
                />
              </button>
              {langOpen && (
                // Intentional custom listbox (not a native <select>): renders flag
                // images + "coming soon" disabled locales + GSAP animation, none of
                // which <select> supports. Items carry role=option/aria-selected;
                // the "prefer <select>" Sonar rule is a documented won't-fix.
                <ul
                  role="listbox"
                  className="absolute right-0 z-50 mt-3 min-w-[210px] overflow-hidden rounded-2xl border border-fa-border-dark bg-fa-ink/95 py-2 backdrop-blur-xl"
                >
                  {languages.map((lang) => (
                    <li key={lang.code}>
                      <button
                        type="button"
                        role="option"
                        disabled={!lang.active}
                        aria-selected={lang.code === currentLocale}
                        aria-current={lang.code === currentLocale ? "true" : undefined}
                        onClick={() => handleLocaleChange(lang.code)}
                        title={!lang.active ? t("comingSoon") : undefined}
                        className={`flex w-full items-center gap-3 px-5 py-3 text-left text-button transition-colors duration-150 ${
                          !lang.active
                            ? "cursor-not-allowed text-fa-text-on-dark/30"
                            : lang.code === currentLocale
                              ? "bg-white/5 text-fa-text-on-dark"
                              : "text-fa-text-on-dark/70 hover:bg-white/10"
                        }`}
                      >
                        <LocaleFlag
                          code={lang.code}
                          className={`h-4 w-[22px] ${lang.active ? "" : "opacity-(--fa-opacity-inactive) grayscale"}`}
                        />
                        {lang.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Area Riservata ha una pagina «in costruzione» da settembre 2026:
                era `disabled` + tooltip «Coming soon» finché `/area-pro` dava
                404, adesso è un link vero. Stessa forma della pill lingua qui
                sopra — è il controllo attivo che le sta accanto — meno il
                lo spazio fra bandiera e testo, che serve solo alla bandiera. `fa-nav-pill` la aggancia
                alle regole di `.fa-nav-chiara` (bianco pieno + fondo d'inchiostro
                in modalità trasparente), che prima la escludevano apposta.
                TRACCIA: le due pill dell'header e le due del menu mobile hanno il colore
                dei CTA outline e delle card, `--fa-stroke-color` bianco puro (prima bianco
                caldo al 40%, dipinto grigio), e restano a 1 px: i 3 px sono solo dei CTA
                outline, deciso da Marco a video. */}
            <Link
              href="/area-riservata"
              className="fa-nav-pill inline-flex h-(--btn-height-s) items-center rounded-pill border-(length:--fa-stroke-hairline) border-(--fa-stroke-color) px-(--btn-pad-s) text-(length:--btn-font-s) font-medium text-fa-text-on-dark transition-colors duration-(--dur-micro) hover:bg-white/10 pointer-coarse:min-h-(--fa-touch-min)"
            >
              {t("areaPro")}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-fa-text-on-dark xl:hidden"
            onClick={() => {
              setMobileOpen((o) => !o);
              setLangOpen(false);
            }}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>
      </header>

      {/* Backdrop per chiudere il dropdown lingua (desktop) */}
      {langOpen && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          className="fixed inset-0 z-40 hidden cursor-default xl:block"
          onClick={() => setLangOpen(false)}
        />
      )}

      {/* Menu mobile FISSO: visibile o nascosto nello stesso render del tap, senza
          animazione (vedi il commento sopra l'effetto del box lingua). Nascosto anche nell'HTML
          del server, quindi niente lampo prima dell'idratazione. `visibility: hidden`
          lo toglie anche dal fuoco.
          `data-lenis-prevent` (16/10/2026): senza, Lenis prende la rotella sulla finestra
          (`smoothWheel`) e il pannello non scorre, mentre la pagina sotto sì, anche col
          `body` a `overflow: hidden`, perché Lenis la muove da script. Con l'attributo
          Lenis esce prima del suo `preventDefault` (`lenis.mjs:605-612`, README «Nested
          scroll») e la rotella torna nativa: scorre il pannello, e `overscroll-contain`
          ferma la catena. */}
      <div
        ref={mobileMenuRef}
        data-lenis-prevent
        className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-fa-ink xl:hidden"
        style={{ visibility: mobileOpen ? "visible" : "hidden" }}
        aria-hidden={!mobileOpen}
      >
        {/* min-h-full + justify-center: centrato quando il contenuto ci sta, ma se
            cresce (box lingua espanso / viewport bassi) l'overlay scrolla invece di
            tagliare le ultime lingue e la pill Area Riservata. py-20 = clearance
            header (--fa-nav-h) sopra + respiro sotto. */}
        {/* `gap-10` e non `gap-8`: a 390 le voci stavano a 32 px l'una dall'altra e la
            lettura era compatta. 40 px, e la pill Area staccata di 16, sono i valori dei
            provini scelti da Marco. */}
        <nav className="flex min-h-full flex-col items-center justify-center gap-10 px-6 py-20">
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              data-mobile-item
              onClick={() => setMobileOpen(false)}
              className="text-display-3 font-bold text-fa-text-on-dark transition-colors duration-(--dur-micro) hover:text-fa-text-on-dark/82"
            >
              {t(link.key)}
            </Link>
          ))}

          {/* Mobile language — è il riquadro DEL BOTTONE che si espande: un unico
              contenitore bordato (stile pill Area Riservata) che cresce in altezza,
              NON un pannello staccato sotto. Collapsed = pill (locale corrente +
              chevron); open = lo stesso box con le 5 lingue dentro, separate da un
              `border-t`. `overflow-hidden` clippa il contenuto ai bordi arrotondati.
              Stato `langOpen` condiviso col desktop; l'hamburger lo resetta. */}
          <div
            data-mobile-item
            className="overflow-hidden rounded-3xl border border-(--fa-stroke-color) bg-fa-ink/40 text-fa-text-on-dark"
          >
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label={t("langLabel")}
              className="flex min-h-(--fa-touch-min) w-full items-center justify-center gap-3 px-5 py-3 text-button font-medium transition-colors duration-(--dur-micro) hover:bg-white/10"
            >
              <LocaleFlag code={currentLocale} className="h-4 w-[22px]" />
              {nomeLingua(currentLocale)}
              <ChevronDown
                size={17}
                className={`transition-transform duration-(--dur-micro) ${langOpen ? "rotate-180" : ""}`}
              />
            </button>
            {/* Sempre montato (serve a GSAP per animare height 0↔auto + reverse).
                Da chiuso: height/opacity 0 (inline iniziale) + inert/aria-hidden → fuori dal tab order. */}
            <ul
              ref={langPanelRef}
              role="listbox"
              aria-label={t("langLabel")}
              aria-hidden={!langOpen}
              inert={!langOpen || undefined}
              style={{ height: 0, opacity: 0, overflow: "hidden" }}
              className="[&>li:last-child]:pb-1"
            >
              {languages.map((lang) => (
                <li key={lang.code}>
                  <button
                    type="button"
                    role="option"
                    disabled={!lang.active}
                    aria-selected={lang.code === currentLocale}
                    aria-current={lang.code === currentLocale ? "true" : undefined}
                    onClick={() => {
                      handleLocaleChange(lang.code);
                      setMobileOpen(false);
                    }}
                    title={!lang.active ? t("comingSoon") : undefined}
                    className={`flex min-h-(--fa-touch-min) w-full items-center justify-center gap-3 px-6 py-2 text-button transition-colors duration-150 ${
                      !lang.active
                        ? "cursor-not-allowed text-fa-text-on-dark/30"
                        : lang.code === currentLocale
                          ? "bg-white/5 text-fa-text-on-dark"
                          : "text-fa-text-on-dark/70 hover:bg-white/10"
                    }`}
                  >
                    <LocaleFlag
                      code={lang.code}
                      className={`h-4 w-[22px] ${lang.active ? "" : "opacity-(--fa-opacity-inactive) grayscale"}`}
                    />
                    {lang.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Il gemello mobile della pill desktop. Qui il pannello è opaco
              (`bg-fa-ink`) e vive FUORI dall'header, quindi `.fa-nav-chiara` non
              lo raggiunge e non serve `fa-nav-pill`. `onClick` chiude l'overlay
              come le altre voci: senza, si navigherebbe con il menu ancora
              aperto sopra la pagina nuova. */}
          <Link
            href="/area-riservata"
            data-mobile-item
            onClick={() => setMobileOpen(false)}
            className="mt-4 inline-flex h-(--btn-height-s) items-center rounded-pill border-(length:--fa-stroke-hairline) border-(--fa-stroke-color) px-(--btn-pad-s) text-(length:--btn-font-s) font-medium text-fa-text-on-dark transition-colors duration-(--dur-micro) hover:bg-white/10 pointer-coarse:min-h-(--fa-touch-min)"
          >
            {t("areaPro")}
          </Link>
        </nav>
      </div>
    </>
  );
}
