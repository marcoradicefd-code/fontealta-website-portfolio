function assertValue<T>(v: T | undefined, errorMessage: string): T {
  if (v === undefined) {
    throw new Error(errorMessage);
  }
  return v;
}

export const projectId = assertValue(
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  "Missing env: NEXT_PUBLIC_SANITY_PROJECT_ID",
);

export const dataset = assertValue(
  process.env.NEXT_PUBLIC_SANITY_DATASET,
  "Missing env: NEXT_PUBLIC_SANITY_DATASET",
);

export const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";

export const studioUrl = "/studio";

export const SUPPORTED_LANGUAGES = [
  { id: "it", title: "Italiano" },
  { id: "en", title: "English" },
] as const;

export type SanityLocale = (typeof SUPPORTED_LANGUAGES)[number]["id"];
