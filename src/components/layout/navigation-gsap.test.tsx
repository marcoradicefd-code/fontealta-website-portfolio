/**
 * Il box lingua del menu mobile e GSAP (B3, 22/09/2026).
 *
 * Due guardie sulla `Navigation` vera, montata in jsdom con i moduli di Next e
 * next-intl sostituiti da finti minimi:
 *
 * 1. il tween dell'apertura è quello di sempre — altezza `auto`, opacità 1,
 *    0,3 s, `power2.out`, `overwrite: "auto"` — così il passaggio a `useGSAP`
 *    non cambia l'animazione;
 * 2. smontando il menu mentre la lista si sta aprendo, in `gsap.globalTimeline`
 *    non resta nessun tween, con e senza Strict Mode. Col vecchio `useEffect`,
 *    che non aveva un cleanup, il tween restava orfano: su `main` di prima di B3
 *    questa guardia è rossa.
 *
 * ⚠️ La timeline globale è in PAUSA per tutta la durata: il tween non avanza e
 * non finisce da solo, quindi se resta vivo dopo lo smontaggio è perché nessuno
 * l'ha revocato, non perché il test è stato lento.
 */
import { StrictMode, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { gsap } from "gsap";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "it",
}));
vi.mock("next/navigation", () => ({ useParams: () => ({}) }));
// Il monogramma del logo: al test non serve un'immagine, basta un nodo.
vi.mock("next/image", () => ({ default: () => <span /> }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  usePathname: () => "/",
  useRouter: () => ({ replace: () => {} }),
}));
vi.mock("@/hooks/use-prefers-reduced-motion", () => ({ usePrefersReducedMotion: () => false }));
vi.mock("./locale-flag", () => ({ LocaleFlag: () => <span /> }));

import { Navigation } from "./navigation";

const figli = () => gsap.globalTimeline.getChildren(true, true, true).length;

let root: Root | null = null;
let contenitore: HTMLDivElement | null = null;

function monta(strict: boolean) {
  contenitore = document.createElement("div");
  document.body.appendChild(contenitore);
  root = createRoot(contenitore);
  act(() =>
    root!.render(
      strict ? (
        <StrictMode>
          <Navigation />
        </StrictMode>
      ) : (
        <Navigation />
      ),
    ),
  );
  return contenitore;
}

function apriLista(c: HTMLElement) {
  const hamburger = c.querySelector<HTMLButtonElement>('button[aria-label="openMenu"]');
  const bottone = c.querySelector<HTMLButtonElement>(
    'div[data-mobile-item] > button[aria-haspopup="listbox"]',
  );
  const lista = c.querySelector<HTMLUListElement>('div[data-mobile-item] > ul[role="listbox"]');
  expect(hamburger && bottone && lista).toBeTruthy();
  act(() => hamburger!.click());
  act(() => bottone!.click());
  return lista!;
}

describe("il box lingua del menu mobile e GSAP", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    gsap.globalTimeline.pause();
  });
  afterAll(() => {
    gsap.globalTimeline.resume();
  });
  afterEach(() => {
    if (root) act(() => root!.unmount());
    contenitore?.remove();
    root = null;
    contenitore = null;
  });

  it("l'apertura è il tween di sempre: height auto, opacità 1, 0,3 s, power2.out, overwrite auto", () => {
    const lista = apriLista(monta(false));
    const tween = gsap.getTweensOf(lista).at(-1);
    expect(tween?.vars).toMatchObject({
      height: "auto",
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  });

  it.each([
    ["senza Strict Mode", false],
    ["in Strict Mode", true],
  ])("smontando il menu a metà apertura non resta nessun tween (%s)", (_nome, strict) => {
    const prima = figli();
    const lista = apriLista(monta(strict));
    expect(gsap.getTweensOf(lista).length).toBeGreaterThan(0);
    expect(figli()).toBeGreaterThan(prima);

    act(() => root!.unmount());
    root = null;
    expect(figli()).toBe(prima);
  });
});
