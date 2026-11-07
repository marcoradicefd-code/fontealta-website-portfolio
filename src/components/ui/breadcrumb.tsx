import { getPathname, Link } from "@/i18n/navigation";

import { CENTER_UNDERLINE } from "./center-underline";

/**
 * Il tipo si deriva da `getPathname`, NON dall'`href` di `Link`.
 *
 * È la stessa lezione che il vecchio `BackButton` aveva già scritto per
 * `router.push`: l'href di `Link` è PIÙ LARGO — accetta gli extra di `UrlObject`,
 * `query: null` compreso — e passarlo al secondo consumatore non compila. Qui i
 * consumatori sono due, il markup e il JSON-LD, e il tipo giusto è quello che li
 * soddisfa entrambi, cioè il più stretto.
 */
type LinkHref = Parameters<typeof getPathname>[0]["href"];

export interface BreadcrumbItem {
  /** Etichetta già localizzata: il componente non traduce, riceve. */
  label: string;
  /**
   * Href nella forma di next-intl (literal del pathnames map, oppure
   * `{ pathname, params }` per le dinamiche). **Assente = voce corrente**, che
   * per costruzione non è un link: è la pagina in cui ti trovi.
   */
  href?: LinkHref;
}

/**
 * Breadcrumb delle pagine di catalogo — collezione, scheda modello, indice e
 * scheda dei corpi a incasso.
 *
 * FORMA: è la PILL NAVY DEL TASTO «INDIETRO» CHE SI ALLUNGA. Non esisteva nessuna
 * altra superficie blu su queste pagine: le due sezioni che ospitavano il tasto
 * sono `fa-section light` (misurato `rgb(246,244,240)`), e il commento del vecchio
 * `BackButton` spiegava che stava lì proprio perché sull'hero scuro sarebbe stato
 * invisibile (navy su ink = 1,38:1). Quindi altezza 44 e raggio pieno come la pill,
 * `--fa-text-on-dark` su `--fa-navy` = **12,44:1**.
 *
 * PERCORSO DI TASSONOMIA, NON DI URL. `Home › Collezioni › Boss › B40L` descrive
 * l'appartenenza, non l'indirizzo: la scheda modello vive a `/modello/b40l`, non
 * sotto `/collezioni/boss`. Google accetta i breadcrumb logici, ma chi legge il
 * codice deve saperlo, perché è una discrepanza vera fra ciò che si vede e dove si
 * è. Per i 12 modelli multi-collezione la collezione è `collections[0]`, che è già
 * la regola che il sito usava per il fallback del tasto «Indietro»: nessuna
 * convenzione nuova.
 *
 * NON TRADUCE E NON DECIDE: riceve `items` già costruiti dalla pagina. È il motivo
 * per cui non ha hook e funziona sia dentro i due host client (`models-section`,
 * `bodies-section`) sia dentro i due server (`model-hero`, `body-hero`) senza
 * doppioni — e la stessa lista serve al JSON-LD, quindi le due rappresentazioni
 * non possono divergere.
 *
 * ⚠️ IL RAGGIO È `rounded-pill`, NON `rounded-full`. Il progetto ha due token che
 * si somigliano — `--radius-pill: 100px` e `--radius-full: 50%` — e `50%` è un
 * raggio PERCENTUALE su entrambi gli assi: su una scatola larga 313 e alta 44
 * disegna un'ELLISSE, non una pastiglia. Si vede nel provino, non nel computed
 * style, dove `50%` sembra un valore sensato. `Button` usa `rounded-pill` da
 * sempre: era già lì la risposta.
 *
 * UNA SOLA FORMA A TUTTI I BREAKPOINT: `rounded-pill` ovunque. La variante a 16
 * sotto `sm` è stata tolta — nasceva dal timore che a raggio pieno una pastiglia su
 * due righe si leggesse come un errore, e la misura dice il contrario.
 * `--radius-pill` vale 100px e il browser lo LIMITA a metà del lato corto: su due
 * righe (88px) i fianchi diventano due semicerchi da 44 e la forma è uno **stadio**.
 * L'ellisse la faceva `rounded-full` (`50%`, percentuale su ENTRAMBI gli assi), che
 * è un'altra cosa e resta bandita.
 *
 * ⚠️ IL PADDING È 28 SOTTO 384px E 20 SOPRA, e il breakpoint è MISURATO, non
 * scelto: con `px-5` la pill va a due righe **sotto 384**, e a due righe il fianco
 * è un semicerchio da 44 che alla quota della prima riga lascia solo **8,1px** fra
 * il bordo curvo e il glifo. Con `px-7` la distanza sale a **16,1**. Non si può
 * mettere 28 ovunque: a 390 farebbe andare a capo una riga che oggi sta intera
 * (misurato — con padding 28 il ritorno a una riga slitta da 384 a 400).
 *
 * ⚠️ È un breakpoint DIPENDENTE DAL CONTENUTO: 384 è dove va a capo il breadcrumb
 * più lungo del catalogo, `Home › Collections › Concealed bodies › CW.1`. Una voce
 * più lunga sposterebbe la soglia, e nella fascia 384-399 si tornerebbe a 8,1. La
 * regola vera sarebbe «se va a capo, serve 28», ma il CSS non sa dire se è andato
 * a capo: il breakpoint è la sua approssimazione. Le asserzioni misurano a 384 e
 * 399 apposta, così un contenuto più lungo fa rosso invece di passare zitto.
 *
 * MOBILE: le voci vanno a capo, e ogni `<li>` porta `min-h-11`, così la RIGA resta
 * alta 44 anche quando le righe sono tre. ⚠️ Il bersaglio tattile però è il LINK,
 * non il `<li>`: fino a settembre 2026 il link era 36×20 dentro una riga da 44, e
 * questa riga diceva il contrario. Ora lo allarga il `::before` del link. Nessun troncamento:
 * i nomi delle collezioni e i codici modello sono corti, e un `…` su un codice
 * prodotto nasconderebbe proprio la parte che identifica il pezzo.
 *
 * SOTTO `sm`, SULLE SCHEDE, SOLO GLI ANELLI INTERMEDI (Marco, 16/10/2026): con quattro voci o
 * più, cioè scheda modello e scheda corpo, `Collezioni › Boss` invece di
 * `Home › Collezioni › Boss › B40L`. Home e voce corrente si nascondono con classi CSS, quindi
 * il markup resta completo (e il JSON-LD, che nasce dalla stessa lista, non cambia); forma,
 * colori e padding della pill restano quelli di sopra. Il `›` del primo anello visibile si
 * nasconde con lui. Con tre voci (pagina di una collezione, indice dei corpi) il breadcrumb
 * resta intero: accorciato, sarebbe rimasto il solo «Collezioni».
 * ⚠️ Da allora la pill di quattro voci non compare più sotto 640, e il caso che ha misurato il
 * padding qui sopra (`Home › Collections › Concealed bodies › CW.1` su due righe sotto 384)
 * sotto `sm` non c'è più. Il 28 resta utile per una pill di tre voci:
 * `Home › Colecciones › Cuerpos empotrados` va su due righe sotto 384, accettato da Marco
 * (rule `catalogo`, con la fonte).
 */
export function Breadcrumb({
  items,
  ariaLabel,
  className = "",
}: {
  items: BreadcrumbItem[];
  /** `Percorso` in IT, `Breadcrumb` in EN — localizzato dalla pagina. */
  ariaLabel: string;
  className?: string;
}) {
  const intermedi = items.length > 3;
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="inline-flex min-h-11 flex-wrap items-center gap-x-2 rounded-pill bg-fa-navy px-7 text-caption text-fa-text-on-dark min-[384px]:px-5">
        {items.map((item, i) => {
          const corrente = i === items.length - 1;
          const soloDaSm = intermedi && (i === 0 || corrente);
          return (
            <li
              key={`${item.label}-${i}`}
              className={
                soloDaSm
                  ? "inline-flex min-h-11 items-center gap-x-2 max-sm:hidden"
                  : "inline-flex min-h-11 items-center gap-x-2"
              }
            >
              {i > 0 && (
                // Decorativo: il rapporto fra le voci lo comunica già `<ol>`, e un
                // lettore di schermo che annunciasse «maggiore» a ogni passo
                // aggiungerebbe rumore, non informazione. Resta `aria-hidden`.
                //
                // Opacità 85 e non 60: a 13px il chevron è un glifo sottile, e al
                // 60% il testo composito su navy sta a 5,49:1 — sopra AA ma sotto
                // il 7 che serve a farlo LEGGERE come segno invece che come
                // sporco. All'85% è 9,42:1, calcolato e poi misurato sui pixel.
                <span
                  aria-hidden
                  className={
                    intermedi && i === 1
                      ? "opacity-(--fa-opacity-subdued) max-sm:hidden"
                      : "opacity-(--fa-opacity-subdued)"
                  }
                >
                  ›
                </span>
              )}
              {corrente || !item.href ? (
                <span aria-current="page" className="font-medium">
                  {item.label}
                </span>
              ) : (
                // ⚠️ Il BERSAGLIO sta sul link, non sul `<li>` (set 2026). Il `<li>`
                // è alto 44, ma il link era 36×20 misurato con elementFromPoint:
                // toccare la pill sopra o sotto il testo non faceva niente. Il
                // `::before` allarga la superficie a 44 di altezza senza spostare
                // una riga; `::after` è già la sottolineatura, e non si tocca.
                // 5 px per lato non arrivano al vicino: fra due link ci sono 21 px.
                <Link
                  href={item.href}
                  className={`${CENTER_UNDERLINE} before:absolute before:-inset-x-[5px] before:-inset-y-[13px] before:content-['']`}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
