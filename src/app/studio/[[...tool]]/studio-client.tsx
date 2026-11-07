"use client";

import dynamic from "next/dynamic";
import config from "../../../../sanity.config";

const NextStudio = dynamic(() => import("next-sanity/studio").then((mod) => mod.NextStudio), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#666",
        fontSize: "14px",
      }}
    >
      Loading Sanity Studio…
    </div>
  ),
});

export default function StudioClient() {
  return <NextStudio config={config} />;
}
