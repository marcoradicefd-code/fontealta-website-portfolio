#!/usr/bin/env bash
# Ignored Build Step di Vercel, chiamato da `vercel.json` (`ignoreCommand`).
#
# Convenzione di Vercel: exit 0 = il build SI SALTA, exit 1 = si costruisce.
# ⚠️ FALLISCE APERTO: una base che non si trova, un errore di git, un rideploy dello
# stesso commit portano tutti a COSTRUIRE. Saltare un build che serviva è peggio che
# costruirne uno inutile.
#
# Si salta quando:
#   - il ramo è di Dependabot (preview saltate; la produzione costruisce al merge, con
#     la CI verde: accettato da Marco il 17/09/2026);
#   - dall'ultimo deploy riuscito del ramo sono cambiati SOLO documenti: `docs/`, ogni
#     `*.md`, `.claude/`, `tmp/`; oppure il sorgente della tavola dell'officina, `tavola/`,
#     che il sito non serve e non costruisce (spec tavola-officina).
# ⚠️ NON sono documenti:
#   - `.github/`: un workflow cambiato deve costruire (decisione di Marco);
#   - `scripts/` e `tests/`: `tsconfig` include ogni `.ts`, e `next build` li controlla;
#   - `public/officina-tavola/`: è l'output della tavola che il sito serve.
#
# Base del confronto: `VERCEL_GIT_PREVIOUS_SHA`, che per Vercel è «lo SHA dell'ultimo
# deploy riuscito per progetto e ramo» ed esiste solo con un Ignored Build Step. Al
# primo deploy di un ramo manca, e la base è l'ultimo «Merge pull request» nella storia
# a primo genitore: su questo repo `main` avanza solo per merge di PR, quindi è il
# punto da cui il ramo è partito.
# ⚠️ Mai `git diff HEAD^ HEAD`, la ricetta della documentazione Vercel: guarda solo
# l'ULTIMO commit, e un push di un commit di codice seguito da uno di documenti
# salterebbe il build (misurato sul commit vero 20769b0).
# ⚠️ Il clone di Vercel è `--depth=10`: una base più vecchia non c'è, e si costruisce.
#
# `[[ ]]` è di bash: va bene perché `vercel.json` lo lancia con `bash` esplicito, e così il test.
set -u

ref="${VERCEL_GIT_COMMIT_REF:-}"
case "$ref" in
  dependabot/*)
    echo "ignora-build: SALTO, ramo Dependabot ($ref)"
    exit 0
    ;;
esac

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
origine="VERCEL_GIT_PREVIOUS_SHA"
if [[ -z "$base" ]]; then
  base=$(git log --first-parent --format='%H %s' HEAD^ 2>/dev/null | awk '/^[0-9a-f]+ Merge pull request #/ { print $1; exit }')
  origine="ultimo merge di PR"
fi
if [[ -z "$base" ]] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  echo "ignora-build: COSTRUISCO, base non trovata nel clone (${origine}: ${base:-vuota})"
  exit 1
fi

if ! cambiati=$(git diff --name-only "$base" HEAD 2>/dev/null); then
  echo "ignora-build: COSTRUISCO, git diff fallito su ${base}"
  exit 1
fi
if [[ -z "$cambiati" ]]; then
  echo "ignora-build: COSTRUISCO, nessuna differenza da ${base} (rideploy dello stesso commit)"
  exit 1
fi

codice=$(printf '%s\n' "$cambiati" | grep -Ev '^docs/|\.md$|^\.claude/|^tmp/|^tavola/' || true)
if [[ -z "$codice" ]]; then
  echo "ignora-build: SALTO, solo documenti o tavola da ${base} (${origine}): $(printf '%s\n' "$cambiati" | wc -l | tr -d ' ') file"
  exit 0
fi
echo "ignora-build: COSTRUISCO, file non documentali da ${base} (${origine}):"
printf '%s\n' "$codice" | head -10
exit 1
