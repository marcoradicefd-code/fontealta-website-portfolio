import { test, expect } from "@playwright/test";

// Pin IT locale: with the browser's default en-US, next-intl serves EN (model
// route /model/, nav /en/*) at these IT paths, so IT-path assertions would miss.
test.use({ locale: "it-IT" });

/**
 * Q2 a11y smoke — model + collection detail pages still render.
 *
 * Both routes render the shared Button and ModelCard that Q2 touched; this
 * guards against a render regression. Data comes from Sanity (read token in
 * .env.local), same as the running app.
 */
// Generous assertion timeout: on a cold dev server these routes fetch Sanity and
// (for the collection) render 52 cards, which can exceed the 5s default.
const RENDER_TIMEOUT = 20_000;

test("model detail page renders", async ({ page }) => {
  const res = await page.goto("/modello/f50");
  expect(res?.ok()).toBeTruthy(); // not a 404 / notFound
  await expect(page.getByText("F50", { exact: false }).first()).toBeVisible({
    timeout: RENDER_TIMEOUT,
  });
});

test("collection detail page renders its model grid", async ({ page }) => {
  const res = await page.goto("/collezioni/flamingo");
  expect(res?.ok()).toBeTruthy();
  // ModelCard wraps each card in a <Link href="/modello/[slug]">.
  await expect(page.locator('a[href*="/modello/"]').first()).toBeVisible({
    timeout: RENDER_TIMEOUT,
  });
});
