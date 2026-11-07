import StudioClient from "./studio-client";

export const dynamic = "force-static";
export const revalidate = 0;

export const metadata = {
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  return <StudioClient />;
}
