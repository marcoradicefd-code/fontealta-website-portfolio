import type { Metadata } from "next";

/**
 * Independent root layout for the Sanity Studio segment.
 *
 * Studio has its own complete styling — DO NOT import globals.css here:
 * Tailwind tokens conflict with Studio's internal UI. The public site lives
 * under (site)/[locale]/ in a separate route group with its own root layout.
 */
export const metadata: Metadata = {
  title: "Sanity Studio | Fontealta",
  robots: { index: false, follow: false },
};

export { viewport } from "next-sanity/studio";

export default function StudioRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
