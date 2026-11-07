/**
 * Il registro di quello che abbiamo scritto, e di quello che abbiamo trovato già lì.
 *
 * ⚠️ **Esiste per poter tornare indietro.** Senza, un `discard` dovrebbe indovinare
 * quali bozze erano nostre e quali di una persona, e nel dubbio o cancella il lavoro
 * di qualcun altro o non cancella niente. Il manifest toglie il dubbio: registra
 * **chi ha creato ogni bozza** e la revisione prima e dopo.
 *
 * ⚠️ **`nostra: false` è la riga più importante del file.** Una bozza che esisteva
 * già — l'orfana del 22 giugno, o il lavoro in corso di Andrea — si **salta e si
 * registra**: non si sovrascrive, e non la si cancella mai in un rollback.
 */

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export interface VoceManifest {
  id: string;
  tipo: string;
  /** `true` solo se la bozza NON esisteva e l'abbiamo creata noi. */
  nostra: boolean;
  /** `_rev` della bozza prima della nostra patch, se esisteva. */
  revPrima?: string;
  /**
   * `_rev` della bozza SUBITO DOPO la nostra scrittura, cioè il `transactionId`
   * del lotto che l'ha creata.
   *
   * ⚠️ **È la firma che rende sicuro il rollback.** Se al momento del `discard`
   * il `_rev` corrente è diverso da questo, qualcuno ha toccato la bozza dopo di
   * noi: cancellarla porterebbe via il suo lavoro. Il campo era dichiarato e mai
   * scritto, e quella era la guardia mancante, non un residuo da togliere.
   */
  revDopo?: string;
  campi: string[];
  /** Perché è stata saltata, quando lo è stata. */
  saltata?: string;
  /** Vera se al rollback la bozza risultava toccata da qualcun altro dopo di noi. */
  modificataDaAltri?: boolean;
  /**
   * La lingua del giro di cui questo giro ha trovato la firma sulla bozza, quando la bozza
   * NON l'ha creata questo giro: l'ha solo completata con i campi della sua lingua.
   *
   * ⚠️ **Una bozza condivisa non si cancella MAI da questo giro**, nemmeno intatta: dentro ci
   * sono i campi di un'altra lingua. Al rollback se ne tolgono solo i campi di questa.
   */
  sharedWith?: string;
  /**
   * Quando i campi di questa lingua sono arrivati sul pubblicato col publish per campi. ISO.
   *
   * ⚠️ Una voce pubblicata non è più una firma della bozza: se la bozza resta, la firma passa
   * alle lingue che restano, e il rollback non ha più niente da togliere per questa.
   */
  publishedAt?: string;
  /** Perché il publish ha saltato questo documento, l'ultima volta che l'ha incontrato. */
  publishSkipped?: string;
  /**
   * Quando la firma della bozza è passata a questa voce SENZA che questa lingua riscrivesse la bozza:
   * il publish per campi di un'altra lingua, o un `--aggiorna`. ISO.
   *
   * ⚠️ **Da quel momento `revDopo` non prova più che la bozza sia com'era alla nostra scrittura**:
   * dentro ci sono anche i campi di un'altra lingua, o un riallineamento al pubblicato. Una voce
   * rifirmata al rollback **non cancella mai**, toglie solo i campi suoi.
   */
  rifirmata?: string;
  /** Le correzioni fatte con `--aggiorna` sui campi di questa lingua, in ordine. */
  aggiornamenti?: Array<{ quando: string; campi: string[]; revPrima: string; revDopo: string }>;
}

export interface Manifest {
  lingua: string;
  iniziato: string;
  aggiornato: string;
  /** Quando il giro è stato chiuso (rollback fatto, o publish fatto). ISO. */
  chiuso?: string;
  voci: VoceManifest[];
}

/**
 * Il manifest è del **GIRO**, non del giorno.
 *
 * ⚠️ **Il percorso era datato — `manifest-AAAA-MM-GG` — e questo è un difetto, non
 * un dettaglio.** Un import che parte alle 23:50, muore, e riprende alle 00:10
 * scrive in un manifest **diverso**: le bozze del primo tronco risultano «di
 * qualcun altro», il `discard` non le tocca, e i numeri sembrano sani.
 * Simulato su 640 documenti: **350 bozze nostre orfane**, guardia verde, rollback
 * che dichiara di aver finito.
 *
 * ⚠️ **Il giro in corso si trova da un PUNTATORE, non dalla data di sistema.** È
 * la stessa ragione: la data è una cosa che cambia da sé, sotto i piedi di un
 * processo lungo. Il puntatore cambia solo quando lo cambiamo noi.
 *
 *     <base>/<lingua>/GIRO-CORRENTE            → "giro-20260911-174500-a3f2"
 *     <base>/<lingua>/giro-…/manifest.json
 *     <base>/<lingua>/giro-…/lotti/lotto-000.done
 */
export interface Giro {
  id: string;
  cartella: string;
  manifest: string;
  lotti: string;
}

const PUNTATORE = "GIRO-CORRENTE";

/**
 * La forma di un id di giro, e **non è una formalità**.
 *
 * ⚠️ `giroCorrente` legge il puntatore da un file e ne infila il contenuto dentro
 * un percorso: senza questo controllo, un puntatore che contenesse `../../..`
 * farebbe uscire lo strumento dalla sua cartella. È un buco che ho aperto io
 * introducendo il puntatore, e l'ha fatto vedere l'analisi di Sonar.
 */
const FORMA_ID_GIRO = /^giro-\d{8}-\d{6}-[0-9a-f]{4}$/;

/** La radice di tutto quello che questi strumenti leggono e scrivono. */
export const radiceTraduzioni = (): string => join(process.cwd(), "tmp", "traduzioni");

/**
 * Il percorso da mostrare a video: relativo alla cartella di lavoro.
 *
 * ⚠️ Nei messaggi non va l'assoluto. È più lungo, contiene il nome utente e il
 * percorso della macchina, e non aggiunge niente a chi legge: chi lancia lo
 * strumento sa già dov'è. Sonar segnalava proprio questi `console`.
 */
export const perIlLog = (perc: string): string => relative(process.cwd(), perc) || perc;

/** La radice dei manifest, sotto la cartella di lavoro. Un posto solo, per tutti. */
export const radiceManifest = (): string => join(radiceTraduzioni(), "manifest");

/**
 * Il percorso, risolto e **verificato dentro la radice**.
 *
 * ⚠️ **Un percorso che arriva da `--manifest=` è un dato della riga di comando**,
 * e da lì va a `readFileSync`. Non è una minaccia da rete — questi script li lancia
 * chi ha già il token di scrittura — ma è la stessa forma che Sonar segna come
 * vulnerabilità, ed è soprattutto un foot-gun vero: un rollback che legge un
 * manifest da un punto qualsiasi del disco cancella le bozze di un altro giro se
 * gli si passa il percorso sbagliato.
 *
 * ⚠️ Il confronto è su `resolve`, non sulla stringa: `tmp/traduzioni/../../etc`
 * comincia per «tmp/traduzioni» e non ci sta dentro. E il separatore in coda alla
 * radice serve, o `tmp/traduzioni-altro` passerebbe.
 */
export function percorsoSicuro(perc: string, radice: string = radiceTraduzioni()): string {
  const p = resolve(perc);
  const r = resolve(radice);
  if (p !== r && !p.startsWith(r + sep)) {
    throw new Error(`percorso fuori da ${r}: ${p}`);
  }
  return p;
}

const giroDa = (base: string, lingua: string, id: string): Giro => ({
  id,
  cartella: join(base, lingua, id),
  manifest: join(base, lingua, id, "manifest.json"),
  lotti: join(base, lingua, id, "lotti"),
});

/** Il giro indicato dal puntatore, se c'è ed è ancora aperto. */
export function giroCorrente(base: string, lingua: string): Giro | null {
  const punt = join(base, lingua, PUNTATORE);
  if (!existsSync(punt)) return null;
  const id = readFileSync(punt, "utf-8").trim();
  if (!id) return null;
  if (!FORMA_ID_GIRO.test(id)) {
    // Non si stampa il contenuto: un puntatore rotto è già una cosa strana, e
    // riversarlo sul terminale aggiunge un problema invece di toglierne uno.
    console.error(`✖ il puntatore ${PUNTATORE} di ${lingua} non ha la forma di un id di giro`);
    return null;
  }
  const giro = giroDa(base, lingua, id);
  if (!existsSync(giro.manifest)) return null;
  const m = JSON.parse(readFileSync(giro.manifest, "utf-8")) as Manifest;
  // Un giro chiuso non si riapre: dopo un rollback il lavoro successivo è un giro
  // nuovo, altrimenti il filtro di ripresa salterebbe documenti che non ci sono più.
  return m.chiuso ? null : giro;
}

/**
 * Il giro su cui scrivere: si **riprende** quello aperto, o se ne apre uno nuovo.
 *
 * ⚠️ La ripresa è il caso normale, non l'eccezione: è per questo che il puntatore
 * esiste. Un giro nuovo si apre solo quando non ce n'è uno aperto.
 */
export function giroPerScrivere(
  base: string,
  lingua: string,
  adesso: Date = new Date(),
): { giro: Giro; ripreso: boolean } {
  const aperto = giroCorrente(base, lingua);
  if (aperto) return { giro: aperto, ripreso: true };

  // ⚠️ La stampa si costruisce campo per campo, non tagliando un ISO: `slice(0, 15)`
  // su `2026-09-11T16:17:17.123Z` si porta dentro il punto dei millisecondi. L'ha
  // trovato il test sul formato, non una rilettura.
  const p2 = (n: number) => String(n).padStart(2, "0");
  const stampa =
    `${adesso.getUTCFullYear()}${p2(adesso.getUTCMonth() + 1)}${p2(adesso.getUTCDate())}` +
    `-${p2(adesso.getUTCHours())}${p2(adesso.getUTCMinutes())}${p2(adesso.getUTCSeconds())}`;
  // `randomBytes` e non `Math.random().toString(16)`: il secondo può dare meno di
  // quattro caratteri, e due giri aperti nello stesso secondo si sovrapporrebbero.
  const caso = randomBytes(2).toString("hex");
  const giro = giroDa(base, lingua, `giro-${stampa}-${caso}`);
  mkdirSync(giro.lotti, { recursive: true });
  mkdirSync(dirname(join(base, lingua, PUNTATORE)), { recursive: true });
  writeFileSync(join(base, lingua, PUNTATORE), giro.id, "utf-8");
  return { giro, ripreso: false };
}

/**
 * Chiude il giro: il manifest resta, ma non lo si riprende più.
 *
 * ⚠️ Si **marca**, non si cancella il puntatore: il volume di lavoro non sempre
 * consente cancellazioni, e un manifest chiuso è un verbale che vale la pena
 * tenere. `giroCorrente` guarda `chiuso` prima di restituirlo.
 */
export function chiudiGiro(percorsoManifest: string, m: Manifest): void {
  m.chiuso = new Date().toISOString();
  salvaManifest(percorsoManifest, m);
}

export function leggiManifest(percorso: string, lingua: string): Manifest {
  if (existsSync(percorso)) return JSON.parse(readFileSync(percorso, "utf-8")) as Manifest;
  const ora = new Date().toISOString();
  return { lingua, iniziato: ora, aggiornato: ora, voci: [] };
}

/**
 * Scrive il manifest **dopo ogni lotto**, non alla fine.
 *
 * ⚠️ Un manifest scritto solo alla fine è inutile proprio nel caso per cui esiste:
 * il processo che muore a metà. Scriverlo a ogni lotto costa una `writeFileSync` su
 * un file piccolo e rende ripartibile tutto il resto.
 */
export function salvaManifest(percorso: string, m: Manifest): void {
  m.aggiornato = new Date().toISOString();
  mkdirSync(dirname(percorso), { recursive: true });
  writeFileSync(percorso, JSON.stringify(m, null, 1), "utf-8");
}

/**
 * Le due forme dello stesso id, e le due funzioni che le convertono.
 *
 * ⚠️ **Un id vive in due forme e la confusione fra le due è invisibile.** Sanity
 * chiama `X` il documento pubblicato e `drafts.X` la sua bozza. Il manifest
 * registra la BOZZA, perché è quello che abbiamo creato noi; il filtro di ripresa
 * lavora sui PUBBLICATI, perché è quello che l'export consegna. Confrontare le due
 * liste senza normalizzare dà sempre insieme vuoto: nessun errore, nessun
 * messaggio, semplicemente un filtro che non filtra mai.
 *
 * Misurato l'11/09/2026: `giaFatti` restituiva `drafts.model-b40l` e il filtro
 * cercava `model-b40l`. La ripresa per manifest non ha mai funzionato, e reggeva
 * solo la query su Sanity.
 */
export const eBozza = (id: string): boolean => id.startsWith("drafts.");
export const idBozza = (id: string): string => (eBozza(id) ? id : `drafts.${id}`);
export const idPubblicato = (id: string): string => (eBozza(id) ? id.slice("drafts.".length) : id);

/**
 * Gli id già registrati, **nella forma del pubblicato**: un lotto ripreso non li
 * riscrive.
 *
 * ⚠️ La forma non è un dettaglio di stile: è la ragione per cui questo filtro
 * esisteva e non filtrava. Chi cambia questa riga cambi anche il confronto a valle.
 */
export const giaFatti = (m: Manifest): Set<string> =>
  new Set(m.voci.map((v) => idPubblicato(v.id)));

/**
 * Registra una voce, **senza accumulare e senza declassare**.
 *
 * Due difetti misurati l'11/09/2026, che sembrano indipendenti e non lo sono.
 *
 * ⚠️ **Il manifest accumulava.** `leggiManifest` rilegge il file e le voci si
 * aggiungevano in coda: dopo tre giri, **15 voci per 5 documenti**. La guardia
 * finale confrontava il NUMERO DI VOCI con il NUMERO DI DOCUMENTI DISTINTI
 * trovati da GROQ, e usciva rossa su giri che avevano fatto tutto giusto.
 *
 * ⚠️ **E declassava.** Un giro che ripassa su una bozza creata dal giro
 * precedente la trova già presente e la registrava `nostra: false`, con la
 * ragione «non si sovrascrive il lavoro di una persona». Quella persona siamo
 * noi, e `discard` cancella **solo** le `nostra: true`.
 *
 * ⛔ **La cura ovvia del primo rompe il secondo**: deduplicare tenendo
 * l'ULTIMA voce per id lascia, dopo una ripresa, `nostra: false` su ogni bozza
 * creata dal giro morto. Simulato su 640 documenti: **350 bozze nostre orfane
 * per lingua, 1050 su tre lingue, con la guardia verde e il discard che dichiara
 * di aver finito.** Per questo i due si curano insieme, e con questa regola:
 *
 * **`nostra` è appiccicoso e vince in tutti e due i versi**, perché è l'unica
 * affermazione che autorizza una cancellazione e si scrive **solo** quando una
 * `createIfNotExists` è stata davvero eseguita. Se l'abbiamo creata, è nostra,
 * qualunque cosa dica un giro successivo; se non l'abbiamo mai creata, non lo è.
 * È una raffinatura di «tieni la prima»: differisce solo nel caso `false → true`
 * (una bozza altrui cancellata da quella persona e poi creata da noi), dove
 * tenere la prima lascerebbe una bozza nostra che nessuno sa più togliere.
 */
export type EsitoRegistrazione = "aggiunta" | "doppione-evitato" | "declassamento-evitato";

export function registra(m: Manifest, voce: VoceManifest): EsitoRegistrazione {
  const id = idBozza(voce.id);
  const esistente = m.voci.find((v) => idBozza(v.id) === id);
  if (!esistente) {
    m.voci.push({ ...voce, id });
    return "aggiunta";
  }
  if (esistente.nostra && !voce.nostra) {
    // Non si declassa. E non si scrive nemmeno la ragione del salto: `discard`
    // guarda `nostra && !saltata`, quindi una ragione lasciata lì renderebbe il
    // rollback inerte per un'altra strada.
    return "declassamento-evitato";
  }
  if (!esistente.nostra && voce.nostra) {
    esistente.nostra = true;
    delete esistente.saltata;
  }
  // Il `revDopo` di un giro successivo è più fresco: se arriva, si tiene.
  if (voce.revDopo) esistente.revDopo = voce.revDopo;
  if (voce.campi.length > 0) esistente.campi = voce.campi;
  // Il declassamento è già uscito sopra: qui si arriva solo con una voce che non
  // toglie niente a quella registrata.
  return "doppione-evitato";
}

/**
 * Gli id delle bozze **che possiamo cancellare**, distinti.
 *
 * ⚠️ La parola che conta è **distinti**: è il confronto che la guardia finale
 * dell'import sbagliava, mettendo il numero di voci da una parte e il numero di
 * documenti dall'altra. Una funzione sola, usata dalla guardia e dal rollback,
 * toglie la possibilità che i due contino cose diverse.
 */
/**
 * Le bozze che i giri APERTI delle altre lingue hanno scritto e firmato: id della bozza →
 * `{ lingua, revDopo }`, una voce per giro.
 *
 * ⚠️ **Solo giri aperti, solo voci nostre, con `revDopo` e non pubblicate.** Un giro chiuso è
 * stato pubblicato o annullato; una voce senza firma non prova niente; una saltata non è mai
 * stata nostra; una pubblicata ha passato la firma alle lingue rimaste in bozza.
 * Chi chiama passa le ALTRE lingue: la propria si riconosce già dal suo manifest.
 */
export function draftsOwnedByOtherRuns(
  base: string,
  otherLanguages: readonly string[],
): Map<string, Array<{ lingua: string; revDopo: string }>> {
  const out = new Map<string, Array<{ lingua: string; revDopo: string }>>();
  for (const lingua of otherLanguages) {
    const giro = giroCorrente(base, lingua);
    if (!giro) continue;
    for (const v of leggiManifest(giro.manifest, lingua).voci) {
      if (!v.nostra || v.saltata || !v.revDopo || v.publishedAt) continue;
      const id = idBozza(v.id);
      out.set(id, [...(out.get(id) ?? []), { lingua, revDopo: v.revDopo }]);
    }
  }
  return out;
}

export const idNostriDistinti = (m: Manifest): string[] => [
  ...new Set(m.voci.filter((v) => v.nostra && !v.saltata).map((v) => idBozza(v.id))),
];

/**
 * La decisione su un singolo documento, **pura**: cosa farne e cosa scriverne.
 *
 * ⚠️ Sta qui e non dentro il ciclo dell'import per una ragione sola: così la
 * prova la esercita davvero. Una simulazione che ricopia la logica prova la
 * copia, non il codice.
 */
export function decidiDocumento(args: {
  id: string;
  tipo: string;
  campi: string[];
  bozzaEsiste: boolean;
  pubblicatoEsiste: boolean;
  /** La `_rev` attuale della bozza, quando esiste. */
  revBozza?: string;
  /** Le firme che i giri APERTI delle altre lingue hanno lasciato su questa bozza. */
  otherRuns?: ReadonlyArray<{ lingua: string; revDopo: string }>;
}): { azione: "crea" | "aggiungi" | "salta"; voce: VoceManifest } {
  const id = idBozza(args.id);
  // ⚠️ **Una bozza già presente si completa solo con una PROVA**: è nostra in un giro aperto
  // di un'altra lingua, e la sua `_rev` è ancora quella che quel giro ha scritto. Se una
  // persona l'ha aperta dopo, la `_rev` è cambiata e si torna alla regola di sempre.
  const firma =
    args.bozzaEsiste && args.revBozza !== undefined
      ? args.otherRuns?.find((g) => g.revDopo === args.revBozza)
      : undefined;
  if (firma) {
    return {
      azione: "aggiungi",
      voce: {
        id,
        tipo: args.tipo,
        nostra: true,
        campi: args.campi,
        revPrima: args.revBozza,
        sharedWith: firma.lingua,
      },
    };
  }
  if (args.bozzaEsiste) {
    return {
      azione: "salta",
      voce: {
        id,
        tipo: args.tipo,
        nostra: false,
        campi: args.campi,
        saltata: "bozza già presente: non si sovrascrive il lavoro di una persona",
      },
    };
  }
  if (!args.pubblicatoEsiste) {
    return {
      azione: "salta",
      voce: { id, tipo: args.tipo, nostra: false, campi: [], saltata: "pubblicato assente" },
    };
  }
  return {
    azione: "crea",
    voce: { id, tipo: args.tipo, nostra: true, campi: args.campi },
  };
}

/**
 * Che fare di una voce al rollback, **puro**.
 *
 * ⚠️ **Una bozza nostra può non essere più solo nostra.** Diventa condivisa nel
 * momento in cui una persona la apre e la modifica: `nostra: true` resta vero ma
 * non è più tutta la verità, e `tx.delete` porterebbe via anche il suo lavoro.
 * Il confronto fra il `_rev` corrente e `revDopo` è l'unico modo di distinguere
 * «nostra e intatta» da «nostra e poi toccata».
 *
 * ⚠️ **`revDopo` assente vuol dire NON cancellare.** È il caso di un manifest
 * scritto prima che questo campo esistesse: non possiamo provare che la bozza sia
 * ancora quella che abbiamo scritto, e su una cancellazione il dubbio decide
 * sempre per la prudenza. Si tolgono solo i campi della lingua.
 */
export type AzioneRollback = "cancella" | "togli-campi" | "niente";

export function decidiRollback(
  voce: VoceManifest,
  revAttuale: string | undefined,
): { azione: AzioneRollback; ragione: string } {
  if (!voce.nostra || voce.saltata) {
    return { azione: "niente", ragione: "non è nostra" };
  }
  if (voce.publishedAt) {
    // Il rollback toglie bozze, non tocca il pubblicato: una lingua già arrivata lì non si
    // annulla da qui, e dalla bozza riallineata non c'è niente di suo da togliere.
    return { azione: "niente", ragione: "già pubblicata: il rollback non tocca il pubblicato" };
  }
  if (revAttuale === undefined) {
    return { azione: "niente", ragione: "la bozza non c'è più" };
  }
  if (voce.sharedWith) {
    return {
      azione: "togli-campi",
      ragione: `bozza condivisa con ${voce.sharedWith}: si tolgono solo i campi di questa lingua`,
    };
  }
  if (voce.rifirmata) {
    return {
      azione: "togli-campi",
      ragione:
        "firma passata a questa voce dopo la scrittura: la bozza porta altro, non si cancella",
    };
  }
  if (!voce.revDopo) {
    return { azione: "togli-campi", ragione: "senza revDopo non si può provare che sia intatta" };
  }
  if (revAttuale !== voce.revDopo) {
    return { azione: "togli-campi", ragione: "modificata da altri dopo di noi" };
  }
  return { azione: "cancella", ragione: "nostra e intatta" };
}

/**
 * Il segnale che un lotto è finito, con i conteggi.
 *
 * ⚠️ Sta su disco e non in memoria perché il caso d'uso è **un subagent che muore a
 * metà**: al rilancio il lotto successivo si riconosce da qui, e non si ricomincia
 * da capo né si riscrive quello che c'è già.
 */
export function segnaLotto(cartella: string, indice: number, conteggi: Record<string, number>) {
  mkdirSync(cartella, { recursive: true });
  writeFileSync(
    join(cartella, `lotto-${String(indice).padStart(3, "0")}.done`),
    JSON.stringify({ indice, quando: new Date().toISOString(), ...conteggi }, null, 1),
    "utf-8",
  );
}

export function lottiFatti(cartella: string): Set<number> {
  if (!existsSync(cartella)) return new Set();
  return new Set(
    readdirSync(cartella)
      .filter((f) => /^lotto-\d+\.done$/.test(f))
      .map((f) => Number(f.slice(6, 9))),
  );
}
