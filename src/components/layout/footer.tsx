import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { IntentLink } from "@/components/ui/intent-link";
import type { ActiveLocale } from "@/i18n/routing";
import {
  AZIENDA_CAPITALE,
  AZIENDA_EMAIL,
  AZIENDA_INDIRIZZO,
  AZIENDA_PIVA,
  AZIENDA_RAGIONE_SOCIALE,
  AZIENDA_REA,
  AZIENDA_TELEFONO,
} from "@/lib/azienda";
import { getFooterCollections } from "@/lib/content";

import { NewsletterForm } from "./newsletter-form";

/** Lo spazio unificatore della riga legale. */
const NBSP = "\u00a0";

// Sede, email e telefono SOLO da `@/lib/azienda` (19/10/2026, PR del catalogo). Prima la
// catena era `siteSettings?.x ?? costante`, con i tre campi su Sanity vuoti: la costante
// era già il valore servito, e una seconda sorgente senza guardia è un'occasione per
// divergere dal JSON-LD e dalla pagina contatti, che leggono da lì.

const suDiNoiLinks = [
  { href: "/chi-siamo", labelKey: "chiSiamo" },
  { href: "/produzione", labelKey: "produzione" },
  { href: "/finiture", labelKey: "finiture" },
  { href: "/referenze", labelKey: "progetti" },
] as const;

/**
 * ⚠️ **Il contenitore dei corpi a incasso prende il nome dai MESSAGGI, non da Sanity.**
 * «Corpi a incasso» è il `title` del documento `collection`, ed è italiano: nel footer
 * compariva in italiano in ogni lingua, **inglese compreso**, cioè anche sul sito servito
 * oggi. Le altre voci sono nomi propri di collezione (Boss, Twiggy) e restano quelle che
 * sono. La chiave è la stessa che intitola la sezione dei corpi, così il footer e quella
 * pagina non possono divergere.
 */
const SLUG_CORPI = "corpi-a-incasso";

export async function Footer() {
  const locale = (await getLocale()) as ActiveLocale;
  const tFooter = await getTranslations("footer");
  const tBrand = await getTranslations("brand");
  const tLinks = await getTranslations("footer.links");
  const tCorpi = await getTranslations("corpiIncasso");
  const tNav = await getTranslations("nav");
  const collections = await getFooterCollections(locale);
  const year = new Date().getFullYear();

  const linkCls =
    "text-body-sm text-fa-text-on-dark transition-opacity duration-(--dur-micro) hover:opacity-(--fa-opacity-hover)";
  const headingCls = "text-fa-text-on-dark text-body-3 font-semibold tracking-2 uppercase";

  return (
    <footer className="bg-fa-ink">
      <div className="mx-auto max-w-site px-6 py-20">
        {/* La newsletter è la quinta colonna da `xl`, larga una volta e mezza le altre (D1 del provino
            del 20/10/2026, Marco); sotto `xl` una riga intera sotto le quattro, su mobile l'ultima voce.
            ⚠️ `xl` e non `lg`: fra 1024 e 1279 la colonna del marchio scendeva a 141 px, meno del
            lockup del logo, e il simbolo si schiacciava (misurato a 1024: 25,8 px su 28).
            ⚠️ 1,5 e non 2: con il lockup dell'header (176,6 px) la colonna del marchio a 1440 deve
            arrivare almeno lì; con 2 era 170,7, con 1,5 è 186,2. */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)]">
          {/* Brand + indirizzo */}
          <div className="col-span-2 md:col-span-1">
            {/* Lo stesso lockup dell'header (`navigation.tsx`): simbolo 36 px, 12 px prima della
                scritta, lettere spaziate 3 px (Marco, 20/10/2026). Fino ad allora qui era 28 · 10 ·
                2 px, e la scritta partiva 10 px più a sinistra che nella barra. Si cambiano insieme.
                Nei commenti niente nomi di classi: Tailwind li legge e ne genera la regola.
                Dal 27/10/2026 il simbolo è largo in proporzione al file, circa 33,2 px: era un
                quadrato e il disegno usciva stirato dell'8%. */}
            <div className="flex items-center gap-3">
              <Image
                src="/brand/fontealta-monogram-gray.png"
                alt=""
                width={33}
                height={36}
                aria-hidden
                className="aspect-[1146/1241] h-9 w-auto"
              />
              <span className="text-lg font-bold tracking-7 text-fa-text-on-dark">
                {tBrand("wordmark")}
              </span>
            </div>
            <address className="mt-5 space-y-1 text-body-sm text-fa-text-on-dark not-italic">
              {AZIENDA_INDIRIZZO.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </address>
          </div>

          {/* Collezioni — tutte da Sanity */}
          <div>
            <h3 className={headingCls}>{tFooter("columns.collezioni")}</h3>
            <ul className="mt-5 space-y-3">
              {collections.map((c) => (
                <li key={c._id}>
                  <IntentLink
                    href={{ pathname: "/collezioni/[slug]", params: { slug: c.slug ?? "" } }}
                    className={linkCls}
                  >
                    {c.slug === SLUG_CORPI ? tCorpi("eyebrow") : c.title}
                  </IntentLink>
                </li>
              ))}
              {/* Solo collezioni (Marco, 4/11/2026): la pagina d'uso «doccia da esterno», qui dal
                  4/11, è uscita dalla colonna; ci portano le FAQ delle collezioni e i post. */}
            </ul>
          </div>

          {/* Su di noi + Legal */}
          <div>
            <h3 className={headingCls}>{tFooter("columns.suDiNoi")}</h3>
            <ul className="mt-5 space-y-3">
              {suDiNoiLinks.map((l) => (
                <li key={l.href}>
                  <IntentLink href={l.href} className={linkCls}>
                    {tLinks(l.labelKey)}
                  </IntentLink>
                </li>
              ))}
            </ul>
            <h3 className={`${headingCls} mt-10`}>{tFooter("columns.legal")}</h3>
            {/* Una pagina sola, tre porte: la pagina intera e le due sezioni che si
                cercano per nome. L'ancora apre la sezione (`LegalDetailsSync`). */}
            <ul className="mt-5 space-y-3">
              <li>
                <IntentLink href="/menzioni-legali" className={linkCls}>
                  {tNav("menzioniLegali")}
                </IntentLink>
              </li>
              <li>
                <IntentLink
                  href={{ pathname: "/menzioni-legali", hash: "privacy" }}
                  className={linkCls}
                >
                  {tFooter("privacyPolicy")}
                </IntentLink>
              </li>
              <li>
                <IntentLink
                  href={{ pathname: "/menzioni-legali", hash: "cookie" }}
                  className={linkCls}
                >
                  {tFooter("cookiePolicy")}
                </IntentLink>
              </li>
            </ul>
          </div>

          {/* Contatti + Area riservata */}
          <div>
            <h3 className={headingCls}>{tFooter("columns.contatti")}</h3>
            <ul className="mt-5 space-y-3">
              <li>
                <a href={`mailto:${AZIENDA_EMAIL}`} className={linkCls}>
                  {AZIENDA_EMAIL}
                </a>
              </li>
              <li>
                <a href={`tel:${AZIENDA_TELEFONO.replaceAll(/\s+/g, "")}`} className={linkCls}>
                  {AZIENDA_TELEFONO}
                </a>
              </li>
            </ul>
            {/* E' l'INTESTAZIONE a essere il link, non una voce sotto di essa:
                la colonna ha una destinazione sola, e ripetere «Area riservata»
                come unico elemento di una lista sarebbe lo stesso testo due
                volte. Restava un `<h3>` inerte finche' `/area-pro` dava 404. */}
            <h3 className={`${headingCls} mt-10`}>
              <IntentLink
                href="/area-riservata"
                className="transition-opacity duration-(--dur-micro) hover:opacity-(--fa-opacity-hover)"
              >
                {tFooter("columns.areaRiservata")}
              </IntentLink>
            </h3>
          </div>

          {/* Newsletter: titolo e invito dal server, il modulo è client (`NewsletterForm`). */}
          <div className="col-span-2 md:col-span-4 xl:col-span-1">
            <h3 className={headingCls}>{tFooter("columns.newsletter")}</h3>
            <p className="mt-5 text-body-sm text-fa-text-on-dark">{tFooter("newsletterInvito")}</p>
            <NewsletterForm />
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-16 pt-8 text-center"
          style={{ borderTop: "var(--fa-stroke-hairline) solid var(--fa-border-dark)" }}
        >
          <p className="text-caption text-fa-text-on-dark">
            © {year} Fontealta. {tFooter("allRightsReserved")}
          </p>
          {/*
            ⚠️ **La riga legale sta SOTTO il copyright e non al suo posto.** Il
            nome visibile del sito è «Fontealta», che è il marchio; la ragione
            sociale è il soggetto giuridico, ed è un'informazione che va data
            senza sostituire l'altra. Sorgente unica `azienda.ts`, la stessa da
            cui leggono i testi legali e il dato strutturato: è ciò che rende
            confrontabile la guardia sul servito.

            Separatore interpunct e non em dash, come da regola tipografica. Dal
            26/10/2026 anche REA e capitale (art. 2250 c.c., testo approvato da
            Matteo), con le sigle italiane in tutte le lingue: sono gli estremi
            della società italiana, come la P.IVA. Fra etichetta e valore lo spazio
            unificatore: a 390 il numero non va a capo lontano dalla sua sigla.
          */}
          <p className="mt-2 text-caption text-fa-text-on-dark-secondary">
            {AZIENDA_RAGIONE_SOCIALE} · {`P.IVA e C.F.${NBSP}${AZIENDA_PIVA}`} ·{" "}
            {`REA${NBSP}${AZIENDA_REA}`} · {`Capitale sociale${NBSP}${AZIENDA_CAPITALE}${NBSP}i.v.`}
          </p>
        </div>
      </div>
    </footer>
  );
}
