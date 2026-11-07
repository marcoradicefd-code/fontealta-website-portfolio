import { defineCliConfig } from "sanity/cli";

import { dataset, projectId } from "./sanity/env";

/**
 * sanity.cli.ts is for the `sanity` CLI commands (schema extract, typegen,
 * deploy, etc.). The Studio runtime config lives in sanity.config.ts.
 */
export default defineCliConfig({
  api: { projectId, dataset },
});
