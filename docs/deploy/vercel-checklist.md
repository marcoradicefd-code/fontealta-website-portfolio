# Vercel deploy checklist — Fontealta

> **7/10/2026.** Checklist pre-flight di giugno 2026. M7-B (webhook) chiuso a luglio con la Sprint 2.2: v. `docs/history.md`.

> ⚠️ **Stato al 29/07/2026.** Audit di **12 giugno**, non ri-eseguito. Il riferimento
> a `sprint/2-catalog-live` come branch di lavoro è **stantio**: quel branch ha 0
> commit esclusivi rispetto a `main` ed è 72 indietro (verificato 29/07). Resta
> **vera** la constatazione che non esiste config Vercel nel repo: `vercel.json` e
> `vercel.ts` sono tuttora assenti, l'autodetect regge.

**Data audit:** 12 giugno 2026 · **Branch:** `sprint/2-catalog-live` (CI verde `d69f758`) · **Stato:** ✅ blocker M7 **risolto** (fix applicati: TTL fetch 60 s + token preview — vedi §0). Nessuna config Vercel esistente (`vercel.json`/`vercel.ts` assenti — ok, autodetect).

---

## 0. ✅ M7 risolto — invalidazione contenuti (analisi e fix)

Verificato sul sorgente installato (`next-sanity@12.4.0`, `dist/live/conditions/react-server/index.js`):

1. `<SanityLive>` **non è montato da nessuna parte** in `src/` → nessuna cascata di richieste Live in produzione (la preoccupazione M7 originale non può verificarsi). ✅
2. **MA**: in produzione `sanityFetch` di `defineLive` cachea ogni query GROQ con `next: { revalidate: false, tags: ["sanity:<syncTag>…"] }` (cache **infinita**, invalidabile solo via tag).
3. Il route-level `export const revalidate = 60` delle pagine **non** sovrascrive il `revalidate` della singola fetch (regola Next.js): la pagina si rigenera, ma rilegge per sempre gli stessi dati dalla Data Cache.
4. Il webhook [`/api/revalidate`](../../src/app/api/revalidate/route.ts) chiama `revalidateTag(body._type)` (`"collection"`, `"model"`…) ma **nessuna fetch porta quei tag** (nessun call site passa `tags:`) → il webhook risponde 200 e non invalida nulla.

**Conseguenza su Vercel (pre-fix):** il sito avrebbe servito i contenuti congelati al build; le pubblicazioni da Studio non sarebbero mai apparse (fino al redeploy). In dev e in CI non si notava (in dev `revalidate` resta `undefined`, niente cache).

**Fix applicati (giugno 2026):**

- **TTL fetch (Opzione A):** [`sanity/lib/live.ts`](../../sanity/lib/live.ts) — `fetchOptions: { revalidate: 60 }` nella config `defineLive` → TTL 60 s a livello fetch, allineato all'intent `revalidate = 60` già presente su tutte le route. Pubblicazioni visibili in ~60-120 s.
- **Token preview:** [`/api/draft-mode/enable`](../../src/app/api/draft-mode/enable/route.ts) — `defineEnableDraftMode({ client: client.withConfig({ token: process.env.SANITY_API_READ_TOKEN }) })` (esempio ufficiale next-sanity); prima il client era token-less e `validatePreviewUrl` (che legge il documento privato `sanity.previewUrlSecret`) rispondeva sempre **401** in produzione.

**Deferred → M7-B (registro debiti):** invalidazione tag-based per call site (`tags` espliciti su ~15 `sanityFetch` + webhook `revalidateTag(_type)`) → cache lunga + invalidazione puntuale on-publish, al posto del TTL. Post-deploy. L'opzione "montare `<SanityLive>` in produzione" resta scartata (cascata richieste — il motivo di M7).

---

## 1. Environment variables

Censimento esaustivo (`grep process.env` su `src/`, `sanity/`, config root, `scripts/`). Le `NEXT_PUBLIC_*` sono **inlined al build**; ogni modifica env su Vercel richiede comunque redeploy.

| Variabile | Scope | Fase | Obbligatoria | Usata in | Valore |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | client+server | build (SSG) + runtime | ✅ sì — build **fallisce** se assente | [sanity/env.ts:8](../../sanity/env.ts#L8) | `mwlqc6ab` |
| `NEXT_PUBLIC_SANITY_DATASET` | client+server | build + runtime | ✅ sì — idem | [sanity/env.ts:13](../../sanity/env.ts#L13) | `production` |
| `NEXT_PUBLIC_SANITY_API_VERSION` | client+server | build + runtime | no (default `2024-10-01`) | [sanity/env.ts:18](../../sanity/env.ts#L18) | `2024-10-01` |
| `SANITY_API_READ_TOKEN` | **server-only** | runtime (solo draft/preview) | no per il sito pubblico; sì per la preview | [sanity/lib/live.ts:7](../../sanity/lib/live.ts#L7) (+ enable route dopo fix §0) | token **Viewer** da sanity.io/manage → API → Tokens |
| `SANITY_REVALIDATE_SECRET` | **server-only** | runtime | no — il webhook è deferred M7-B (senza secret la route rifiuta tutto con 401, innocuo) | [src/app/api/revalidate/route.ts:26](../../src/app/api/revalidate/route.ts#L26) | `openssl rand -base64 32` — stesso valore nel webhook Sanity quando si farà M7-B (§4) |
| `ZAPIER_CONTACT_WEBHOOK_URL` | **server-only** | runtime | ⚠️ **di fatto sì in Production**: se assente il form va in **dry-run silenzioso** (logga e finge successo, zero invii) | [contatti/_components/actions.ts:40](../../src/app/(site)/[locale]/contatti/_components/actions.ts#L40) | URL "Catch Hook" dello Zap |
| `NEXT_PUBLIC_SITE_URL` | client+server | build + runtime | consigliata: senza, il disable-preview reindirizza a `http://localhost:3000` | [api/draft-mode/disable/route.ts:10](../../src/app/api/draft-mode/disable/route.ts#L10) | `https://fontealta.it` (Preview: URL progetto vercel.app) |
| `IUBENDA_SITE_ID` + `IUBENDA_COOKIE_POLICY_ID` | server (render layout) | runtime | no — render condizionale (servono **entrambe**). Decisione cookie LOCKED: solo cookie tecnici → **lasciare vuote** (nessun banner) | [layout.tsx:68-69](../../src/app/(site)/[locale]/layout.tsx#L68-L69) | vuote (Sprint 2) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | client | build | no — script condizionale | [layout.tsx:70](../../src/app/(site)/[locale]/layout.tsx#L70) | dominio nudo, es. `fontealta.it` (quando si attiva analytics) |
| `R2_PUBLIC_URL` | — | — | **non usata a runtime** (tolta da `.env.example` il 15/10/2026; gli URL video R2 sono salvati per intero nei campi Sanity) | — | non serve su Vercel oggi |
| `SANITY_WRITE_TOKEN` | script seed locali | — | **mai su Vercel** | `scripts/` | — |

Nuance verificata: `assertValue` in `sanity/env.ts` lancia solo su `undefined` — una stringa **vuota** passerebbe e fallirebbe più avanti con errore meno chiaro. Su Vercel "non settata" = `undefined` → errore pulito; non settare mai `""` a mano.

## 2. Verifiche build (eseguite in questo audit)

- **Opzionali assenti → build OK.** Prova: CI verde `d69f758` — il job `build` gira **senza** `ZAPIER_CONTACT_WEBHOOK_URL`, `IUBENDA_*`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `R2_PUBLIC_URL`, `NEXT_PUBLIC_SITE_URL` e con `SANITY_API_READ_TOKEN`/`SANITY_REVALIDATE_SECRET` vuoti ([ci.yml:16-20](../../.github/workflows/ci.yml#L16-L20)). Il form in assenza di Zapier va in dry-run by design.
- **Obbligatorie assenti → fail chiaro e immediato.** Prova: import di `sanity/env.ts` senza env → `Error: Missing env: NEXT_PUBLIC_SANITY_PROJECT_ID` (a import time, quindi a inizio build).

## 3. Passi dashboard Vercel

1. **Import:** vercel.com → Add New → Project → GitHub `TecnicoLuxuryAcademy/fontealta-website` (repo privato: autorizzare la GitHub App sul repo).
2. **Framework:** Next.js (autodetect). Package manager: pnpm `11.0.4` rilevato dal campo `packageManager` (corepack). Build `next build`, install `pnpm install`, root `/`. Non serve `vercel.json`.
3. **Node:** 22 (allineato alla CI) — Project Settings → Build & Development se il default differisce.
4. **Env vars** (Settings → Environment Variables): inserire la tabella §1 per **Production** e **Preview**. Suggerimento: `ZAPIER_CONTACT_WEBHOOK_URL` solo in Production (i preview restano in dry-run, zero invii spuri); `NEXT_PUBLIC_SITE_URL` diversa per environment.
5. **Flusso branch:** push su `sprint/2-catalog-live` → Preview deploy; Production = merge PR su `main` (branch protection già attiva).
6. **Dominio:** Settings → Domains → `fontealta.it` + `www` (redirect www→apex) → aggiornare `NEXT_PUBLIC_SITE_URL` e fare redeploy.

## 4. Deferred (M7-B) — Webhook Sanity → `/api/revalidate`

> **Non necessario per il primo deploy.** Con il fix M7 (TTL fetch 60 s) l'invalidazione è time-based: il webhook oggi risponderebbe 200 senza invalidare nulla (le fetch portano solo sync tags `sanity:*`, non i `_type`). Diventa la via d'invalidazione quando si farà **M7-B** (tag espliciti per call site — vedi registro debiti). Configurazione da fare allora:

sanity.io/manage → progetto `mwlqc6ab` → API → Webhooks → Create:

- **URL:** `https://fontealta.it/api/revalidate` · **Dataset:** `production` · **Trigger:** Create + Update + Delete
- **Filter:** `_type in ["collection", "model", "projectReference", "finish", "ambient", "siteSettings"]`
- **Projection:** lasciare il default (il route legge `_type` e `slug.current` dal body)
- **Secret:** stesso valore di `SANITY_REVALIDATE_SECRET` · **Method:** POST
- Test (in M7-B): publish di prova → Webhooks → Attempts deve mostrare 200 `{"revalidated": true}` E il contenuto deve cambiare subito sul sito.

## 5. CORS + token Sanity (Studio embedded `/studio`)

sanity.io/manage → progetto → API → **CORS origins**:

- `https://fontealta.it` (+ `https://www.fontealta.it` se servita) — **Allow credentials ✓** (lo Studio embedded fa login dal dominio del sito)
- URL stabile del progetto Vercel (`https://<project>.vercel.app`) per usare lo Studio dai preview — i wildcard `*.vercel.app` non sono ammessi: i deploy-URL univoci non saranno coperti, usare lo Studio dal dominio stabile
- `http://localhost:3000` (dev) — già presente

**Tokens:** `SANITY_API_READ_TOKEN` = ruolo **Viewer** (serve a preview/draft; il sito pubblico legge il dataset public senza token).

## 6. Smoke test post-deploy

- [ ] `/` e `/en`, `/collezioni` + 1 detail, 1 `/modello/[slug]` (ISR on-demand: prima visita lenta poi cache), `/finiture`, `/contatti`
- [ ] Form contatti: con Zapier configurato lo Zap riceve il payload (campo `source` corretto); nei preview senza env → dry-run nei log
- [ ] `/studio` carica e fa login (CORS §5)
- [ ] **Publish di prova da Studio → contenuto visibile entro ~60-120 s** (TTL fetch 60 s, NON istantaneo — verifica del fix M7, il test che conta)
- [ ] Preview da Studio: `/api/draft-mode/enable` non risponde 401 (fix token §0); disable reindirizza al dominio (non a localhost)
- [ ] Language switcher su route dinamiche (M18 fix) e pagine legali raggiungibili
- [ ] Riattivare Lighthouse CI sui PR (M12) ora che esiste un deploy preview

---

*Generato dall'audit pre-flight del 12/6/2026; fix M7 (§0) applicati nello stesso batch. M7-B (tag-based invalidation + webhook) registrato nel registro debiti CLAUDE.md.*
