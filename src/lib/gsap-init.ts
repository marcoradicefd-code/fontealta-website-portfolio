"use client";

import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

let initialized = false;

/**
 * Idempotent GSAP setup. Safe to call from multiple components — registerPlugin
 * is a no-op after the first call, and CustomEase.create overwrites if re-run.
 *
 * Custom eases:
 *  - `fa-water`     fluid, recalls water flow (ARCHITECTURE.md §4.5)
 *  - `fa-emphasis`  used for hero micro-interactions (signature)
 *
 * NB: the boss's signature easing `--ease-out-expo` (0.16, 1, 0.3, 1) lives in
 * src/app/globals.css and remains untouched. GSAP scenes use the additive
 * `fa-water` / `fa-emphasis` curves on top.
 */
export function initGsap() {
  if (initialized) return;
  gsap.registerPlugin(ScrollTrigger, SplitText, Observer, DrawSVGPlugin, CustomEase);
  CustomEase.create("fa-water", "0.65, 0, 0.35, 1");
  CustomEase.create("fa-emphasis", "0.6, 0, 0.05, 1");
  initialized = true;
}

export { gsap, ScrollTrigger, SplitText, Observer, DrawSVGPlugin, CustomEase };
