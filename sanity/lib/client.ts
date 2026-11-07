import { createClient } from "next-sanity";

import { apiVersion, dataset, projectId } from "../env";

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  // useCdn=true is fine for ISR — webhook revalidate forces fresh data on publish.
  useCdn: process.env.NODE_ENV === "production",
  perspective: "published",
  stega: { studioUrl: "/studio" },
});
