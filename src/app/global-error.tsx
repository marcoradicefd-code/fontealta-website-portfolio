"use client";

import { useEffect } from "react";

/**
 * global-error: cattura gli errori del ROOT layout stesso. Deve rendere il proprio
 * `<html>/<body>` (sostituisce il root layout) → autosufficiente, zero dipendenze da
 * i18n/layout. Copy bilingue compatto hardcoded. Inline styles: `globals.css` non è
 * garantito a questo livello.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 28,
              height: 48,
              padding: "0 32px",
              background: "transparent",
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
              cursor: "pointer",
            }}
          >
            Riprova / Try again
          </button>
        </div>
      </body>
    </html>
  );
}
