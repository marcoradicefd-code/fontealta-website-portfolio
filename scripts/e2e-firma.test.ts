// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contieneOriginMain, pushDelComando, soloDocumenti } from "./e2e-firma.mjs";

/**
 * La firma dell'e2e (22/10/2026) su repository VERI, creati al volo, e l'hook lanciato come lo lancia
 * Claude Code: il JSON del comando sullo stdin, exit 2 per bloccare. Il caso che vale di più è il push
 * senza segno: se l'hook esce con 1 invece che con 2, Claude Code lo tratta come un errore che non
 * blocca, e il push parte.
 */

const SCRIPT = path.resolve(process.cwd(), "scripts/e2e-firma.mjs");

function repo(origine?: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "e2e-firma-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  if (origine) execFileSync("git", ["clone", "-q", origine, dir], { stdio: "ignore" });
  else git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  git("config", "commit.gpgsign", "false");
  const commit = (messaggio: string, file: string) => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), String(Math.random()));
    git("add", "-A");
    git("commit", "-q", "-m", messaggio);
    return git("rev-parse", "HEAD");
  };
  return { dir, git, commit };
}

function hook(comando: string, cwd: string) {
  const input = JSON.stringify({ tool_name: "Bash", cwd, tool_input: { command: comando } });
  return spawnSync("node", [SCRIPT, "controlla"], { input, encoding: "utf8" });
}

describe("pushDelComando", () => {
  it("trova cartella e revisione dei push, e ignora il resto", () => {
    expect(pushDelComando("git status", "/r")).toEqual([]);
    expect(pushDelComando("echo git push è una parola", "/r")).toEqual([]);
    expect(pushDelComando("cd /wt && git push -u origin ramo", "/r")).toEqual([
      { dir: "/wt", rev: "ramo", prova: false },
    ]);
    expect(
      pushDelComando("git -C /wt push --dry-run origin HEAD:refs/heads/x 2>&1 | tail -2", "/r"),
    ).toEqual([{ dir: "/wt", rev: "HEAD", prova: true }]);
    expect(pushDelComando("git push", "/r")).toEqual([{ dir: "/r", rev: "HEAD", prova: false }]);
    expect(pushDelComando("git push origin --delete vecchio", "/r")).toEqual([]);
  });

  it("quello che non sa leggere torna come «?», e il controllo lo blocca", () => {
    expect(pushDelComando("git push origin $(git branch --show-current)", "/r")[0].rev).toBe("?");
  });
});

describe("soloDocumenti", () => {
  it("docs/, .claude/, i .md e la config di ESLint sì; il codice e un diff vuoto no", () => {
    expect(
      soloDocumenti([
        "docs/history/x.md",
        ".claude/rules/ci-deploy.md",
        "CLAUDE.md",
        "scripts/x.md",
        "eslint.config.mjs",
      ]),
    ).toBe(true);
    expect(soloDocumenti(["docs/x.md", "src/app/page.tsx"])).toBe(false);
    expect(soloDocumenti(["src/eslint.config.mjs"])).toBe(false);
    expect(soloDocumenti(["tavola/src.html"])).toBe(false);
    expect(soloDocumenti(["public/officina-tavola/index.html"])).toBe(false);
    expect(soloDocumenti([])).toBe(false);
  });

  // Il segno dei soli documenti dice «fuori dal CSS»: vale finché sono gli stessi percorsi che Tailwind
  // salta. Un `@source not` aggiunto o tolto senza toccare `DOCUMENTI` (o il contrario) fa fallire qui.
  // Fuori dal CSS c'è anche del codice, la tavola dell'officina: per la firma non è documento e gira
  // l'e2e intero, quindi sta in un elenco suo e non in `DOCUMENTI`.
  const CODICE_FUORI_DAL_CSS = ["tavola", "public/officina-tavola"];

  it("sono esattamente i percorsi dei @source not di globals.css, più il codice fuori dal CSS", () => {
    const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const fuori = [...css.matchAll(/^@source not "\.\.\/\.\.\/([^"]+)";/gm)].map((m) => m[1]);
    expect(fuori.filter((f) => !CODICE_FUORI_DAL_CSS.includes(f))).toEqual([
      "docs",
      ".claude",
      "**/*.md",
      "eslint.config.mjs",
    ]);
    expect(fuori.filter((f) => CODICE_FUORI_DAL_CSS.includes(f))).toEqual(CODICE_FUORI_DAL_CSS);
  });
});

describe("il ramo deve contenere l'ultimo origin/main", () => {
  function remotoEClone() {
    const remoto = repo();
    remoto.commit("iniziale", "src/app.ts");
    const clone = repo(remoto.dir);
    clone.git("checkout", "-q", "-b", "ramo");
    clone.commit("feat", "src/uno.ts");
    return { remoto, clone };
  }

  it("sì se il ramo parte da origin/main, no dopo un merge nuovo su main", () => {
    const { remoto, clone } = remotoEClone();
    expect(contieneOriginMain(clone.dir)).toBe(true);
    remoto.commit("merge di un'altra PR", "src/due.ts");
    clone.git("fetch", "-q", "origin", "main");
    expect(contieneOriginMain(clone.dir)).toBe(false);
  });

  it("pnpm e2e:firma fa il fetch e si rifiuta, prima di lanciare qualunque prova", () => {
    const { remoto, clone } = remotoEClone();
    remoto.commit("merge di un'altra PR", "src/due.ts");
    const r = spawnSync("node", [SCRIPT], { cwd: clone.dir, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("fai il rebase su origin/main e rifirma");
  });

  // Il repository di prova non ha package.json: se la firma lanciasse un build o l'e2e, pnpm fallirebbe.
  // Solo su macOS, perché il segno porta la versione da `sw_vers`.
  it.runIf(process.platform === "darwin")(
    "un ramo di soli documenti si firma subito, senza build né e2e",
    () => {
      const remoto = repo();
      remoto.commit("iniziale", "src/app.ts");
      const clone = repo(remoto.dir);
      clone.git("checkout", "-q", "-b", "documenti");
      clone.commit("docs", "docs/history/x.md");
      const r = spawnSync("node", [SCRIPT], { cwd: clone.dir, encoding: "utf8" });
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("soli documenti · fuori dal CSS · macOS");
      const segni = path.join(clone.dir, ".git/e2e-firma");
      const [file] = readdirSync(segni);
      expect(file).toBe(`${clone.git("rev-parse", "HEAD^{tree}")}.json`);
      expect(JSON.parse(readFileSync(path.join(segni, file), "utf8")).tipo).toBe("documenti");
    },
  );
});

describe("l'hook controlla", () => {
  it("blocca con exit 2 un push senza segno, lascia passare il resto", () => {
    const r = repo();
    r.commit("iniziale", "src/app.ts");
    const bloccato = hook("git push -u origin main", r.dir);
    expect(bloccato.status).toBe(2);
    expect(bloccato.stderr).toContain("Lancia pnpm e2e:firma");
    expect(hook("git status", r.dir).status).toBe(0);
  });

  it("con il segno dell'albero il push passa, anche dopo l'amend del solo messaggio", () => {
    const r = repo();
    r.commit("iniziale", "src/app.ts");
    const segni = path.join(r.dir, ".git/e2e-firma");
    mkdirSync(segni, { recursive: true });
    writeFileSync(path.join(segni, `${r.git("rev-parse", "HEAD^{tree}")}.json`), "{}");
    expect(hook("git push", r.dir).status).toBe(0);
    r.git("commit", "-q", "--amend", "-m", "iniziale, con il numero della PR");
    expect(hook("git push", r.dir).status).toBe(0);
  });

  it("un input illeggibile che può essere un push blocca, uno che non lo è passa", () => {
    expect(
      spawnSync("node", [SCRIPT, "controlla"], { input: "git push {", encoding: "utf8" }).status,
    ).toBe(2);
    expect(
      spawnSync("node", [SCRIPT, "controlla"], { input: "ls {", encoding: "utf8" }).status,
    ).toBe(0);
  });
});
