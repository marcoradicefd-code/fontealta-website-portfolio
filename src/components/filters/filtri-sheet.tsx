"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import {
  contaAttivi,
  ribalta,
  svuota,
  type GruppoFiltro,
  type StatoFiltri,
} from "@/lib/filtri-url";

/**
 * Bottom sheet dei filtri — sotto `lg`, dove le pill a tutta larghezza
 * occupavano 423px su 390, cioè metà schermo prima della prima card.
 *
 * `<dialog>` NATIVO con `showModal()`, e la scelta porta con sé gratis quattro
 * cose che a mano costano molto e si sbagliano facilmente: **fuoco intrappolato**,
 * **Esc che chiude**, **top layer** (niente guerre di `z-index` con la nav fissa)
 * e **`::backdrop`**. È il primo dialog vero del progetto — il menu mobile della
 * nav non lo è: non ha `role="dialog"`, non intrappola il fuoco e non risponde a
 * Esc. Zero dipendenze nuove.
 *
 * GENERICO PER COSTRUZIONE: riceve gruppi, stato e una funzione `conta`. La
 * SEMANTICA resta nella sezione che lo usa — le collezioni filtrano per macro
 * scalare, i corpi a incasso per appartenenza d'array (`servesMacros`), e sono
 * due predicati diversi che non devono finire qui dentro.
 *
 * LAVORA SU UNA BOZZA. Le modifiche restano locali finché non si preme «Mostra
 * N»; Esc, la × e il tocco sullo sfondo annullano. È il contratto normale di un
 * modale, ed è anche ciò che rende sensato il conteggio vivo nel piede: dice
 * cosa otterrai, non cosa hai già.
 */
export function FiltriSheet({
  onChiudi,
  gruppi,
  stato,
  onApplica,
  conta,
}: {
  onChiudi: () => void;
  gruppi: GruppoFiltro[];
  stato: StatoFiltri;
  onApplica: (prossimo: StatoFiltri) => void;
  /** Quanti elementi resterebbero con questo stato. La semantica è del chiamante. */
  conta: (stato: StatoFiltri) => number;
}) {
  const t = useTranslations("dettaglio");
  const ref = useRef<HTMLDialogElement>(null);
  const [bozza, setBozza] = useState<StatoFiltri>(stato);
  // Quale chip è stato acceso per ultimo. NON è stato di filtro — non va
  // nell'URL e non deve sopravvivere a un refresh: serve solo a indicare, a
  // zero risultati, quale togliere. Nessuna magia automatica: si evidenzia, non
  // si rimuove da sé.
  const [ultimoAcceso, setUltimoAcceso] = useState<string | null>(null);

  // ⚠️ IL COMPONENTE SI MONTA ALL'APERTURA, e la bozza nasce già seminata dallo
  // stato vero. La via ovvia — un effetto che fa `setBozza(stato)` quando
  // `aperto` diventa true — è VIETATA dal lint del progetto («Calling setState
  // synchronously within an effect can trigger cascading renders»), e la regola
  // ha ragione: montare è più semplice di sincronizzare, e un modale che
  // ricorda modifiche annullate è un modale che mente.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.showModal();
    // ⚠️ Il fuoco va sul DIALOG, non sul primo elemento focusabile.
    // `showModal()` di suo mette il fuoco sulla ×, che su touch fa comparire un
    // anello di fuoco su un bottone che nessuno ha toccato: sembra selezionato,
    // e la prima cosa che si vede aprendo i filtri è la chiusura evidenziata.
    // Col `tabIndex={-1}` il contenitore è focusabile da codice ma non da Tab,
    // quindi il primo Tab porta alla × e poi ai chip, nell'ordine del DOM.
    d.focus();
  }, []);

  // Scroll della pagina bloccato, con lo stesso metodo del menu mobile della nav.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const risultati = conta(bozza);
  const nessuno = risultati === 0;

  // Lo stato prossimo si calcola FUORI dall'updater e poi si scrivono i due
  // setter. Chiamare `setUltimoAcceso` dentro l'updater di `setBozza` lo
  // eseguirebbe in fase di render — e in StrictMode gli updater girano due
  // volte, quindi sarebbe un effetto collaterale dentro una funzione che deve
  // essere pura.
  const ribaltaBozza = useCallback(
    (chiave: string, valore: string) => {
      const prossimo = ribalta(bozza, chiave, valore);
      setBozza(prossimo);
      setUltimoAcceso(prossimo[chiave]?.has(valore) ? `${chiave}:${valore}` : null);
    },
    [bozza],
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby="fa-filtri-titolo"
      // `close` copre Esc e la chiusura programmata: senza, premendo Esc il
      // dialog si chiuderebbe da solo e lo stato del genitore resterebbe «aperto».
      onClose={onChiudi}
      onCancel={onChiudi}
      // Tocco sullo sfondo: il click sul `<dialog>` in top layer arriva
      // all'elemento stesso solo fuori dal contenuto.
      onClick={(e) => {
        if (e.target === ref.current) onChiudi();
      }}
      tabIndex={-1}
      // Lenis (`smoothWheel`) prende la rotella sulla finestra e muove la pagina da
      // script, anche col `body` bloccato qui sopra: il corpo del foglio non scorreva e la
      // pagina sotto sì (16/10/2026). `data-lenis-prevent` lo fa uscire prima del suo
      // `preventDefault` (`lenis.mjs:605-612`). Sta sul `<dialog>` e non sul corpo: la
      // rotella sullo sfondo arriva con il `<dialog>` come bersaglio, e con l'attributo sul
      // solo corpo la pagina scorreva ancora (900 → 1200, misurato).
      data-lenis-prevent
      className="fa-filtri-sheet"
    >
      <div className="flex max-h-[90vh] flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Niente barretta «handle» in cima: prometteva un trascinamento che non
            esiste. Un affordance che non fa quello che dice è peggio di nessuna
            affordance — chi la vede prova a trascinare, non succede niente, e da
            lì in poi non si fida più del pannello. Il titolo si riprende il
            padding superiore che la barretta gli toglieva. */}
        <div className="flex shrink-0 items-center justify-between border-b border-(--fa-border-medium) px-5 pt-5 pb-4">
          <h2 id="fa-filtri-titolo" className="text-sub-heading font-medium">
            {t("filtriTitolo")}
          </h2>
          <button
            type="button"
            onClick={onChiudi}
            aria-label={t("filtriChiudi")}
            className="flex size-11 items-center justify-center rounded-full text-fa-text-secondary"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {gruppi.map((g) => (
            <fieldset key={g.chiave} className="mb-7 border-0 p-0 last:mb-0">
              <legend className="fa-eyebrow mb-3 p-0">{g.etichetta}</legend>
              <div className="flex flex-wrap gap-2">
                {g.opzioni.map((o) => {
                  const scelta = bozza[g.chiave]?.has(o.valore) === true;
                  // Quanti resterebbero ribaltando QUESTA opzione: è il numero
                  // che serve a decidere, non quello dello stato corrente.
                  const n = conta(ribalta(bozza, g.chiave, o.valore));
                  const daTogliere = nessuno && ultimoAcceso === `${g.chiave}:${o.valore}`;
                  return (
                    <button
                      key={o.valore}
                      type="button"
                      aria-pressed={scelta}
                      onClick={() => ribaltaBozza(g.chiave, o.valore)}
                      className={`fa-filtri-chip ${scelta ? "scelta" : ""} ${daTogliere ? "da-togliere" : ""}`}
                    >
                      {o.swatch && (
                        <Image
                          src={o.swatch}
                          alt=""
                          width={18}
                          height={18}
                          aria-hidden
                          className="size-[18px] shrink-0 rounded-full object-cover"
                        />
                      )}
                      <span>{o.etichetta}</span>
                      <span aria-hidden className="opacity-(--fa-opacity-muted)">
                        {n}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="shrink-0 border-t border-(--fa-border-medium) px-5 pt-4 pb-5">
          {nessuno && (
            <p
              className="mb-3 text-center text-caption"
              style={{ color: "var(--fa-text-secondary)" }}
            >
              {t("filtriTogli")}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBozza(svuota(gruppi))}
              disabled={contaAttivi(bozza) === 0}
              className="fa-filtri-azzera"
            >
              {t("filtriAzzera")}
            </button>
            <button
              type="button"
              // `aria-disabled` e non `disabled`: un bottone spento sparisce dal
              // fuoco, e chi naviga da tastiera arriverebbe al piede senza
              // trovare nulla che spieghi perché non si può procedere.
              aria-disabled={nessuno}
              onClick={() => {
                if (nessuno) return;
                onApplica(bozza);
                onChiudi();
              }}
              className={`fa-filtri-mostra ${nessuno ? "spento" : ""}`}
            >
              {nessuno
                ? t("filtriNessuno")
                : risultati === 1
                  ? t("filtriMostraUno")
                  : t("filtriMostra", { n: risultati })}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
