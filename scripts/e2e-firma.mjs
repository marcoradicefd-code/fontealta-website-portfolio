/**
 * L'e2e girato sul Mac e firmato (22/10/2026), al posto del job `e2e` della CI, che costava circa
 * 25 minuti fatturati a PR. Modello «CI locale con firma»: gh-signoff di Basecamp, bin/ci di Rails 8.1.
 *
 *   pnpm e2e:firma            albero pulito, ramo su `origin/main` → `pnpm test:e2e` → se verde, il segno
 *   pnpm e2e:firma pubblica   lo stato «e2e (locale)» sullo SHA di HEAD, se il push non l'ha già fatto
 *   … e2e-firma.mjs controlla hook PreToolUse di Claude Code: exit 2 su un `git push` senza segno
 *   … e2e-firma.mjs dopo-push hook PostToolUse: pubblica lo stato per quello che è stato spinto
 *
 * ⚠️ Il segno è per l'ALBERO del commit, non per lo SHA: l'amend del solo messaggio (il numero di PR nella
 * voce di history) non cambia una riga di codice e non deve costare un altro giro da 15 minuti. Lo stato
 * su GitHub va invece sullo SHA, perché è lì che la PR lo legge. I segni stanno nella cartella git comune,
 * quindi valgono da ogni worktree e non finiscono mai in un commit.
 *
 * ⚠️ Si firma solo un ramo che contiene l'ultimo `origin/main`: la CI provava il ref di merge, e la firma
 * deve provare lo stesso codice che arriverà su `main`.
 *
 * Soli documenti (i percorsi dei `@source not` di `globals.css`: `docs/`, `.claude/`, `*.md`,
 * `eslint.config.mjs`): il segno si scrive subito, senza build né e2e. Tailwind non li legge (#293), quindi
 * non entrano nel CSS servito; fino alla #293 la firma costruiva `origin/main` e confrontava il foglio.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO = "TecnicoLuxuryAcademy/fontealta-website";
const CONTEXT = "e2e (locale)";
// I nove non tracciati voluti (CLAUDE.md, Workflow): non entrano nel build e non sporcano l'albero.
const VOLUTI = [/^public\/finiture\/[A-Z]{2}\.png$/, /^backup-[\d-]+\.tar\.gz$/];
// Gli stessi percorsi dei `@source not` di `globals.css`: lo controlla `e2e-firma.test.ts`.
const DOCUMENTI = /^(docs\/|\.claude\/|eslint\.config\.mjs$)|\.md$/;
// Le stesse di `ci.yml`: `.env.local` nei worktree non c'è.
const ENV_SANITY = {
  NEXT_PUBLIC_SANITY_PROJECT_ID: "mwlqc6ab",
  NEXT_PUBLIC_SANITY_DATASET: "production",
  NEXT_PUBLIC_SANITY_API_VERSION: "2024-10-01",
};

const git = (dir, ...a) =>
  execFileSync("git", ["-C", dir, ...a], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const albero = (dir, rev) => git(dir, "rev-parse", `${rev}^{tree}`);
const cartellaSegni = (dir) =>
  path.join(path.resolve(dir, git(dir, "rev-parse", "--git-common-dir")), "e2e-firma");
const fileSegno = (dir, rev) => path.join(cartellaSegni(dir), `${albero(dir, rev)}.json`);

function leggiSegno(dir, rev) {
  try {
    return JSON.parse(readFileSync(fileSegno(dir, rev), "utf8"));
  } catch {
    return null;
  }
}

function sporchi(dir) {
  return git(dir, "status", "--porcelain", "--untracked-files=all")
    .split("\n")
    .filter(Boolean)
    .filter((r) => !(r.startsWith("?? ") && VOLUTI.some((v) => v.test(r.slice(3)))));
}

export function contieneOriginMain(dir) {
  try {
    git(dir, "merge-base", "--is-ancestor", "origin/main", "HEAD");
    return true;
  } catch {
    return false;
  }
}

export const soloDocumenti = (file) => file.length > 0 && file.every((f) => DOCUMENTI.test(f));

function esci(messaggio) {
  console.error(`e2e:firma: ${messaggio}`);
  process.exit(1);
}

function lancia(dir, comando, argomenti, env = {}) {
  const r = spawnSync(comando, argomenti, {
    cwd: dir,
    stdio: "inherit",
    env: { ...ENV_SANITY, ...process.env, ...env },
  });
  return r.status === 0;
}

function firma(dir) {
  const prima = sporchi(dir);
  if (prima.length) esci(`l'albero non è pulito, niente firma:\n${prima.join("\n")}`);
  git(dir, "fetch", "-q", "origin", "main");
  if (!contieneOriginMain(dir))
    esci("il ramo non contiene l'ultimo origin/main: fai il rebase su origin/main e rifirma");
  const sha = git(dir, "rev-parse", "HEAD");
  const inizio = Date.now();
  let segno = null;
  if (
    soloDocumenti(
      git(dir, "diff", "--name-only", "origin/main", "HEAD").split("\n").filter(Boolean),
    )
  ) {
    segno = { tipo: "documenti" };
  } else {
    const rapporto = path.join(tmpdir(), `e2e-firma-${sha}.json`);
    const verde = lancia(dir, "pnpm", ["test:e2e", "--reporter=list,json"], {
      PLAYWRIGHT_JSON_OUTPUT_FILE: rapporto,
    });
    if (!verde || !existsSync(rapporto)) esci("e2e rosso o interrotto, niente firma");
    const { stats } = JSON.parse(readFileSync(rapporto, "utf8"));
    segno = { tipo: "e2e", passati: stats.expected, saltati: stats.skipped, flaky: stats.flaky };
  }
  // Un commit o una modifica fatti mentre girava: la firma direbbe di un albero che non è stato provato.
  if (git(dir, "rev-parse", "HEAD") !== sha || sporchi(dir).length)
    esci("HEAD o l'albero sono cambiati durante il giro, niente firma");
  Object.assign(segno, {
    sha,
    albero: albero(dir, "HEAD"),
    minuti: Math.round((Date.now() - inizio) / 6_000) / 10,
    macos: execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).trim(),
    data: new Date().toISOString(),
  });
  mkdirSync(cartellaSegni(dir), { recursive: true });
  writeFileSync(fileSegno(dir, "HEAD"), `${JSON.stringify(segno, null, 2)}\n`);
  console.log(`e2e:firma: firmato ${sha.slice(0, 7)}, ${descrizione(segno)}`);
}

function descrizione(s) {
  if (s.tipo === "documenti") return `soli documenti · fuori dal CSS · macOS ${s.macos}`;
  const min = String(s.minuti).replace(".", ",");
  return `${s.passati} passati, ${s.saltati} saltati, ${s.flaky} flaky · ${min} min · macOS ${s.macos}`;
}

function pubblica(dir, rev = "HEAD") {
  const segno = leggiSegno(dir, rev);
  const sha = git(dir, "rev-parse", rev);
  if (!segno) throw new Error(`nessun segno per ${sha.slice(0, 7)}: lancia pnpm e2e:firma`);
  // prettier-ignore
  execFileSync("gh", ["api", `repos/${REPO}/statuses/${sha}`, "-f", "state=success", "-f", `context=${CONTEXT}`, "-f", `description=${descrizione(segno)}`], { stdio: ["ignore", "ignore", "pipe"] });
  return `${CONTEXT} su ${sha.slice(0, 7)}: ${descrizione(segno)}`;
}

/**
 * I `git push` di un comando Bash, ognuno con la cartella in cui gira e le revisioni che spinge. Segue i
 * `cd` che lo precedono e `git -C`; senza refspec spinge HEAD, con `a:b` spinge `a`; `--delete` e i refspec
 * `:b` non spingono codice. Quello che non si sa leggere (una `$(...)`, una variabile) torna come «?», e
 * il controllo lo blocca: meglio un push fermato per niente che uno non provato.
 */
export function pushDelComando(comando, cwd) {
  const spinte = [];
  let dir = cwd;
  for (const pezzo of comando.split(/&&|\|\||;|\n|\|/)) {
    const parole =
      pezzo.match(/"[^"]*"|'[^']*'|\S+/g)?.map((p) => p.replace(/^["']|["']$/g, "")) ?? [];
    if (parole[0] === "cd" && parole[1])
      dir = path.resolve(dir, parole[1].replace(/^~/, process.env.HOME ?? "~"));
    if (parole[0] !== "git") continue;
    let i = 1;
    let gitDir = dir;
    while (parole[i]?.startsWith("-")) {
      if (parole[i] === "-C") gitDir = path.resolve(dir, parole[++i]);
      i++;
    }
    if (parole[i] !== "push") continue;
    // Le redirezioni non sono argomenti: `2>&1`, `>file`, oppure `>` seguito dal file.
    const resto = [];
    for (let j = i + 1; j < parole.length; j++) {
      if (/^(\d*|&)(>>?|<)$/.test(parole[j])) j++;
      else if (!/^(\d*|&)(>>?|<)/.test(parole[j])) resto.push(parole[j]);
    }
    if (resto.some((p) => p === "--delete" || p === "-d")) continue;
    const prova = resto.includes("--dry-run") || resto.includes("-n");
    const refspec = resto.filter((p) => !p.startsWith("-")).slice(1);
    const revs = refspec.length
      ? refspec.map((r) => r.replace(/^\+/, "").split(":")[0]).filter(Boolean)
      : ["HEAD"];
    for (const rev of revs)
      spinte.push({ dir: gitDir, rev: /[$`]/.test(rev + gitDir) ? "?" : rev, prova });
  }
  return spinte;
}

function controlla() {
  const grezzo = readFileSync(0, "utf8");
  // Un input che non si legge non deve fermare ogni comando della sessione: si blocca solo se può essere
  // un push. Da qui in poi ogni errore interno blocca, perché un exit 1 lascerebbe passare il push.
  if (!grezzo.includes("push")) process.exit(0);
  try {
    const input = JSON.parse(grezzo);
    const senza = pushDelComando(input.tool_input?.command ?? "", input.cwd ?? process.cwd())
      .filter(({ dir, rev }) => rev === "?" || leggiSegno(dir, rev) === null)
      .map(({ dir, rev }) => `${rev} in ${dir}`);
    if (!senza.length) process.exit(0);
    console.error(
      `git push bloccato: manca la firma dell'e2e per ${senza.join(", ")}. ` +
        "Lancia pnpm e2e:firma nella cartella del ramo, a server spento, e poi rifai il push.",
    );
  } catch (e) {
    console.error(
      `git push bloccato: il controllo della firma è fallito (${e.message}). Lancia pnpm e2e:firma.`,
    );
  }
  process.exit(2);
}

function dopoPush() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const righe = [];
  for (const { dir, rev, prova } of pushDelComando(
    input.tool_input?.command ?? "",
    input.cwd ?? process.cwd(),
  )) {
    if (prova) continue;
    try {
      righe.push(pubblica(dir, rev));
    } catch (e) {
      righe.push(`${CONTEXT} NON pubblicato per ${rev}: ${String(e.stderr ?? e.message).trim()}`);
    }
  }
  if (righe.length) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: righe.join("\n") },
      }),
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const azione = process.argv[2];
  if (azione === "controlla") controlla();
  else if (azione === "dopo-push") dopoPush();
  else if (azione === "pubblica") console.log(pubblica(process.cwd()));
  else firma(process.cwd());
}
