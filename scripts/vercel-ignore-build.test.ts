// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * L'Ignored Build Step di Vercel su repository VERI, creati al volo.
 *
 * Lo script decide se un push costruisce: sbagliare in un verso spreca un build,
 * sbagliare nell'altro lascia online un sito vecchio. Il 17/09/2026 è stato provato
 * a secco su dieci commit veri di questo repo, in cloni a profondità 10 come quelli
 * di Vercel; qui restano i casi, su storie sintetiche che il tempo non cambia.
 *
 * ⚠️ Il caso che vale di più è `codice poi documenti nello stesso push`: la ricetta
 * della documentazione Vercel (`git diff HEAD^ HEAD`) guarda solo l'ultimo commit e
 * lo salterebbe. È successo davvero con 20769b0.
 */

const SCRIPT = path.resolve(process.cwd(), "scripts/vercel-ignore-build.sh");

function repo() {
  const dir = mkdtempSync(path.join(tmpdir(), "ignora-build-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  git("config", "commit.gpgsign", "false");
  const scrivi = (file: string, testo = String(Math.random())) => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), testo);
  };
  const commit = (messaggio: string, ...file: string[]) => {
    for (const f of file) scrivi(f);
    git("add", "-A");
    git("commit", "-q", "-m", messaggio);
    return git("rev-parse", "HEAD");
  };
  return { dir, git, commit };
}

/** Una storia come quella di `main`: un commit iniziale e un merge di PR. */
function mainConUnMerge() {
  const r = repo();
  r.commit("iniziale", "src/app.ts", "docs/leggimi.md");
  r.git("checkout", "-q", "-b", "feat/uno");
  r.commit("feat: uno", "src/uno.ts");
  r.git("checkout", "-q", "main");
  r.git("merge", "-q", "--no-ff", "-m", "Merge pull request #1 from org/feat/uno", "feat/uno");
  return { ...r, merge: r.git("rev-parse", "HEAD") };
}

function decide(dir: string, env: Record<string, string>) {
  const esito = spawnSync("bash", [SCRIPT], {
    cwd: dir,
    encoding: "utf8",
    // Ambiente PULITO: solo quello che serve a git, più le variabili del caso. Le
    // VERCEL_* della macchina non devono decidere al posto del test.
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env },
  });
  return { salta: esito.status === 0, codice: esito.status, uscita: esito.stdout };
}

describe("vercel-ignore-build.sh", () => {
  it("salta i rami di Dependabot, senza guardare git", () => {
    const { dir } = mainConUnMerge();
    expect(
      decide(dir, { VERCEL_GIT_COMMIT_REF: "dependabot/npm_and_yarn/next-16.2.1" }).salta,
    ).toBe(true);
  });

  it("salta quando dall'ultimo deploy sono cambiati solo docs/, *.md, .claude/ e tmp/", () => {
    const { dir, commit, merge } = mainConUnMerge();
    commit(
      "docs",
      "docs/history/voce.md",
      "CLAUDE.md",
      ".claude/agents/agente.md",
      "tmp/appunto.txt",
    );
    const d = decide(dir, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_PREVIOUS_SHA: merge });
    expect(d.salta, d.uscita).toBe(true);
  });

  it("salta quando cambia solo il sorgente della tavola, che il sito non serve", () => {
    const { dir, commit, merge } = mainConUnMerge();
    commit("tavola", "tavola/src.html", "tavola/i18n/it.json");
    const d = decide(dir, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_PREVIOUS_SHA: merge });
    expect(d.salta, d.uscita).toBe(true);
  });

  it("costruisce quando cambia l'output della tavola in public/officina-tavola/", () => {
    const { dir, commit, merge } = mainConUnMerge();
    commit("tavola web", "public/officina-tavola/index.html");
    expect(
      decide(dir, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_PREVIOUS_SHA: merge }).salta,
    ).toBe(false);
  });

  it("costruisce quando cambia il codice", () => {
    const { dir, commit, merge } = mainConUnMerge();
    commit("fix", "src/app.ts");
    expect(
      decide(dir, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_PREVIOUS_SHA: merge }).salta,
    ).toBe(false);
  });

  it("costruisce quando cambia un workflow: .github/ non è un documento", () => {
    const { dir, commit, merge } = mainConUnMerge();
    commit("ci", ".github/workflows/ci.yml");
    expect(
      decide(dir, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_PREVIOUS_SHA: merge }).salta,
    ).toBe(false);
  });

  it("costruisce quando cambiano scripts/ o tests/: entrano nel typecheck del build", () => {
    const { dir, commit, merge } = mainConUnMerge();
    commit("test", "tests/regression/prova.spec.ts");
    expect(
      decide(dir, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_PREVIOUS_SHA: merge }).salta,
    ).toBe(false);
  });

  it("guarda TUTTO il push e non l'ultimo commit: codice poi documenti costruisce", () => {
    const { dir, commit, merge } = mainConUnMerge();
    commit("feat", "src/nuovo.ts");
    commit("docs", "docs/history/voce.md");
    const d = decide(dir, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_PREVIOUS_SHA: merge });
    expect(d.salta, d.uscita).toBe(false);
  });

  it("al primo deploy di un ramo confronta con l'ultimo merge di PR", () => {
    const { dir, git, commit } = mainConUnMerge();
    git("checkout", "-q", "-b", "chore/docs");
    commit("docs uno", "docs/a.md");
    commit("docs due", "ARCHITECTURE.md");
    expect(decide(dir, { VERCEL_GIT_COMMIT_REF: "chore/docs" }).salta).toBe(true);
    commit("un file di codice", "src/tre.ts");
    commit("e di nuovo documenti", "docs/b.md");
    expect(decide(dir, { VERCEL_GIT_COMMIT_REF: "chore/docs" }).salta).toBe(false);
  });

  it("fallisce aperto: base che non esiste nel clone, o rideploy dello stesso commit", () => {
    const { dir, merge } = mainConUnMerge();
    expect(
      decide(dir, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_PREVIOUS_SHA: "0".repeat(40) }).salta,
    ).toBe(false);
    expect(
      decide(dir, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_PREVIOUS_SHA: merge }).salta,
    ).toBe(false);
  });
});
