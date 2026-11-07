/**
 * Rigenera la tabella dell'indice in `docs/history.md` dai file di
 * `docs/history/`. Nasce da TRE conflitti sullo stesso punto del file fra il 31
 * agosto e il 1 settembre: due PR che aggiungono una riga in cima si scontrano
 * per costruzione. Ogni PR aggiunge ora solo il proprio file; l'indice lo
 * rigenera un `chore(docs)` a sé, dove un conflitto non può nascere.
 *
 * ⚠️ Una voce può NON avere una PR, e il generatore lo ammette dal 10/09/2026.
 * La prima è stata la Fase S: autori corretti ed eliminati su Sanity, cioè un
 * cambiamento del sito con un diff vuoto. Prima il generatore falliva («manca
 * il titolo o il "> data · PR #N"»), che è il modo in cui uno strumento dice
 * che una delle sue premesse non è più vera. Il titolo invece resta
 * obbligatorio: senza, la riga dell'indice non avrebbe testo.
 *
 * ⚠️ L'ancora è la riga di INTESTAZIONE, non il separatore `|---|---|---|`, che
 * nel file compare tre volte: agganciarsi a quello riscriverebbe una tabella a
 * caso più in basso. E si sostituisce solo il blocco di righe che segue, quindi
 * il preambolo, le voci precedenti al 31/08 nel corpo e tutto il resto del
 * documento restano dove sono.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "docs/history";
const INDICE = "docs/history.md";
const ANCORA = "| data | voce | PR |\n|---|---|---|\n";

const voci = readdirSync(DIR)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const righe = readFileSync(`${DIR}/${f}`, "utf8").split("\n");
    const titolo = righe[0].replace(/^#\s*/, "").trim();
    const pr = (righe.find((r) => r.startsWith(">")) ?? "").match(/#(\d+)/)?.[1] ?? "";
    if (!titolo) throw new Error(`${f}: manca il titolo (la prima riga deve essere «# …»)`);
    return {
      data: f.slice(0, 10),
      // Senza PR va in fondo fra le voci della stessa data: l'ordine dentro un
      // giorno è per numero di PR decrescente, e «nessuna» non è un numero.
      pr: pr ? Number(pr) : 0,
      riga: `| ${f.slice(0, 10)} | [${titolo}](${DIR.split("/")[1]}/${f}) | ${pr ? `#${pr}` : "—"} |`,
    };
  })
  .sort((a, b) => b.data.localeCompare(a.data) || b.pr - a.pr);

const testo = readFileSync(INDICE, "utf8");
if (!testo.includes(ANCORA))
  throw new Error("intestazione della tabella non trovata in docs/history.md");
const [prima, resto] = testo.split(ANCORA);
const dopo = resto.replace(/^(\|.*\n)+/, "");
writeFileSync(INDICE, prima + ANCORA + voci.map((v) => v.riga).join("\n") + "\n" + dopo);
console.log(`docs/history.md: ${voci.length} voci rigenerate da ${DIR}/`);
