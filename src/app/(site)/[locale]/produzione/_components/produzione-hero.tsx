import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { HeroFade } from "@/components/hero-fade";
import { HeroScrim } from "@/components/hero-scrim";
import type { ActiveLocale } from "@/i18n/routing";

import heroImg from "../../../../../../public/produzione/00-hero.webp";

interface ProduzioneHeroProps {
  locale: ActiveLocale;
}

/**
 * ProduzioneHero — hero full-bleed scuro con FOTO di sfondo (non video: la
 * pagina racconta lo stabilimento, la foto è la fonte fornita) + occhiello,
 * H1 e sottotitolo centrati. Stessa scala d'altezza LOCKED degli altri hero
 * full-bleed e stesso doppio scrim di ChiSiamoHero: radiale al centro per la
 * leggibilità del testo, verticale in basso per lo stacco sulla sezione fasi.
 */
export async function ProduzioneHero({ locale }: ProduzioneHeroProps) {
  const t = await getTranslations({ locale, namespace: "produzione" });

  return (
    <section
      className="relative flex min-h-[max(560px,75vh)] items-center justify-center overflow-hidden sm:min-h-[max(560px,80vh)] lg:min-h-screen"
      style={{ background: "var(--fa-ink)" }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={heroImg}
          alt={t("heroImageAlt")}
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          className="object-cover"
          style={{ objectPosition: "center 58%" }}
        />
        {/* Radiale sotto, verticale sopra: stesso ordine e stessi valori del
            prototipo. Il precedente era piu' chiaro al centro (radiale .74
            contro .80) e il verticale passava per `transparent`, lasciando la
            fascia mediana scoperta. Da ago 2026 i due strati vivono in
            `HeroScrim`, cosi' /collezioni li USA invece di copiarli.
            `passiMobile={1}`: col titolo hero passato a 96/48 px il blocco
            centrato si e' alzato e il sottotitolo e' sceso di 8 px su pixel piu'
            chiari, da 4,56 a 4,20. Un passo sul SOLO mobile lo riporta a 5,53 e
            lascia intatta a passo 0 la taratura di riferimento su desktop. */}
        <HeroScrim variante="centrato" passiMobile={1} />
        {/* La sfumatura di /finiture verso l'inchiostro della sezione dopo (set 2026). */}
        <HeroFade />
      </div>

      {/* ⛔ Qui c'era `textShadow: 0 1px 18px` (22/09/2026, PR B2). Stava sul
          CONTENITORE, e `text-shadow` eredita: arrivava identica a occhiello,
          titolo e paragrafo, che non è quello che si voleva.

          Su **Safari vero** quei 18 px di sfocatura non vengono applicati: il
          titolo esce con una copia scura delle lettere spostata in basso a
          destra e coi bordi netti, cioè un rilievo. Lo ha visto Marco a 1440 e
          la schermata è inequivocabile. ⚠️ Il banco non lo riproduce — su
          Chromium e sul WebKit di Playwright quell'ombra vale 0,03-0,14 livelli
          su 255 — ed è la stessa lezione del #215: su questo motore la pittura
          non fa fede, e il giudizio è dell'occhio su Safari.

          ⚠️ Verificato prima di curare, perché sarebbe stata la causa più
          probabile: né il titolo né alcun antenato fino a `<html>` porta
          `transform`, `will-change`, `filter`, `opacity < 1`, `isolation` o
          `mix-blend-mode` — quindi non c'è nessun livello composito da togliere
          (sonda provata contro sé stessa: iniettando un `will-change` passa da
          0 a 1, non è cieca).

          I 18 px erano comunque fuori banda: ogni altra ombra del progetto è
          `0 1px 2px` (la nav in `globals.css`, i paragrafi delle card in
          `fase-card.tsx`), e oltre quel raggio CLAUDE.md dice che «diventa
          alone». Ora la dichiarazione sta sul SOLO paragrafo, che ne ha
          bisogno per il fondo mosso, nella forma di casa. */}
      {/* `z-36`: il testo SOPRA lo scrim della barra (35, fisso, alto 320 px sotto `xl`) e
          sotto il pannello del menu (40). Stessa ragione di `home-hero.tsx` (22/10/2026). */}
      <div className="fa-container relative z-36 w-full px-6 pt-20 pb-12 text-center">
        {/* Eyebrow on-dark = bianco caldo (LOCK giu 2026). NON `.on-dark`, che
            è navy-bright: stesso override esplicito di not-found.tsx. */}
        <p className="fa-eyebrow" style={{ color: "var(--fa-text-on-dark)" }}>
          {t("heroEyebrow")}
        </p>
        <h1
          className="fa-hero-h1 mx-auto mt-eyebrow max-w-[15ch]"
          style={{ color: "var(--fa-text-on-dark)" }}
        >
          {t("heroH1")}
        </h1>
        <p
          className="fa-body-lg mx-auto mt-title-text"
          style={{
            color: "var(--fa-text-on-dark)",
            maxWidth: 600,
            textShadow: "var(--fa-text-shadow-photo)",
          }}
        >
          {t("heroSub")}
        </p>
      </div>
    </section>
  );
}
