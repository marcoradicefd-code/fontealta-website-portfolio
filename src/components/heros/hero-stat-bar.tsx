interface HeroStat {
  value: string;
  label: string;
}

/**
 * HeroStatBar — barra statistiche condivisa delle hero (home + collezioni).
 * Gruppo CENTRATO con divider verticali; label UPPERCASE sopra il valore.
 * Componente unico → le due hero restano identiche per costruzione (no drift).
 * Va renderizzata DENTRO la section hero (sibling del contenuto, in fondo).
 */
export function HeroStatBar({ stats }: { stats: HeroStat[] }) {
  return (
    <div className="relative px-6 pb-12">
      <div className="fa-container">
        {/* ⚠️ **Due per riga sotto 640, in TUTTE le lingue.** Su una riga sola le quattro
            voci sfondavano il viewport a 390 — misurato: 10 px per lato in italiano, 20 in
            tedesco — e «1999» e «Italy» finivano tagliati. Non è un difetto delle
            traduzioni: in italiano succedeva uguale.
            ⚠️ `divide-x` disegna il bordo a DESTRA di ogni figlio tranne l'ultimo: andando
            a capo, il secondo si ritrova un filo verticale appeso al bordo destro della
            prima riga. Per questo il secondo perde il bordo sotto 640, e lo riprende sopra.
            ⚠️ **I numeri di una stessa riga si allineano perché l'ETICHETTA cresce, non perché
            ha un'altezza minima.** A 390 «Oberflächen im Katalog», «Finitions au catalogue» e
            «Acabados en catálogo» stanno su due righe (33 px contro 17), e senza questo il numero
            sotto scendeva di 16: nella seconda riga il «7» non era più alla quota di «Italy».
            Un `min-height` di due righe avrebbe allineato tutto **spostando anche italiano e
            inglese**, che su una riga ci stanno: la cella è già `items-stretch`, quindi basta far
            crescere l'etichetta e il numero si appoggia in fondo. Dove le etichette sono tutte di
            una riga non cresce niente e la resa è identica al pixel. */}
        <div className="flex flex-wrap items-stretch justify-center gap-y-5 divide-x divide-(--fa-border-dark) sm:flex-nowrap sm:gap-y-0">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex basis-1/2 flex-col px-2 text-center sm:basis-auto sm:px-12 max-sm:[&:nth-child(2)]:border-e-0"
            >
              <div
                className="grow text-micro-2 font-medium tracking-5 uppercase"
                style={{ color: "rgba(246,244,240,0.6)" }}
              >
                {stat.label}
              </div>
              <div
                className="mt-3 leading-none"
                style={{
                  fontSize: "clamp(1.9rem, 3vw, 2.75rem)",
                  fontWeight: 600,
                  letterSpacing: "-0.4px",
                  color: "var(--fa-text-on-dark)",
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
