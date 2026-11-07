"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";

import { contaAttivi, ribalta, type GruppoFiltro, type StatoFiltri } from "@/lib/filtri-url";

import { FiltriSheet } from "./filtri-sheet";

/**
 * Barra filtri compatta + bottom sheet, per sotto `lg`. Sostituisce la vista a
 * pill a tutta larghezza, che su 390 occupava **423px** — metà schermo prima
 * della prima card, contro i 203 di desktop.
 *
 * I CHIP APPLICATI SONO SEMPRE VISIBILI, senza aprire niente, e si tolgono uno
 * a uno. È la parte che vale di più: Baymard misura che mostrare i filtri
 * attivi è uno dei difetti più penalizzati quando manca, e un filtro
 * dimenticato dentro un pannello chiuso è un catalogo che sembra vuoto.
 *
 * Il confine è `lg`, lo stesso dell'hamburger: sotto comanda il dito, sopra il
 * puntatore. Sopra `lg` questo componente non rende nulla e lo sheet non si
 * monta mai — nessun JS di troppo su desktop.
 *
 * Non possiede stato di filtro: legge e scrive quello dell'URL, come la vista
 * desktop. L'unico stato locale è «lo sheet è aperto».
 */
export function FiltriMobile({
  gruppi,
  stato,
  onApplica,
  conta,
}: {
  gruppi: GruppoFiltro[];
  stato: StatoFiltri;
  onApplica: (prossimo: StatoFiltri) => void;
  conta: (stato: StatoFiltri) => number;
}) {
  const t = useTranslations("dettaglio");
  const [aperto, setAperto] = useState(false);
  const bottoneRef = useRef<HTMLButtonElement>(null);
  const sentinellaRef = useRef<HTMLDivElement>(null);
  const [grigliaIniziata, setGrigliaIniziata] = useState(false);
  const [grigliaFinita, setGrigliaFinita] = useState(false);

  // La pill flottante compare quando la griglia comincia e si spegne quando la
  // griglia FINISCE, cioè quando arriva quello che le sta sotto: le FAQ, o il
  // footer dove le FAQ non ci sono (Marco, 30/10/2026). Fino ad allora si spegneva
  // al footer, e con le FAQ in mezzo restava sopra le domande; il filtro serve alla
  // griglia e a nient'altro. Per la stessa ragione la condizione è «in vista
  // OPPURE già passato»: scorrendo oltre le FAQ, fin dentro il footer, le FAQ
  // escono di vista dall'alto.
  //
  // ⚠️ `isIntersecting` da solo non basta per la sentinella: è vero mentre la
  // sentinella è NEL viewport e torna falso appena la si supera scorrendo, cioè
  // proprio quando la griglia è tutta intorno. La condizione è «è in vista
  // OPPURE l'ho già passata», e il secondo pezzo si legge dal segno di
  // `boundingClientRect.top`.
  //
  // ⚠️ Gli effetti girano solo sotto `lg`: sopra, il componente non rende nulla
  // (`lg:hidden` è CSS, quindi i nodi ci sono comunque) e un osservatore acceso
  // sarebbe lavoro inutile su desktop. Si guarda `matchMedia`, non la larghezza
  // letta una volta, così il passaggio fra le due viste non lascia acceso niente.
  useEffect(() => {
    const soloSottoLg = window.matchMedia("(max-width: 1023.98px)");
    if (!soloSottoLg.matches) return;

    const osservatori: IntersectionObserver[] = [];

    const sentinella = sentinellaRef.current;
    if (sentinella) {
      const io = new IntersectionObserver(
        ([voce]) => setGrigliaIniziata(voce.isIntersecting || voce.boundingClientRect.top < 0),
        { threshold: 0 },
      );
      io.observe(sentinella);
      osservatori.push(io);
    }

    // Quello che viene dopo la sezione della griglia, saltando gli script (il
    // JSON-LD); se non c'è niente, il footer.
    let dopo = sentinella?.closest("section")?.nextElementSibling ?? null;
    while (dopo && ["SCRIPT", "STYLE", "TEMPLATE"].includes(dopo.tagName)) {
      dopo = dopo.nextElementSibling;
    }
    const fine = dopo ?? document.querySelector("footer");
    if (fine) {
      const io = new IntersectionObserver(
        ([voce]) => setGrigliaFinita(voce.isIntersecting || voce.boundingClientRect.top < 0),
        { threshold: 0 },
      );
      io.observe(fine);
      osservatori.push(io);
    }

    return () => osservatori.forEach((o) => o.disconnect());
  }, []);

  if (gruppi.length === 0) return null;

  const attivi = contaAttivi(stato);

  // Le voci applicate, nell'ordine dei gruppi e delle opzioni: lo stesso
  // dell'URL, così i chip e il link raccontano la stessa sequenza.
  const applicati = gruppi.flatMap((g) =>
    g.opzioni
      .filter((o) => stato[g.chiave]?.has(o.valore))
      .map((o) => ({ gruppo: g.chiave, ...o })),
  );

  const chiudi = () => {
    setAperto(false);
    // ⚠️ Il fuoco si rimette DOPO lo smontaggio, non nello stesso giro.
    // Misurato: chiamando `focus()` qui e basta, l'`activeElement` finiva sul
    // `body`. Il `<dialog>` è ancora nel top layer quando questo gestore parte,
    // e da dentro un modale il fuoco non può uscire: la chiamata viene
    // ignorata, poi React smonta e il fuoco cade. Un frame dopo il dialog non
    // c'è più e il `focus()` attecchisce.
    requestAnimationFrame(() => bottoneRef.current?.focus());
  };

  return (
    /* ⚠️ **Landmark come la vista desktop, e per la stessa ragione.** `aside`
       annidato dentro una `<section>` vale `generic` senza nome accessibile e
       `complementary` con: l'`aria-label` è la condizione, non un ornamento.
       Stessa chiave dell'altra vista — sono la stessa cosa a due larghezze, e
       solo una delle due è nell'albero di accessibilità per volta, perché
       l'altra è `display:none`. Il box non cambia: `aside` e `div` sono
       entrambi di livello blocco e le classi restano queste. Sotto `sm` la barra
       si centra come gli altri bottoni sotto testo a sinistra (set 2026). */
    <aside
      aria-label={t("filtriTitolo")}
      className={`flex items-center justify-center gap-3 sm:justify-start lg:hidden ${
        applicati.length > 0 ? "mb-8" : "mb-0"
      }`}
    >
      {/* La sentinella sta dove stava la barra, cioè in cima alla griglia: è lei
          a dire alla pill flottante che la griglia è cominciata.
          ⚠️ Resta NEL FLUSSO, 1px: da `absolute` si ancorerebbe al primo
          antenato posizionato, che qui non è la griglia, e direbbe «la griglia è
          cominciata» guardando un altro punto della pagina. */}
      <div ref={sentinellaRef} aria-hidden className="h-px w-px shrink-0" />

      {/* ⚠️ LA PILL È FISSA IN BASSO (21/09/2026, decisione di Marco). Stava qui
          in cima alla griglia e usciva di scena al primo scorrimento: misurato a
          390, dopo 1200px di scorrimento era a y=−395, cioè fuori dal viewport,
          e sul telefono era comunque lontana dal pollice. Ora resta a portata
          per tutta la griglia e si toglie da sola quando la griglia finisce.
          Resta dentro questo `aside` nel DOM — è la stessa regione, e il
          landmark non si sdoppia — ma `position: fixed` la stacca dal flusso,
          quindi il posto in cima si libera davvero e la griglia sale. */}
      <div
        className="fa-filtri-flottante"
        data-visibile={grigliaIniziata && !grigliaFinita && !aperto ? "true" : "false"}
      >
        <button
          ref={bottoneRef}
          type="button"
          onClick={() => setAperto(true)}
          aria-expanded={aperto}
          className="fa-filtri-apri shrink-0"
        >
          <SlidersHorizontal size={16} aria-hidden />
          {attivi > 0 ? t("filtriApriConta", { n: attivi }) : t("filtriApri")}
        </button>
      </div>

      {applicati.length > 0 && (
        <ul aria-label={t("filtriApplicati")} className="fa-filtri-applicati m-0 list-none p-0">
          {applicati.map((a) => (
            <li key={`${a.gruppo}:${a.valore}`}>
              <button
                type="button"
                onClick={() => onApplica(ribalta(stato, a.gruppo, a.valore))}
                aria-label={t("filtriRimuovi", { nome: a.etichetta })}
                className="fa-filtri-chip scelta"
              >
                {a.swatch && (
                  <Image
                    src={a.swatch}
                    alt=""
                    width={18}
                    height={18}
                    aria-hidden
                    className="size-[18px] shrink-0 rounded-full object-cover"
                  />
                )}
                <span>{a.etichetta}</span>
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Montato solo da aperto: la bozza nasce seminata, e da chiuso non c'è
          nessun dialog nel DOM. */}
      {aperto && (
        <FiltriSheet
          onChiudi={chiudi}
          gruppi={gruppi}
          stato={stato}
          onApplica={onApplica}
          conta={conta}
        />
      )}
    </aside>
  );
}
