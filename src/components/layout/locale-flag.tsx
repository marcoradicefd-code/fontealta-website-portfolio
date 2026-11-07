import type { SVGProps } from "react";

/**
 * Stylized brand flags for the locale switcher — custom SVG (NOT emoji, which
 * render inconsistently across OS and read casual). Refined palette + rounded
 * corners + a faint ring so they sit cleanly on the dark header. Inactive
 * desaturation is handled by the caller (grayscale/opacity utilities).
 *
 * 20×14 viewBox, `rx` rounded. Covers the 5 scaffolded locales; falls back to
 * a neutral plate for any unknown code.
 */

const GREEN = "#1f9d63";
const PAPER = "#f4f1ec";
const RED = "#cb3340";
const BLUE = "#27406e";
const GOLD = "#e6b450";
const INK = "#0e1512";

interface LocaleFlagProps extends Omit<SVGProps<SVGSVGElement>, "viewBox"> {
  code: string;
}

export function LocaleFlag({ code, ...props }: LocaleFlagProps) {
  const clip = `flag-clip-${code}`;
  const ring = (
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="13"
      rx="2.5"
      fill="none"
      stroke="rgba(255,255,255,0.18)"
    />
  );

  const body = (() => {
    switch (code) {
      case "it":
        return (
          <>
            <rect width="6.67" height="14" x="0" fill={GREEN} />
            <rect width="6.67" height="14" x="6.67" fill={PAPER} />
            <rect width="6.67" height="14" x="13.33" fill={RED} />
          </>
        );
      case "en":
        return (
          <>
            <rect width="20" height="14" fill={BLUE} />
            <path d="M0 0 L20 14 M20 0 L0 14" stroke={PAPER} strokeWidth="2.6" />
            <path d="M0 0 L20 14 M20 0 L0 14" stroke={RED} strokeWidth="1" />
            <rect x="8" width="4" height="14" fill={PAPER} />
            <rect y="5" width="20" height="4" fill={PAPER} />
            <rect x="8.8" width="2.4" height="14" fill={RED} />
            <rect y="5.8" width="20" height="2.4" fill={RED} />
          </>
        );
      case "de":
        return (
          <>
            <rect width="20" height="4.67" y="0" fill={INK} />
            <rect width="20" height="4.67" y="4.67" fill={RED} />
            <rect width="20" height="4.67" y="9.33" fill={GOLD} />
          </>
        );
      case "fr":
        return (
          <>
            <rect width="6.67" height="14" x="0" fill={BLUE} />
            <rect width="6.67" height="14" x="6.67" fill={PAPER} />
            <rect width="6.67" height="14" x="13.33" fill={RED} />
          </>
        );
      case "es":
        return (
          <>
            <rect width="20" height="14" fill={RED} />
            <rect width="20" height="7" y="3.5" fill={GOLD} />
          </>
        );
      default:
        return <rect width="20" height="14" fill="#3a3a38" />;
    }
  })();

  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden focusable="false" {...props}>
      <defs>
        <clipPath id={clip}>
          <rect width="20" height="14" rx="2.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>{body}</g>
      {ring}
    </svg>
  );
}
