[English](README.en.md) · **Italiano**

# Fontealta — sito istituzionale

Sito multilingua di **Fontealta**, azienda di Viareggio che produce docce e rubinetteria outdoor in acciaio inox AISI 316. Il sito è costruito attorno al catalogo: collezioni, prodotti, finiture e progetti realizzati sono gestiti da CMS e tradotti.

**Online:** [fontealta.it](https://www.fontealta.it) · visita interattiva all'officina: [fontealta.it/officina](https://www.fontealta.it/officina)

> Progetto progettato e sviluppato da **Marco Radice** per Luxury Academy, con Claude Code (con piccoli contributi di un collaboratore).
> Questa è una **copia pubblica per portfolio**: lo storico dei commit originale (oltre 1.300 commit, aprile–novembre 2026), le note interne, gli audit e i file di configurazione privati sono stati rimossi.

## Cosa c'è dentro

- **Catalogo multilingua** — collezioni, schede prodotto, finiture e progetti, con URL localizzati (italiano principale, inglese attivo).
- **CMS Sanity** integrato su `/studio`: chi gestisce il sito crea collezioni e prodotti senza toccare il codice. Tipi TypeScript generati dallo schema (`sanity/types.gen.ts`).
- **"Come nasce una colonna"** (`/officina`) — visita guidata animata all'officina in illustrazione isometrica: 12 tappe di produzione, dalla barra d'acciaio all'imballo, con navigazione, vista d'insieme e voce narrante. Sorgenti in `tavola/`.
- **Animazioni** con GSAP e scroll fluido con Lenis, caroselli con Swiper.
- **Moduli** validati con React Hook Form + Zod.
- **Qualità**: test unitari (Vitest), test end-to-end e di regressione visiva (Playwright), accessibilità (axe-core), budget di performance (Lighthouse CI).

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript strict |
| Stile | Tailwind CSS 4 (tema in `src/app/globals.css` con `@theme`) |
| CMS | Sanity (Studio integrato, Live Content API, internazionalizzazione documenti) |
| Lingue | next-intl 4 |
| Animazione | GSAP · Lenis · Swiper |
| Test | Vitest · Playwright · axe-core · Lighthouse CI |
| Deploy | Vercel |

## Struttura

```
src/app/(site)/[locale]/   pagine del sito, per lingua
src/components/            componenti dell'interfaccia
sanity/                    schema del CMS e tipi generati
tavola/                    visita interattiva "Come nasce una colonna"
tests/                     test e2e e di regressione
docs/                      mappa dell'architettura e guide per chi gestisce i contenuti
```

## Avvio in locale

Il package manager è **pnpm**.

```bash
pnpm install
cp .env.example .env.local   # inserisci ID progetto e dataset Sanity
pnpm dev                     # http://localhost:3000
```

Controlli prima di un commit: `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

Senza un progetto Sanity configurato le pagine di catalogo non hanno contenuti da mostrare.
