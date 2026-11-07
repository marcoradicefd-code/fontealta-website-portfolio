import { type ButtonHTMLAttributes, type AnchorHTMLAttributes, type ComponentProps } from "react";

import { Link } from "@/i18n/navigation";

type BaseProps = {
  variant?: "primary" | "secondary";
  // FASE 2: 4 taglie per ruolo (token --btn-*). S=controlli, M=CTA secondarie+submit,
  // L=CTA primarie (hero), XL=CTA grandi (featured). Default = M.
  size?: "s" | "m" | "l" | "xl";
  /** Il bottone sta su un fondo scuro: sceglie il secondario chiaro su scuro e l'anello di focus bianco. */
  dark?: boolean;
};

// next-intl localized Link href: una pathname nota (string literal del map) o
// l'object-form `{ pathname, params }` per le route dinamiche. `(string & {})`
// allarga per accettare anche href esterni / fragment / asset (es. "#archivio",
// "/catalogo.pdf") fuori dal pathnames map, preservando l'autocomplete sui
// literal noti. M3: prima Button usava `next/link` raw → niente rewrite locale.
type LinkHref = ComponentProps<typeof Link>["href"];
type ButtonHref = LinkHref | (string & {});

type ButtonAsButton = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };

type ButtonAsLink = BaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: ButtonHref };

type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * href che NON sono route interne localizzabili → anchor raw (nessun rewrite
 * di locale): fragment same-page, URL assoluti, mailto/tel, e asset statici con
 * estensione (es. `/catalogo.pdf`). Gli slug interni non hanno punti → niente
 * falso match sulla regex estensione.
 */
const isRawHref = (href: string) =>
  /^(#|\?|https?:|mailto:|tel:)/.test(href) || /^\/[^?#]*\.[a-z0-9]+(?:[?#]|$)/i.test(href);

/**
 * Le classi del bottone, senza il bottone: per l'aspetto di un `Button` dentro un elemento
 * interattivo che c'è già (la facciata dell'officina su `/produzione`, dove il link è tutta
 * la figura e un link o un bottone annidato non è ammesso).
 */
export function buttonClasses({
  variant = "primary",
  size = "m",
  dark = false,
}: BaseProps = {}): string {
  const baseClasses =
    "inline-flex items-center justify-center font-medium uppercase leading-none transition-all duration-(--dur-control) rounded-pill";

  // Anello di focus secondo il FONDO, non secondo la variante (set 2026). Il ring
  // navy da 3 px misura 12,44:1 sul chiaro ma 1,38:1 sull'inchiostro, sotto il 3:1:
  // sulle sezioni scure l'anello è il bianco della traccia (`--fa-stroke-color`), 2 px
  // con 3 di distacco. Era oro fino al 20/10/2026: l'oro non fa parte del design
  // system (Marco, 19/10). `dark` dice che il bottone sta su un fondo scuro, e da
  // qui vale per il primario come per il secondario.
  const focusClasses = dark
    ? "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--fa-stroke-color)"
    : "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-fa-navy";

  // FASE 2: dimensioni dai token --btn-* (single source). Altezza fissa + padding
  // orizzontale + font-size dal token; centratura verticale via inline-flex del base.
  const sizeClasses = {
    s: "h-(--btn-height-s) px-(--btn-pad-s) text-(length:--btn-font-s) tracking-2",
    m: "h-(--btn-height-m) px-(--btn-pad-m) text-(length:--btn-font-m) tracking-2",
    l: "h-(--btn-height-l) px-(--btn-pad-l) text-(length:--btn-font-l) tracking-2",
    xl: "h-(--btn-height-xl) px-(--btn-pad-xl) text-(length:--btn-font-xl) tracking-2",
  }[size];

  // Il secondario è il CTA OUTLINE: traccia `--fa-stroke` (3 px, lo spessore delle card, e
  // solo dei CTA outline) col colore di ogni controllo a bordo, `--fa-stroke-color` su scuro
  // e `--fa-stroke-color-on-light` (navy) su chiaro (set 2026). Il primario resta senza bordo.
  // Su scuro il primario è INVERSO, chiaro pieno con testo navy (22/10/2026): il navy pieno
  // sull'inchiostro di un hero si stacca appena dal fondo.
  const variantClasses = {
    primary: dark
      ? "bg-fa-paper text-fa-navy hover:bg-fa-white active:scale-[0.97]"
      : "bg-fa-navy text-fa-text-on-dark hover:bg-fa-navy-light active:scale-[0.97]",
    secondary: dark
      ? "border-(length:--fa-stroke) border-(--fa-stroke-color) text-fa-text-on-dark bg-transparent hover:bg-white/10"
      : "border-(length:--fa-stroke) border-(--fa-stroke-color-on-light) text-fa-navy bg-transparent hover:bg-fa-navy/8",
  };

  // ⚠️ C'era una terza variante, `text`, tolta il 10/09/2026. Non era solo
  // inutilizzata (zero consumatori): era **rotta**. Portava `px-0`, ma le classi
  // si compongono `base + taglia + variante`, e nel foglio generato `.px-0` sta
  // PRIMA del padding della taglia M, quindi vinceva la taglia: un
  // `variant="text"` avrebbe avuto il padding del bottone, e la sua altezza.
  // Correggere l'ordine avrebbe prodotto un componente che nessuno ha mai
  // guardato a video. Il giorno che serve un link testuale si scrive allora.

  return `${baseClasses} ${focusClasses} ${sizeClasses} ${variantClasses[variant]}`;
}

export function Button({
  variant = "primary",
  size = "m",
  dark = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = `${buttonClasses({ variant, size, dark })} ${className}`.trim();

  if ("href" in props && props.href) {
    const { href, ...rest } = props as ButtonAsLink;
    if (typeof href === "string" && isRawHref(href)) {
      return (
        <a href={href} className={classes} {...rest}>
          {children}
        </a>
      );
    }
    return (
      // Route interna: il Link next-intl localizza per locale (es. /area-pro → /pro-area su EN).
      <Link href={href as LinkHref} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  // Default type="button" on the polymorphic <button> render: the HTML default is
  // "submit", which would submit a parent <form> unexpectedly. Callers that need
  // submit (contact-form, final-cta-form) pass type="submit" explicitly.
  const { type = "button", ...buttonProps } = props as ButtonAsButton;
  return (
    <button type={type} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
