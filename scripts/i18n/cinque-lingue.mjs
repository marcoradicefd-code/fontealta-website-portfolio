#!/usr/bin/env node
/**
 * La guardia delle cinque lingue: typecheck e suite con `ACTIVE_LOCALES` uguale a
 * `ALL_LOCALES`, **senza accenderle** sul ramo.
 *
 * ⚠️ **Perché serve.** Le lingue spente non compilano niente: una tabella nuova scritta per
 * `it` ed `en`, un ternario `locale === "it" ? … : …`, un test che conta «2 ×», passano tutti
 * i controlli finché le lingue restano due. Si scoprono il giorno dell'accensione, che doveva
 * essere una riga e diventa una PR di undici file. Il 15/09/2026 erano 15 errori di typecheck e
 * 7 test rossi.
 *
 * Due modi:
 * - **di default**, in un worktree temporaneo di `HEAD`: il working tree non si tocca.
 *   ⚠️ Quindi prova il **commit**, non le modifiche non committate.
 * - **`--qui`**: riscrive la riga nel checkout corrente e **non la rimette**. Solo per la CI,
 *   dove il checkout si butta a fine job.
 *
 * `--build` aggiunge `pnpm build`: lento, legge Sanity, e in locale vuole le
 * `NEXT_PUBLIC_SANITY_*` esportate a mano, come fa `ci.yml`.
 *
 * ⚠️ Se la riga di `ACTIVE_LOCALES` cambia forma la guardia **fallisce**, non passa: una guardia
 * che non trova cosa riscrivere e poi fa girare la suite a due lingue direbbe verde su niente.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const argv = new Set(process.argv.slice(2));
const QUI = argv.has("--qui");
const BUILD = argv.has("--build");

const RIGA = /^export const ACTIVE_LOCALES = \[[^\]]*\] as const;$/m;
const ACCESA = "export const ACTIVE_LOCALES = ALL_LOCALES;";

/**
 * ⚠️ `git` e `pnpm` si cercano nel `PATH` di chi lancia lo script, ed è voluto: è uno strumento di
 * sviluppo e di CI, e `pnpm` sta in posti diversi su ogni macchina (Homebrew, corepack,
 * `pnpm/action-setup`). Un percorso fisso lo farebbe funzionare su una macchina sola. Sonar lo segnala
 * come hotspot da rivedere (S4036), non come difetto.
 */
function esegui(cwd, comando, args) {
  console.log(`\n  ▶ ${comando} ${args.join(" ")}`);
  return spawnSync(comando, args, { cwd, stdio: "inherit" }).status ?? 1;
}

function accendi(cwd) {
  const file = path.join(cwd, "src/i18n/routing.ts");
  const testo = readFileSync(file, "utf-8");
  const trovate = testo.match(new RegExp(RIGA.source, "gm")) ?? [];
  if (trovate.length !== 1) {
    throw new Error(
      `in src/i18n/routing.ts la riga di ACTIVE_LOCALES doveva comparire una volta, ne ho trovate ${trovate.length}`,
    );
  }
  writeFileSync(file, testo.replace(RIGA, ACCESA));
  if (!readFileSync(file, "utf-8").includes(ACCESA)) throw new Error("la riscrittura non ha preso");
  console.log(`\n  ✓ ${trovate[0]}\n    → ${ACCESA}`);
}

let dir = process.cwd();
let worktree = false;
try {
  if (!QUI) {
    dir = mkdtempSync(path.join(tmpdir(), "cinque-lingue-"));
    execFileSync("git", ["worktree", "add", "--detach", dir, "HEAD"], { stdio: "inherit" });
    worktree = true;
    if (esegui(dir, "pnpm", ["install", "--frozen-lockfile"]) !== 0)
      throw new Error("pnpm install non è andato");
  }
  accendi(dir);

  const passi = [["typecheck"], ["test"], ...(BUILD ? [["build"]] : [])];
  const esiti = passi.map((p) => [p[0], esegui(dir, "pnpm", p)]);
  console.log("\n  Cinque lingue attive:");
  for (const [passo, codice] of esiti) {
    const esito = codice === 0 ? "✓" : "✖";
    const coda = codice === 0 ? "" : " (exit " + codice + ")";
    console.log(`    ${esito} ${passo}${coda}`);
  }
  process.exitCode = esiti.every(([, c]) => c === 0) ? 0 : 1;
} catch (e) {
  // ⚠️ Mai `process.exit` qui dentro: salterebbe il `finally`, e il worktree resterebbe.
  console.error(`\n  ✖ ${e instanceof Error ? e.message : e}\n`);
  process.exitCode = 1;
} finally {
  if (worktree) execFileSync("git", ["worktree", "remove", "--force", dir], { stdio: "inherit" });
}
