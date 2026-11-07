import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { getDefaultSelectors } from "eslint-plugin-better-tailwindcss/defaults";
import { MatcherType, SelectorKind } from "eslint-plugin-better-tailwindcss/types";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Guardia sulle classi scritte a mano (B1 e B1-bis, 22/09/2026): taglie,
  // colori, interlinea e spaziatura si prendono da @theme, e una variabile si
  // legge con la forma breve `x-(--v)`. Due sole regole del plugin, nessun
  // preset: le regole stilistiche riscriverebbero le classi con l'autofix.
  // - no-restricted-classes, anche sotto varianti (`sm:`, `hover:`) e con `!`:
  //   `text-[…]` con un numero, clamp/calc/min/max o `length:` con un numero;
  //   colori a mano (#, rgb, hsl, `color:`) in text-, bg-, border-;
  //   ogni `leading-[…]` e `tracking-[…]`; e `[length:var(…)]`, che
  //   enforce-consistent-variable-syntax NON vede (provato con un file sintetico).
  // - enforce-consistent-variable-syntax, forma breve.
  // Selettori: oltre ai default (className, cn/clsx…, variabili `classes`),
  // le variabili di classi del repo — nomi in `Cls`/`Class`/`Classes`/
  // `ClassName` (`headingCls` nel footer: senza, B1 contava 42 e non 43) e le
  // costanti in maiuscolo (`FRECCIA` in blog-listing) — anche nei valori di
  // un oggetto (`sizeClasses` di Button). ⚠️ Il plugin confronta il nome PER
  // INTERO (`match[0] === name`), e NON legge un array che è l'oggetto di
  // `.join()`: per questo CENTER_UNDERLINE tiene l'array in una costante sua.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/app/globals.css",
        selectors: [
          ...getDefaultSelectors(),
          {
            kind: SelectorKind.Variable,
            name: String.raw`^(?:\w*(?:Cls|Class(?:es|Names?)?)|cls|class(?:es|Names?)?|[A-Z][A-Z0-9_]*)$`,
            match: [{ type: MatcherType.String }, { type: MatcherType.ObjectValue }],
          },
        ],
      },
    },
    rules: {
      "better-tailwindcss/no-restricted-classes": [
        "error",
        {
          restrict: [
            {
              pattern: String.raw`(^|:)!?text-\[(\d|\.|clamp\(|calc\(|min\(|max\(|length:\s*[\d.])`,
              message: "usa un token di @theme",
            },
            {
              pattern: String.raw`(^|:)!?(text|bg|border(-[xytrblse])?)-\[(#|rgba?\(|hsla?\(|color:)`,
              message: "usa un token di @theme",
            },
            {
              pattern: String.raw`(^|:)!?(leading|tracking)-\[`,
              message: "usa un token di @theme",
            },
            {
              pattern: String.raw`-\[length:var\(`,
              message: "usa la forma breve (length:--variabile)",
            },
            // Riordino dei token, Fase 1 (21/10/2026): i due valori che hanno preso un
            // nome, e i nomi tolti o rinominati. Senza il nostro valore, raggi e font
            // tolti tornerebbero ai default di Tailwind. Il divieto generale dei raggi e
            // delle larghezze scritti a mano arriva con la Fase 3, quando non ne restano.
            {
              pattern: String.raw`(^|:)!?rounded(-[a-z]{1,2})?-\[12px\]$`,
              message: "usa il raggio del token --radius-lg",
            },
            {
              pattern: String.raw`(^|:)!?max-w-\[1200px\]$`,
              message: "usa la larghezza del sito, --container-site",
            },
            {
              pattern: "(^|:)!?rounded(-[a-z]{1,2})?-(sm|md)$",
              message: "raggio tolto dal tema: tornerebbe al default di Tailwind",
            },
            {
              pattern: "(^|:)!?(font-(mono)|tracking-(6)|shadow-(nav))$",
              message: "token tolto dal tema il 21/10/2026",
            },
            {
              pattern: "(^|:)!?text-(display-secondary|section-heading)$",
              message: "token rinominato: la scala dei titoli è heading-1…4",
            },
            // Token, Fase 2 (23/10/2026): i valori che hanno preso un nome nella PR delle
            // «a», e il nome tolto. Senza il nostro valore `text-micro` non genererebbe niente.
            {
              pattern: String.raw`(^|:)!?border(-[xytrblse])?-\[0\.2rem\]$`,
              message: "usa lo spessore del token --fa-stroke",
            },
            {
              pattern: String.raw`(^|:)!?ease-\[cubic-bezier\(0\.33,1,0\.68,1\)\]$`,
              message: "usa la curva del token --ease-out-cubic",
            },
            {
              pattern: "(^|:)!?opacity-(40|50|55|60|70|85|90)$",
              message: "usa un token di opacità, --fa-opacity-*",
            },
            {
              pattern: "(^|:)!?text-micro$",
              message: "token tolto dal tema il 23/10/2026: è --text-micro-2",
            },
            // Le «b» di raggi, spaziature, durate, interlinea e ombre: i raggi scritti a mano
            // che hanno preso un nome (14 → 12 px, 18 → 16 px, 24 e 26 → 24 px).
            {
              pattern: String.raw`(^|:)!?rounded(-[a-z]{1,2})?-\[(14|18|24|26)px\]$`,
              message: "usa un raggio del tema: --radius-lg, --radius-xl, --radius-3xl",
            },
            // …e le durate che hanno un token, scritte col numero.
            {
              pattern: String.raw`(^|:)!?duration-(200|250|300|400|600|800|\[(200|250|300|400|600|800)ms\])$`,
              message: "usa una durata del tema, --dur-*",
            },
            // Spaziature (Marco, 30/10/2026, strada B): sulla griglia da 4 px. Vietati i mezzi passi
            // (6, 10, 14 px…; resta 0.5, i 2 px dei bordini) e le spaziature fra parentesi quadre:
            // una misura con `vh` o `clamp()` va in `:root` (`--fa-space-*`) e si legge `x-(--var)`.
            {
              pattern: String.raw`(^|:)!?-?(m|p)[trblxyse]?-[1-9]\d*\.5$|(^|:)!?(gap(-[xy])?|space-[xy])-[1-9]\d*\.5$`,
              message:
                "spaziatura fuori dalla griglia da 4 px: usa la scala o un ruolo (--spacing-*)",
            },
            {
              pattern: String.raw`(^|:)!?-?(m|p)[trblxyse]?-\[|(^|:)!?(gap(-[xy])?|space-[xy])-\[`,
              message:
                "spaziatura a mano: usa la scala, un ruolo (--spacing-*) o un token di :root (--fa-space-*)",
            },
            // PR dei colori: il bianco caldo è confluito nel crema.
            {
              pattern: String.raw`(^|:)!?(text|bg|border|outline|ring|fill|stroke)-fa-white-warm(/\d+)?$`,
              message:
                "token tolto dal tema: il testo su scuro è --fa-text-on-dark, i controlli --fa-paper",
            },
          ],
        },
      ],
      "better-tailwindcss/enforce-consistent-variable-syntax": ["error", { syntax: "shorthand" }],
    },
  },
  // Zod si importa da `@/lib/zod`, che lo configura `jitless` PRIMA di ogni schema:
  // senza, la sonda `new Function` di Zod è una violazione della CSP (15/10/2026). I
  // soli tipi possono venire da "zod", perché non eseguono niente.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/zod.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "zod",
              message: "importa z da @/lib/zod (jitless, per la CSP)",
              allowTypeImports: true,
            },
          ],
          patterns: [
            {
              group: ["zod/*"],
              message: "importa z da @/lib/zod (jitless, per la CSP)",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  // `sanity/types.gen.ts` lo scrive `pnpm typegen`, e da Sanity 6.13 chiude con un
  // ponte vuoto, `interface SanityQueries extends globalThis.SanityQueries {}`: è la
  // fusione di dichiarazioni che fa leggere il registro globale a `@sanity/client`, non
  // un tipo da riempire (15/10/2026). Spenta la sola regola che la vieta, sul solo file.
  {
    files: ["sanity/types.gen.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // SSD exFAT checkout: AppleDouble sidecars + gitignored scratch artifacts.
    "**/._*",
    "tmp/**",
    // La tavola dell'officina: sorgente e output, non codice del sito (spec tavola-officina).
    "tavola/**",
    "public/officina-tavola/**",
  ]),
]);

export default eslintConfig;
