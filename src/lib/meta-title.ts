/**
 * La composizione dei `title` di scheda modello e scheda collezione.
 *
 * Nasce da una decisione di Marco del 21/09/2026: il title deve portare **il
 * termine ufficiale del catalogo**, non il nome della collezione ripetuto. Per
 * il modello quel termine è già sul documento — la testa della sua description
 * **è** la voce dell'Excel dei contenuti, verificata lingua per lingua
 * (`Waschtischsäule mit Wasserhahn`, `Columna de lavabo con grifo`) — quindi
 * non serve un dizionario: serve saperla tagliare.
 *
 * ⚠️ **Il tetto della testa è ADATTIVO, e senza quello la regola non sta in
 * piedi.** Col tetto fisso a 38 caratteri il title sfora i 60 su gran parte del
 * catalogo: misurato su 595 modelli × 5 lingue, **329 su 595 in italiano, 344
 * in francese, 247 in tedesco**, col peggiore a 76 caratteri e 717 px. Il
 * budget vero è quello che avanza: 60 meno il suffisso del layout, meno il
 * separatore, meno il nome. Con questa regola il più lungo del catalogo
 * atterra esattamente a 60.
 *
 * ⚠️ **Sotto i 12 caratteri di budget il title resta il solo nome.** Una testa
 * di otto caratteri non è un'informazione, è un moncone: meglio un titolo
 * corto e pulito che «Accessories RE12.AST.FS · Rubine».
 */

import type { ActiveLocale, Locale } from "@/i18n/routing";

/** Il limite del progetto in CARATTERI, suffisso del layout compreso. */
export const MAX_TITLE = 60;

/**
 * Il budget in caratteri usato per TAGLIARE la testa, **per lingua**.
 *
 * ⚠️ Non è un secondo limite: il limite resta 60 caratteri e 580 px per tutti.
 * È che i 580 px si raggiungono a conteggi diversi, perché le lettere non sono
 * larghe uguali. Misurato in Arial 20 su tutti i 595 modelli, con il budget a
 * 60 caratteri: **zero title fuori dai 60 caratteri ma 61 fuori dai 580 px** —
 * 43 spagnoli, 8 tedeschi, 5 inglesi, 5 francesi, il peggiore a 612 px.
 *
 * Un tetto unico che li rientrasse tutti sarebbe 56, e accorcerebbe **1200
 * teste su 2975**. Per lingua ne accorcia **507**, cioè un terzo del danno per
 * lo stesso esito: zero fuori dai 580 px, massimo misurato 580 in tedesco.
 *
 * ⚠️ I numeri sono misurati, non stimati: si rimisurano quando cambia il
 * catalogo, con `tmp/title-template/sweep2.mjs`, e non si allentano a occhio.
 */
export const BUDGET_TITOLO: Record<ActiveLocale, number> = {
  it: 60,
  en: 58,
  de: 59,
  fr: 59,
  es: 56,
};
/** Quello che `title.template` del layout radice aggiunge a ogni pagina. */
export const LAYOUT_SUFFIX = " | Fontealta";
/** Il separatore fra nome e testa, interpunto come in tutto il progetto. */
export const SEPARATOR = " · ";
/** Il tetto voluto da Marco, quando il budget lo consente. */
export const HEAD_CAP = 38;
/** Sotto questo budget la testa non si scrive: non direbbe niente. */
export const MIN_BUDGET = 12;

/** La forma minima di un blocco di Portable Text, senza tirarsi dentro i tipi. */
type Block = { _type?: string; children?: { text?: string | null }[] | null } | null;

/**
 * Il testo del PRIMO blocco della description.
 *
 * ⚠️ Solo il primo: è quello che porta il termine di catalogo. Concatenare
 * tutti i blocchi darebbe un paragrafo, e la testa andrebbe cercata dentro un
 * testo lungo invece che letta.
 */
export function firstBlockText(blocks: Block[] | null | undefined): string {
  const first = blocks?.find((b) => b && (b._type === undefined || b._type === "block"));
  if (!first?.children) return "";
  return first.children
    .map((c) => c?.text ?? "")
    .join("")
    .trim();
}

/**
 * Le parole che REGGONO un complemento: dopo di loro la frase non è finita.
 *
 * ⚠️ Servono al taglio, non alla grammatica: sono l'elenco dei punti in cui una
 * testa si può interrompere lasciando dietro di sé un sintagma completo. Sono
 * per lingua perché lo sono, e una lingua senza la sua riga sarebbe un errore
 * di typecheck, non un ramo silenzioso.
 */
const PREPOSIZIONI: Record<Locale, readonly string[]> = {
  it: [
    "con",
    "per",
    "da",
    "di",
    "a",
    "ad",
    "in",
    "su",
    "e",
    "del",
    "della",
    "dei",
    "delle",
    "al",
    "alla",
  ],
  en: ["with", "for", "of", "and", "to", "in", "on"],
  de: ["mit", "für", "aus", "und", "ohne", "zu", "in", "an", "auf", "von"],
  fr: ["avec", "pour", "de", "du", "des", "à", "et", "en", "sur"],
  es: ["con", "para", "de", "del", "y", "a", "en", "sobre"],
};

/**
 * La testa: fino alla prima virgola, e se supera il budget si taglia **prima di
 * una preposizione**, mai a metà sintagma.
 *
 * ⚠️ **Il taglio alla parola intera non bastava**, ed è una decisione di Marco
 * del 21/09/2026 nata guardando il tedesco: «Selbstschließender Hahn mit
 * Druckknopf…» tagliato alla parola dava **«Selbstschließender»**, un aggettivo
 * senza il suo sostantivo — una parola intera che però non è una cosa. Ora i
 * punti di taglio ammessi sono quelli davanti a una preposizione o a una
 * congiunzione: lì quello che resta è un sintagma che sta in piedi da solo.
 *
 * ⚠️ **Se nessun taglio ammesso ci sta nel budget, la testa non si scrive.**
 * Meglio il solo nome che un moncone: su quel caso tedesco il primo taglio
 * possibile è «Selbstschließender Hahn», 23 caratteri contro 22 di budget, e il
 * title torna a essere «Accessories RE12.AST.FS».
 *
 * ⚠️ La testa che ci sta INTERA non si tocca: «Waschtischsäule mit Wasserhahn»
 * resta tutta, perché il budget la contiene. Il taglio è un rimedio, non una
 * regola di stile.
 */
export function descriptionHead(
  text: string | undefined | null,
  budget: number,
  locale: Locale,
): string {
  const whole = (text ?? "").split(",")[0].trim();
  if (!whole || budget <= 0) return "";
  if (whole.length <= budget) return whole;

  const parole = whole.split(/\s+/);
  const reggenti = new Set(PREPOSIZIONI[locale]);
  let migliore = "";
  for (let i = 1; i < parole.length; i++) {
    if (!reggenti.has(parole[i].toLowerCase())) continue;
    const candidato = parole.slice(0, i).join(" ");
    if (candidato.length <= budget && candidato.length > migliore.length) migliore = candidato;
  }
  return migliore;
}

/** Il budget che avanza alla testa, dato il nome e la lingua. */
export function headBudget(name: string, locale: ActiveLocale): number {
  const left = BUDGET_TITOLO[locale] - LAYOUT_SUFFIX.length - SEPARATOR.length - name.length;
  return Math.min(HEAD_CAP, left);
}

/**
 * La testa da mettere nel title di un modello, o stringa vuota quando non c'è o
 * non ci sta.
 *
 * ⚠️ Qui NON si compone il titolo: la forma «{nome} · {testa}» sta nei
 * messaggi, come già ci stava «{nome} · {collezione}». È la regola di casa —
 * l'ordine delle parole e la punteggiatura di una lingua non si scrivono dentro
 * un TSX — e vale anche quando oggi le cinque lingue userebbero la stessa
 * forma: il giorno che una vuole invertire, cambia il suo file di messaggi.
 */
export function modelHead(
  name: string,
  description: Block[] | null | undefined,
  locale: ActiveLocale,
): string {
  const budget = headBudget(name, locale);
  if (budget < MIN_BUDGET) return "";
  return descriptionHead(firstBlockText(description), budget, locale);
}

/**
 * Il title, suffisso del layout compreso, sta nel limite del progetto?
 *
 * Serve alla scheda collezione, che compone **prima il tipo, poi il nome** —
 * «Colonne doccia Boss», DE «Duschsäulen Boss» (decisione di Marco,
 * 21/09/2026) — e ricade sul solo titolo quando la composizione non ci sta.
 *
 * ⚠️ L'ordine invertito non è estetico: mette davanti la parola che si cerca, e
 * libera il budget. La forma di prima, «{Titolo} · {tipi} in acciaio AISI 316»,
 * sforava i 60 su **tutte e 22 le collezioni** — alla frase dei tipi restavano
 * fra 7 e 21 caratteri, e le frasi ne chiedevano 25-29. Senza il materiale e
 * con l'inversione, il più lungo del catalogo sta a 40.
 *
 * ⚠️ Niente tipo = solo il titolo. Sono due casi: la collezione che **è** il
 * suo tipo (i corpi a incasso, gli accessori: «Accessories Accessories» non
 * informa nessuno) e quella in cui la composizione non starebbe nel limite.
 */
export function fitsTitle(text: string): boolean {
  return text.length + LAYOUT_SUFFIX.length <= MAX_TITLE;
}

/**
 * La macro che guida la frase: quella con **più articoli** nella collezione.
 *
 * ⚠️ Non la prima di `MACRO_ORDER`, che darebbe «Rubinetteria Boss» per una
 * collezione che è fatta di colonne doccia: misurato, Boss ha 26 modelli doccia
 * contro 14 vasca e 12 lavabo. Col criterio del conteggio, 19 collezioni su 22
 * dicono `doccia`, Kitchen dice `cucina`, Spring `giardino`, e i corpi a
 * incasso nessuna — che è il caso «solo titolo».
 *
 * A parità di conteggio vince la prima incontrata, e l'ordine dei modelli nella
 * query è stabile: due collezioni non possono dare due risultati diversi allo
 * stesso dato.
 */
/**
 * Il PROFILO di una collezione: che cosa è, in una parola, per il title.
 *
 * ⚠️ Non basta la macro dominante, e la ragione è tedesca (decisione di Marco,
 * 21/09/2026): il mercato dice **«Duschsäulen und Standarmaturen»** quando una
 * collezione ha colonne doccia *e* rubinetteria da bagno, «Standarmaturen»
 * quando ha solo quella, «Duschsäulen» quando ha solo colonne. È una
 * distinzione che la sola dominante non sa fare, perché guarda una macro alla
 * volta.
 *
 * La regola vale per tutte le lingue — una regola sola, un dizionario per
 * lingua — e nelle altre quattro i due profili `doccia` e `docciaEBagno` oggi
 * dicono la stessa frase. Il giorno che una lingua vorrà distinguerli, ha già
 * la chiave dove scriverlo.
 *
 * ⚠️ `bagno` e `bidet` sono **irraggiungibili con i dati di oggi**: su 22
 * collezioni la dominante è `doccia` 19 volte, `cucina` per Kitchen e
 * `giardino` per Spring. Non sono rami morti: diventano vivi il giorno che
 * nasce una collezione da bagno, ed è meglio che la frase esista prima.
 */
export function collectionProfile(models: { productMacro?: string | null }[]): string | undefined {
  const dominante = dominantMacro(models);
  if (!dominante) return undefined;
  const macros = new Set(models.map((m) => m.productMacro).filter(Boolean));
  const haBagno = macros.has("lavabo") || macros.has("vasca");
  if (dominante === "doccia") return haBagno ? "docciaEBagno" : "doccia";
  if (dominante === "lavabo" || dominante === "vasca") return "bagno";
  return dominante;
}

export function dominantMacro(models: { productMacro?: string | null }[]): string | undefined {
  const counts = new Map<string, number>();
  for (const m of models) {
    const macro = m.productMacro;
    if (!macro) continue;
    counts.set(macro, (counts.get(macro) ?? 0) + 1);
  }
  let winner: string | undefined;
  let best = 0;
  for (const [macro, n] of counts) {
    if (n > best) {
      best = n;
      winner = macro;
    }
  }
  return winner;
}
