import Link from "next/link";

/**
 * Root not-found: rete di sicurezza per i path che non ricevono un locale (fuori dal
 * segmento `[locale]`). In pratica quasi irraggiungibile — il proxy assegna un locale
 * a ogni path utente e il catch-all `[locale]/[...rest]` funnella tutto nel 404
 * brandizzato localizzato. Niente root layout → autosufficiente (proprio `<html>/<body>`,
 * inline styles). Copy bilingue compatto, CTA = home.
 */
export default function RootNotFound() {
  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1215",
          color: "#f6f4f0",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 600, lineHeight: 1.25 }}>
            Qualcosa non ha funzionato / Something didn’t work
          </h1>
          <p style={{ marginTop: 16, lineHeight: 1.6, color: "rgba(246,244,240,0.82)" }}>
            Riprova tra un istante, oppure scrivici a{" "}
            <a href="mailto:info@fontealta.it" style={{ color: "#f6f4f0" }}>
              info@fontealta.it
            </a>
            .
          </p>
          <p style={{ marginTop: 8, lineHeight: 1.6, color: "rgba(246,244,240,0.82)" }}>
            Try again in a moment, or write to us at{" "}
            <a href="mailto:info@fontealta.it" style={{ color: "#f6f4f0" }}>
              info@fontealta.it
            </a>
            .
          </p>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 28,
              height: 48,
              padding: "0 32px",
              color: "#f6f4f0",
              // Il colore della traccia dei controlli a bordo (`--fa-stroke-color`), a
              // 1 px come prima, scritto in chiaro: questa pagina non carica globals.css e
              // i token non ci arrivano.
              border: "1px solid #ffffff",
              borderRadius: 100,
              fontSize: 16,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              textDecoration: "none",
            }}
          >
            Fontealta
          </Link>
        </div>
      </body>
    </html>
  );
}
