import { test, expect } from "@playwright/test";

// Pin IT locale so unprefixed IT paths render IT (not the en-US browser default).
test.use({ locale: "it-IT" });

/**
 * Q2 a11y smoke — mobile nav menu open/close.
 *
 * Guards the shared Navigation, whose hamburger toggle got an explicit
 * type="button" in Q2, against a regression that breaks the overlay. Forces a
 * mobile viewport so it is meaningful on both projects (Chrome mobile emulation
 * + mobile-safari): the hamburger is lg:hidden, so on a desktop viewport it
 * wouldn't exist.
 */
test("mobile menu opens and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  // On mobile only the hamburger is visible in the header (the desktop language
  // control is hidden lg:flex but still in the DOM).
  const hamburger = page.locator("header button:visible");
  await expect(hamburger).toBeVisible();

  const firstItem = page.locator("[data-mobile-item]").first();
  await expect(firstItem).toBeHidden();

  await hamburger.click();
  await expect(firstItem).toBeVisible();

  await hamburger.click(); // same button, now the X
  await expect(firstItem).toBeHidden();
});
