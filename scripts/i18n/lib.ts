/**
 * La parte PURA degli strumenti di traduzione: estrazione dei campi
 * localizzati, controlli prima della scrittura, confronto dei dizionari.
 *
 * ⚠️ **Sta qui, separata dai tre comandi, perché è l'unica parte che può
 * sbagliare in silenzio.** Un export che fallisce lo si vede; un controllo che
 * NON si accorge di un blocco saltato lascia passare una traduzione monca, e la
 * si scopre leggendo il sito in una lingua che nessuno legge. I comandi sono
 * gusci di I/O attorno a queste funzioni, e i test stanno tutti qui.
 *
 * ⚠️ **Nessun import da `@sanity/client` in questo file**: così i test girano
 * senza rete, senza token e senza un dataset, e non possono scrivere niente
 * nemmeno per sbaglio.
 */

import { ALL_LOCALES, type Locale } from "../../src/i18n/routing";

/**
 * ⚠️ **Le lingue vengono da `ALL_LOCALES`, non da una copia.** Erano due elenchi
 * identici in due file, e due elenchi identici sono uno vecchio che aspetta.
 * L'import è relativo e non con l'alias `@`, perché questi script girano con
 * `tsx` e non passano dalla risoluzione di Next.
 */
export const LINGUE = ALL_LOCALES;
export type Lingua = Locale;

/**
 * Valida la lingua che arriva dalla riga di comando.
 *
 * ⚠️ **Un valore da `process.argv` non è una lingua finché non lo si è
 * verificato.** Qui diventa un percorso di cartella, e un percorso costruito su
 * un dato non controllato è la definizione del problema.
 */
export function validaLingua(x: string | undefined): Lingua {
  if (!x || !(ALL_LOCALES as readonly string[]).includes(x)) {
    throw new Error(`lingua non valida: ${JSON.stringify(x)} — attese ${ALL_LOCALES.join(", ")}`);
  }
  return x as Lingua;
}

/** Un valore localizzato: stringa (string/text) o array di blocchi (portable text). */
export type ValoreLocalizzato = string | unknown[];

export interface CampoEstratto {
  /** Il percorso dentro il documento, es. `name` o `seo.metaTitle`. */
  path: string;
  valori: Partial<Record<Lingua, ValoreLocalizzato>>;
}

/** Un oggetto è un campo localizzato se ha almeno una chiave di lingua e NESSUNA
 *  chiave che non sia una lingua o `_type`. La seconda metà conta: senza,
 *  `{ it: ..., altro: ... }` verrebbe scambiato per un campo localizzato. */
function eCampoLocalizzato(v: unknown): v is Record<string, ValoreLocalizzato> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const chiavi = Object.keys(v).filter((k) => k !== "_type");
  if (chiavi.length === 0) return false;
  return chiavi.every((k) => (LINGUE as readonly string[]).includes(k));
}

/**
 * Tutti i campi localizzati di un documento, in forma piatta.
 *
 * ⚠️ Scende anche negli **array**: `body` è portable text, ma un documento può
 * avere array di oggetti con dentro campi localizzati. Le voci escono come
 * `sezioni.0.titolo`.
 */
export function campiLocalizzati(doc: unknown, prefisso = ""): CampoEstratto[] {
  const fuori: CampoEstratto[] = [];
  if (!doc || typeof doc !== "object") return fuori;

  if (Array.isArray(doc)) {
    doc.forEach((v, i) => fuori.push(...campiLocalizzati(v, `${prefisso}.${i}`)));
    return fuori;
  }

  for (const [k, v] of Object.entries(doc as Record<string, unknown>)) {
    if (k.startsWith("_")) continue;
    const path = prefisso ? `${prefisso}.${k}` : k;
    if (eCampoLocalizzato(v)) {
      fuori.push({ path, valori: v as Partial<Record<Lingua, ValoreLocalizzato>> });
    } else {
      fuori.push(...campiLocalizzati(v, path));
    }
  }
  return fuori;
}

/**
 * I campi che vanno al traduttore: tutti tranne le FAQ.
 *
 * ⚠️ **Le FAQ non si traducono** (spec FAQ § 2.1, Marco 30/10, D2): ogni mercato ha le sue domande,
 * e quelle da tradurre le scrive Cowork nei file di `docs/content/faq/`, che `faq:carica` porta su
 * Sanity. Esportate qui, l'agente le tradurrebbe dall'italiano, cioè il contrario della regola.
 */
export function perIlTraduttore(campi: CampoEstratto[]): CampoEstratto[] {
  return campi.filter((c) => !/(^|\.)faq$/.test(c.path));
}

// ────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **Due livelli, e l'import scrive un documento solo se non ha nessun `blocking`.**
 * Un `warning` va nel rapporto con i suoi numeri e la decisione resta a chi rilegge.
 */
export type Severity = "blocking" | "warning";

export interface Problema {
  path: string;
  /** Il blocco, quando il problema è dentro un portable text. */
  blocco?: number;
  messaggio: string;
  severity: Severity;
}

/** I soli problemi che impediscono la scrittura. */
export function blocking(problemi: readonly Problema[]): Problema[] {
  return problemi.filter((p) => p.severity === "blocking");
}

/**
 * Le parole italiane che, comparse in un testo che dovrebbe essere tradotto,
 * dicono che un blocco è stato saltato.
 *
 * ⚠️ **Sono parole FUNZIONALI, non di contenuto**: «della», «perché», «anche»
 * non compaiono mai in inglese, tedesco, francese o spagnolo, mentre una parola
 * come «design» o «outdoor» compare in tutte. Una lista di sostantivi darebbe
 * falsi allarmi su ogni riga che cita un nome di prodotto.
 */
export const SPIE_ITALIANE = [
  "della",
  "dello",
  "degli",
  "delle",
  "perché",
  "perche",
  "anche",
  "quando",
  "questo",
  "questa",
  "sono",
  "viene",
  "nostro",
  "nostra",
  "dopo",
  "senza",
  "ogni",
];

/**
 * Le parole-spia che in una lingua di destinazione sono parole **vere** di quella lingua.
 *
 * ⚠️ **Misurato, non supposto** (14/09/2026, tutte le traduzioni T2 di messaggi, legali,
 * corpi e post): delle 17 spie, nei testi tedeschi e francesi non ne compare **nessuna**;
 * nei testi spagnoli compare solo **«viene»**, 2 volte, ed è il verbo *venir*. Bloccava
 * due post corretti. Un'esclusione si aggiunge qui con la sua misura, mai «per sicurezza».
 */
export const SPY_WORD_EXCLUSIONS: Partial<Record<Lingua, readonly string[]>> = {
  es: ["viene"],
};

/** Le parole-spia da cercare in un testo tradotto verso `lingua`. */
export function spyWordsFor(lingua?: Lingua): readonly string[] {
  const escluse = new Set(lingua ? (SPY_WORD_EXCLUSIONS[lingua] ?? []) : []);
  return SPIE_ITALIANE.filter((s) => !escluse.has(s));
}

/** Le parole di un testo, contate allo stesso modo in tutte le lingue. */
export function parole(t: string): number {
  return t.trim() === "" ? 0 : t.trim().split(/\s+/).length;
}

/**
 * Quando la lunghezza di una traduzione è accettabile.
 *
 * **Sotto le 20 parole: scarto entro ±3. Da 20 in su: rapporto 0,85-1,15.**
 *
 * ⚠️ **La banda da sola respinge le traduzioni GIUSTE, ed è per questo che c'è
 * una soglia.** Misurato: «Una doccia in acciaio inox» (5 parole) → «A stainless
 * steel shower» (4) dà **0,80**; «Resiste al mare» (3) → «It resists the sea»
 * (4) dà **1,33**; 13 parole che ne diventano 11 danno **0,846**, fuori per
 * cinque centesimi di parola. Su un blocco corto una parola vale una frazione
 * enorme e il rapporto diventa una lotteria.
 *
 * ⚠️ **Le 20 parole non sono un numero scelto a occhio: sono il punto in cui i
 * due criteri si incontrano.** ±3 parole e ±15% coincidono a `3 / 0,15 = 20`.
 * Sopra quella soglia ±3 è già dentro la banda, sotto la banda è più stretta di
 * ±3. Verificato per forza bruta su **90.601 coppie** fino a 300 parole: la
 * forma a soglia e la forma «±3 OPPURE banda» danno lo stesso verdetto **zero
 * volte diverso**, e c'è un test che lo ripete.
 */
export const SOGLIA_PAROLE = 20;
export const SCARTO_ASSOLUTO_AMMESSO = 3;
export const BANDA = { min: 0.85, max: 1.15 } as const;

export function rapportoAccettabile(originale: number, tradotto: number): boolean {
  if (originale === 0) return true;
  if (originale < SOGLIA_PAROLE) return Math.abs(tradotto - originale) <= SCARTO_ASSOLUTO_AMMESSO;
  const r = tradotto / originale;
  return r >= BANDA.min && r <= BANDA.max;
}

/**
 * Un testo è «non tradotto» se è IDENTICO all'originale.
 *
 * ⚠️ **È il rilevatore vero del blocco saltato, e le parole-spia da sole non
 * bastavano.** «Resiste al mare» non contiene nessuna parola funzionale
 * italiana, e un blocco lasciato in italiano ha rapporto parole **esattamente
 * 1,00**, cioè il valore che il controllo del rapporto approva. Un blocco
 * saltato passava entrambi i controlli.
 *
 * ⚠️ **Salvo quando non c'è niente da tradurre**: un codice prodotto, una sigla,
 * un nome proprio sono identici in ogni lingua. Il criterio è «non contiene
 * nessuna parola in minuscolo di almeno tre lettere»: «B40L», «AISI 316»,
 * «Fontealta · MX» restano, «Resiste al mare» no.
 */
export function sembraNonTradotto(originale: string, tradotto: string): boolean {
  if (originale.trim() !== tradotto.trim() || originale.trim() === "") return false;
  return /[a-zàèéìòù]{3,}/.test(originale.replace(/\b[A-Z][a-zàèéìòù]*\b/g, ""));
}

/** Il testo piatto di un blocco di portable text: i `text` degli span, in ordine. */
export function testoBlocco(blocco: unknown): string {
  const b = blocco as { children?: Array<{ text?: string }> } | null;
  return (b?.children ?? []).map((c) => c?.text ?? "").join("");
}

/** La firma STRUTTURALE di un blocco: tutto tranne il testo. Due blocchi con la
 *  stessa firma differiscono solo per le parole, che è quello che una traduzione
 *  deve fare. */
export function firmaBlocco(blocco: unknown): string {
  const b = blocco as Record<string, unknown>;
  const figli = (b?.children ?? []) as Array<Record<string, unknown>>;
  return JSON.stringify({
    _key: b?._key,
    _type: b?._type,
    style: b?.style,
    listItem: b?.listItem,
    level: b?.level,
    markDefs: b?.markDefs,
    children: figli.map((c) => ({ _key: c?._key, _type: c?._type, marks: c?.marks })),
  });
}

/**
 * Le lingue in cui la lunghezza di un blocco è un **avviso** e non un blocco.
 *
 * ⚠️ **La banda 0,85-1,15 è nata sull'inglese, e sulle altre lingue fa danni misurabili**
 * (14/09/2026). Sui messaggi tradotti, dove la regola non si applicava, le stringhe da 20
 * parole in su fuori banda erano **DE 9/67 (mediana 0,96) · FR 22/67 (mediana 1,11) · ES
 * 10/67 (mediana 1,09)**: il francese è naturalmente più lungo dell'italiano di un decimo.
 * Nei post, dove la banda bloccava l'import, l'agente francese ha **compresso il testo** per
 * rientrare (perso il «voi» al lettore, un gioco retorico, una frase isolata fusa) e il
 * tedesco ha perso tre corpi a incasso su diciassette per i composti («UP-Teil für 3-Loch
 * Waschtischbatterie», 8 parole → 4). Un controllo che spinge a tradurre peggio per passare
 * non è un controllo.
 *
 * Resta **bloccante** per l'inglese, dove è stata tarata e dove non ha dato questi segni.
 */
export const LENGTH_WARNING_LOCALES: readonly Lingua[] = ["de", "fr", "es"];

/**
 * Prestiti presenti nel testo italiano e corretti anche nelle lingue di destinazione:
 * non sono parole italiane rimaste.
 */
export const SHARED_LOANWORDS: ReadonlySet<string> = new Set([
  "freestanding",
  "outdoor",
  "indoor",
  "design",
  "hospitality",
  "resort",
  "premium",
  "brochure",
  "stand",
  "high-flow",
  "supermirror",
]);

/**
 * Le parole di almeno cinque lettere, minuscole, che compaiono IDENTICHE nel testo italiano
 * e nel tradotto, esclusi i prestiti comuni.
 *
 * ⚠️ **Nata da un buco misurato** (14/09/2026, lotto 3): «eau froide ou premiscelata» e
 * «mit 1 uscita» sono passati sia le parole-spia, che sono FUNZIONALI e non vedono un
 * aggettivo, sia l'import. È un **avviso**, non un blocco: fra lingue vicine le parole in
 * comune sono tante e giuste (spagnolo «superficie», «piscina»; francese «difficile»), e
 * solo chi legge sa distinguerle.
 */
export function wordsIdenticalToSource(originale: string, tradotto: string): string[] {
  const parole5 = (t: string) =>
    new Set(
      (t.match(/(?<![\p{L}])[a-zà-öø-ÿ][a-zà-öø-ÿ’'-]{4,}(?![\p{L}])/gu) ?? []).filter(
        (w) => !SHARED_LOANWORDS.has(w),
      ),
    );
  const nelTradotto = parole5(tradotto);
  // Le parole vengono dall'italiano, quindi si ordinano con le regole italiane: il `sort()`
  // di default confronta i codici UTF-16 e mette «città» dopo «cittadino».
  return [...parole5(originale)]
    .filter((w) => nelTradotto.has(w))
    .sort((a, b) => a.localeCompare(b, "it"));
}

/** I limiti dei campi SEO, gli stessi che Studio mostra in avviso. */
export const LIMITI_SEO: Record<string, number> = {
  "seo.metaTitle": 70,
  "seo.metaDescription": 170,
};

/**
 * Tutto ciò che impedisce di scrivere una traduzione su Sanity, più gli avvisi.
 *
 * Restituisce l'elenco dei problemi: nessun `blocking` vuol dire «si può scrivere». Non
 * lancia, perché il comando deve poter riportare TUTTI i problemi di un documento in un
 * colpo solo invece di fermarsi al primo.
 *
 * `lingua` è la lingua del tradotto. Decide due cose: se la lunghezza blocca o avvisa
 * (`LENGTH_WARNING_LOCALES`) e quali parole-spia cercare (`SPY_WORD_EXCLUSIONS`). Senza
 * `lingua` valgono le regole piene, quelle tarate sull'inglese.
 */
export function controlla(
  path: string,
  originale: ValoreLocalizzato | undefined,
  tradotto: ValoreLocalizzato | undefined,
  lingua?: Lingua,
): Problema[] {
  const p: Problema[] = [];
  const blocca = (x: Omit<Problema, "severity">) => p.push({ ...x, severity: "blocking" });
  const avvisa = (x: Omit<Problema, "severity">) => p.push({ ...x, severity: "warning" });
  const spie = spyWordsFor(lingua);
  const lunghezzaInAvviso = lingua !== undefined && LENGTH_WARNING_LOCALES.includes(lingua);

  if (originale === undefined || tradotto === undefined) {
    blocca({ path, messaggio: "manca l'originale o la traduzione" });
    return p;
  }

  if (typeof originale === "string" || typeof tradotto === "string") {
    if (typeof originale !== "string" || typeof tradotto !== "string") {
      blocca({ path, messaggio: "una delle due è stringa e l'altra no" });
      return p;
    }
    // ⚠️ **L'ORDINE dei filtri è quello dichiarato, e conta.** Un blocco saltato
    // fa scattare anche le parole-spia e magari la lunghezza: se il primo
    // messaggio fosse «parola italiana residua», chi legge il rapporto andrebbe
    // a cercare una parola invece di accorgersi che il blocco non è stato
    // toccato affatto. Prima la diagnosi, poi i sintomi.
    if (tradotto.trim() === "") blocca({ path, messaggio: "traduzione vuota" });
    // 1 · identica alla fonte
    const identica = sembraNonTradotto(originale, tradotto);
    if (identica) blocca({ path, messaggio: "identica all'originale: sembra non tradotta" });
    // 2 · lunghezza (qui il limite SEO, che sulle stringhe è il vincolo vero)
    const limite = LIMITI_SEO[path.split(".").slice(-2).join(".")];
    if (limite && tradotto.length > limite)
      blocca({ path, messaggio: `${tradotto.length} caratteri, il limite è ${limite}` });
    // 3 · parole-spia, per ultime: sono un indizio, non una diagnosi
    for (const spia of spie) {
      if (new RegExp(`\\b${spia}\\b`, "i").test(tradotto))
        blocca({ path, messaggio: `parola italiana residua: «${spia}»` });
    }
    // 4 · parole identiche all'italiano: avviso, da guardare
    if (!identica) {
      const comuni = wordsIdenticalToSource(originale, tradotto);
      if (comuni.length > 0)
        avvisa({ path, messaggio: `parole identiche all'italiano: ${comuni.join(", ")}` });
    }
    return p;
  }

  // ── portable text ────────────────────────────────────────────────────────
  if (originale.length !== tradotto.length) {
    blocca({
      path,
      messaggio: `blocchi: ${originale.length} nell'originale, ${tradotto.length} nella traduzione`,
    });
    return p;
  }

  const chiavi = tradotto.map((b) => (b as { _key?: string })?._key);
  const doppie = chiavi.filter((k, i) => k !== undefined && chiavi.indexOf(k) !== i);
  if (doppie.length > 0)
    blocca({ path, messaggio: `_key ripetute: ${[...new Set(doppie)].join(", ")}` });

  originale.forEach((bo, i) => {
    const bt = tradotto[i];
    if (firmaBlocco(bo) !== firmaBlocco(bt))
      blocca({ path, blocco: i, messaggio: "struttura diversa: _key, marks, markDefs o style" });

    const to = testoBlocco(bo);
    const tt = testoBlocco(bt);
    if (to.trim() !== "" && tt.trim() === "")
      blocca({ path, blocco: i, messaggio: "blocco vuoto nella traduzione" });
    // 1 · identico alla fonte: è la diagnosi, e va per prima
    const identico = sembraNonTradotto(to, tt);
    if (identico) blocca({ path, blocco: i, messaggio: "identico all'originale: blocco saltato" });

    // 2 · lunghezza: blocca per l'inglese, avvisa per DE/FR/ES (vedi LENGTH_WARNING_LOCALES)
    const po = parole(to);
    const pt = parole(tt);
    if (!rapportoAccettabile(po, pt)) {
      // Il messaggio porta i CONTEGGI e dice quale dei due criteri ha morso:
      // «0,85 fuori da 0,85-1,15» arrotonda a un valore che sembra dentro, e
      // fa sembrare rotto lo strumento invece della traduzione.
      const messaggio =
        po < SOGLIA_PAROLE
          ? `${po} parole diventano ${pt}: sotto le ${SOGLIA_PAROLE} parole lo scarto ammesso è ${SCARTO_ASSOLUTO_AMMESSO}`
          : `${po} parole diventano ${pt}: rapporto ${(pt / po).toFixed(3)}, fuori dalla banda ${BANDA.min}-${BANDA.max}`;
      (lunghezzaInAvviso ? avvisa : blocca)({ path, blocco: i, messaggio });
    }

    // 3 · parole-spia, per ultime
    for (const spia of spie) {
      if (new RegExp(`\\b${spia}\\b`, "i").test(tt))
        blocca({ path, blocco: i, messaggio: `parola italiana residua: «${spia}»` });
    }

    // 4 · parole identiche all'italiano: avviso, da guardare
    if (!identico) {
      const comuni = wordsIdenticalToSource(to, tt);
      if (comuni.length > 0)
        avvisa({
          path,
          blocco: i,
          messaggio: `parole identiche all'italiano: ${comuni.join(", ")}`,
        });
    }
  });

  return p;
}

// ────────────────────────────────────────────────────────────────────────────

/** Le chiavi foglia di un dizionario di messaggi, in forma piatta. Scende negli
 *  array: `privacy.sections` ne contiene decine di stringhe di copy legale. */
export function foglieMessaggi(valore: unknown, p = ""): Map<string, string> {
  const fuori = new Map<string, string>();
  if (typeof valore === "string") {
    if (p) fuori.set(p, valore);
    return fuori;
  }
  if (Array.isArray(valore)) {
    valore.forEach((v, i) => {
      for (const [k, vv] of foglieMessaggi(v, `${p}.${i}`)) fuori.set(k, vv);
    });
    return fuori;
  }
  if (valore && typeof valore === "object") {
    for (const [k, v] of Object.entries(valore)) {
      for (const [kk, vv] of foglieMessaggi(v, p ? `${p}.${k}` : k)) fuori.set(kk, vv);
    }
  }
  return fuori;
}

/** Le chiavi di un dizionario ancora identiche all'inglese, fuori dalle ammesse:
 *  cioè l'elenco di quello che resta da tradurre. */
export function daTradurre(
  inglese: unknown,
  altra: unknown,
  ammesse: ReadonlySet<string>,
): string[] {
  const en = foglieMessaggi(inglese);
  return [...foglieMessaggi(altra)]
    .filter(([k, v]) => en.get(k) === v && !ammesse.has(k))
    .map(([k]) => k);
}
