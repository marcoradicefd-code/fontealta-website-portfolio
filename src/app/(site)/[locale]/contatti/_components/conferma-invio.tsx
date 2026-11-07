"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useTranslations } from "next-intl";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { CATALOGO_URL } from "@/lib/catalogo";

import { animazioniPronte } from "./carica-animazioni";

gsap.registerPlugin(useGSAP);

/**
 * La riga di conferma sotto il bottone, e il link per mandare un'altra richiesta (14/10/2026).
 *
 * Resta un `<output>`: ha già `role="status"`, quindi i lettori di schermo la annunciano da soli
 * senza spostare il fuoco, che resta sul bottone. Il nome arriva dai valori del modulo e si mostra
 * solo qui: mai in un URL, mai in un log. L'email non compare (Marco, 14/10/2026), tranne nella
 * riga del catalogo, che dice a quale indirizzo è partito (eccezione di Marco, 19/10/2026).
 *
 * Entra a 300-600 ms dalla risposta (dissolvenza + 8 px), dopo il bottone; con il movimento ridotto
 * o senza plugin c'è e basta. «Invia un'altra richiesta» la dissolve in 200 ms (`--dur-micro`) e
 * poi svuota il modulo.
 */
interface Props {
  riga: string;
  nuovaRichiesta: string;
  /** Colori del fondo: la riga e il link riprendono quelli dell'informativa sopra. */
  coloreRiga: string;
  coloreLink: string;
  /** Senza, niente «Invia un’altra richiesta»: è il modulo del catalogo (Marco, 19/10/2026). */
  onNuova?: () => void;
  /** Col catalogo: il link diretto al PDF, sotto la riga. */
  link?: { href: string; testo: string };
  /** Con la casella della newsletter spuntata, la sua riga sotto quella della richiesta. */
  nota?: string;
  /** Classi intere di allineamento: centrata di base; il catalogo la allinea alla sua colonna. */
  allineamento?: string;
}

export function ConfermaInvio({
  riga,
  nuovaRichiesta,
  coloreRiga,
  coloreLink,
  onNuova,
  link,
  nota,
  allineamento = "items-center text-center",
}: Props) {
  const radice = useRef<HTMLDivElement>(null);
  const ridotto = usePrefersReducedMotion();
  const anima = !ridotto && animazioniPronte() !== null;

  useGSAP(
    () => {
      if (!anima) return;
      gsap.fromTo(
        radice.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, delay: 0.3, ease: "power2.out" },
      );
    },
    { scope: radice },
  );

  const nuova = () => {
    if (!onNuova) return;
    if (!anima || !radice.current) return onNuova();
    gsap.to(radice.current, { opacity: 0, duration: 0.2, ease: "power2.in", onComplete: onNuova });
  };

  return (
    <div ref={radice} className={`flex flex-col gap-1 ${allineamento}`}>
      <output className="fa-body-sm" style={{ color: coloreRiga }}>
        {riga}
        {nota ? <span className="mt-1 block">{nota}</span> : null}
      </output>
      {link ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener"
          className="fa-body-sm inline-flex min-h-(--btn-height-m) items-center font-medium underline underline-offset-2 hover:opacity-(--fa-opacity-hover)"
          style={{ color: coloreLink }}
        >
          {link.testo}
        </a>
      ) : null}
      {onNuova ? (
        <button
          type="button"
          onClick={nuova}
          className="fa-body-sm inline-flex min-h-(--btn-height-m) cursor-pointer items-center underline underline-offset-2 hover:opacity-(--fa-opacity-hover)"
          style={{ color: coloreLink }}
        >
          {nuovaRichiesta}
        </button>
      ) : null}
    </div>
  );
}

/**
 * La conferma di un invio riuscito, per i tre moduli generali e per quello del catalogo.
 *
 * Con la richiesta del catalogo (19/10/2026): «Ti abbiamo inviato il catalogo a {email}» SOLO se
 * Brevo ha risposto 2xx, altrimenti la riga del ripiego, mai «Ti abbiamo inviato» (Q7, Q23,
 * Q24); in tutti e due i casi il link «Scarica subito il PDF», perché il PDF è pubblico e chi
 * l'ha chiesto lo ha subito. Il modulo del catalogo non passa `onNuova`: dopo l'invio restano la
 * conferma e il link, senza «Invia un’altra richiesta» (Marco, 19/10/2026).
 */
export function ConfermaContatto({
  inviato,
  ...resto
}: Omit<Props, "riga" | "nuovaRichiesta" | "link" | "nota"> & {
  inviato: { nome: string; email: string; catalogo?: "inviato" | "ripiego"; newsletter: boolean };
}) {
  const t = useTranslations("contatti.form");
  const catalogo = inviato.catalogo;
  const riga = !catalogo
    ? t("confermaRiga", { nome: inviato.nome })
    : catalogo === "inviato"
      ? t("catalogoConferma", { email: inviato.email })
      : t("catalogoRipiego");
  return (
    <ConfermaInvio
      riga={riga}
      nuovaRichiesta={t("nuovaRichiesta")}
      // La riga della newsletter dipende SOLO dalla casella, mai da cosa risponde Brevo (OWASP).
      {...(inviato.newsletter ? { nota: t("newsletterConferma") } : {})}
      {...(catalogo ? { link: { href: CATALOGO_URL, testo: t("catalogoScarica") } } : {})}
      {...resto}
    />
  );
}
