import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Il messaggio d'errore dei moduli (Marco, 28/10/2026): rosso del suo fondo, il peso dal ruolo
 * `--fa-error-font-weight` (700), e un'icona davanti,
 * così l'errore non si riconosce dal solo colore (WCAG 1.4.1); l'icona è nascosta ai lettori di schermo.
 * Su chiaro `--color-fa-error` (7,82:1 sul crema), su scuro `--color-fa-error-on-dark` (9,31:1
 * sull'inchiostro): prima un rosso solo, che sui fondi scuri valeva 2,51:1.
 *
 * `field` è il messaggio sotto il campo (13 px, `--text-caption`); `alert` è l'avviso del modulo, alla
 * taglia del paragrafo piccolo e con `role="alert"`.
 *
 * Le classi sono intere, una per caso: prettier riordina anche dentro le interpolazioni (rule design-system).
 */
const CLASSI = {
  field: {
    light: "mt-2 flex items-start gap-2 text-caption font-(--fa-error-font-weight) text-fa-error",
    dark: "mt-2 flex items-start gap-2 text-caption font-(--fa-error-font-weight) text-fa-error-on-dark",
  },
  alert: {
    light: "fa-body-sm flex items-start gap-2 font-(--fa-error-font-weight) text-fa-error",
    dark: "fa-body-sm flex items-start gap-2 font-(--fa-error-font-weight) text-fa-error-on-dark",
  },
} as const;

type FormErrorProps = {
  children: ReactNode;
  /** Il fondo su cui sta il messaggio. */
  tone: "light" | "dark";
  /** `field` sotto il campo, `alert` per l'avviso del modulo. */
  kind?: "field" | "alert";
  id?: string;
  /** Annuncia anche un messaggio sotto il campo (`role="alert"`): la casella della newsletter. */
  announce?: boolean;
};

export function FormError({
  children,
  tone,
  kind = "field",
  id,
  announce,
}: Readonly<FormErrorProps>) {
  return (
    <span
      id={id}
      role={kind === "alert" || announce ? "alert" : undefined}
      className={CLASSI[kind][tone]}
    >
      {/* centrata sulla prima riga: 2 px sotto a 13 px (interlinea 1,4), 4 px a 14 px (interlinea 1,5) */}
      <CircleAlert
        aria-hidden="true"
        focusable="false"
        size={14}
        strokeWidth={2.25}
        className={kind === "alert" ? "mt-1 shrink-0" : "mt-0.5 shrink-0"}
      />
      <span>{children}</span>
    </span>
  );
}
