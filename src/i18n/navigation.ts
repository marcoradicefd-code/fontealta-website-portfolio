import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Replace standard next/link imports
 * with these in components that should respect the localized pathnames map.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
