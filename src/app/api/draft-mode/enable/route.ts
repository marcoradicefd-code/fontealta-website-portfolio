import { defineEnableDraftMode } from "next-sanity/draft-mode";

import { client } from "@/sanity/lib/client";

/**
 * Enable Sanity Draft Mode (preview unpublished content).
 *
 * Editors trigger this from Sanity Studio (Preview pane). The Studio sends a
 * signed URL with a token that next-sanity validates. Token must have the
 * "viewer + drafts" permission — generate it in sanity.io/manage.
 *
 * The client needs SANITY_API_READ_TOKEN: validatePreviewUrl reads the private
 * `sanity.previewUrlSecret` document — token-less it always answers 401 (M7).
 */
export const { GET } = defineEnableDraftMode({
  client: client.withConfig({ token: process.env.SANITY_API_READ_TOKEN }),
});
