**English** · [Italiano](README.md)

# Fontealta — company website

Multilingual website for **Fontealta**, a company in Viareggio (Italy) that makes outdoor showers and taps in AISI 316 stainless steel. The site is built around the catalogue: collections, products, finishes and completed projects are managed in a CMS and translated.

**Live:** [fontealta.it](https://www.fontealta.it) · interactive workshop tour: [fontealta.it/officina](https://www.fontealta.it/officina)

> Designed and developed by **Marco Radice** for Luxury Academy, with Claude Code (with small contributions from a collaborator).
> This is a **public portfolio copy**: the original commit history (over 1,300 commits, April–November 2026), internal notes, audits and private configuration files have been removed.

## What's inside

- **Multilingual catalogue** — collections, product pages, finishes and projects, with localised URLs (Italian primary, English live).
- **Sanity CMS** embedded at `/studio`: the people who run the site create collections and products without touching code. TypeScript types are generated from the schema (`sanity/types.gen.ts`).
- **"How a shower column is made"** (`/officina`) — an animated guided tour of the workshop in isometric illustration: 12 production steps, from the steel bar to packaging, with navigation, an overview mode and voice narration. Source in `tavola/`.
- **Animation** with GSAP, smooth scrolling with Lenis, carousels with Swiper.
- **Forms** validated with React Hook Form + Zod.
- **Quality**: unit tests (Vitest), end-to-end and visual regression tests (Playwright), accessibility checks (axe-core), performance budgets (Lighthouse CI).

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · strict TypeScript |
| Styling | Tailwind CSS 4 (theme in `src/app/globals.css` via `@theme`) |
| CMS | Sanity (embedded Studio, Live Content API, document internationalisation) |
| i18n | next-intl 4 |
| Animation | GSAP · Lenis · Swiper |
| Testing | Vitest · Playwright · axe-core · Lighthouse CI |
| Hosting | Vercel |

## Structure

```
src/app/(site)/[locale]/   site pages, per language
src/components/            UI components
sanity/                    CMS schema and generated types
tavola/                    interactive tour "How a shower column is made"
tests/                     e2e and regression tests
docs/                      architecture map and guides for content editors
```

## Running locally

The package manager is **pnpm**.

```bash
pnpm install
cp .env.example .env.local   # add your Sanity project ID and dataset
pnpm dev                     # http://localhost:3000
```

Checks before a commit: `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

Without a configured Sanity project the catalogue pages have no content to show.
