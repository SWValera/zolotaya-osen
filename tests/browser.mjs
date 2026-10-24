const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => errors.push(e.message));
const response = await page.goto("http://127.0.0.1:8080");
assert.equal(response.status(), 200);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(650);
await page.screenshot({ path: "docs/screenshots/desktop.png", fullPage: true });
assert.equal(await page.locator(".map-area").count(), 22);
await page.locator("#territory").scrollIntoViewIfNeeded();
await page.screenshot({ path: "docs/screenshots/map-desktop.png" });
for (const type of ["house", "bath", "gazebo", "place"]) {
  await page.locator(`[data-filter="${type}"]`).click();
  const ids = await page
    .locator(".object-row")
    .evaluateAll((es) => es.map((e) => e.dataset.object));
  for (const id of ids) {
    await page.locator(`.object-row[data-object="${id}"]`).click();
    assert.equal(
      await page.locator("#object-dialog").evaluate((d) => d.open),
      true,
      id,
    );
    assert.ok((await page.locator("#object-title").textContent()).length > 0);
    assert.equal(
      await page.locator(".status-badge").textContent(),
      "Готовность уточняется",
    );
    await page.locator("#object-dialog .dialog-close").click();
    await page.waitForFunction(
      () => document.querySelector("#zoom-level").textContent === "100%",
    );
  }
}
await page.locator('[data-filter="house"]').click();
await page.waitForTimeout(650);
await page.locator("#area-river-3").click();
assert.equal(
  await page.locator("#object-title").textContent(),
  "Домик у реки № 3",
);
await page.screenshot({ path: "docs/screenshots/object-desktop.png" });
await page.locator(".detail-contact").click();
assert.equal(await page.locator('a[href="tel:+77763055000"]').count(), 1);
await page.keyboard.press("Escape");
await page.waitForTimeout(80);
await page.keyboard.press("Escape");
await page.waitForTimeout(80);
await page.locator("#fullscreen").click();
assert.equal(
  await page.locator("#map-shell").getAttribute("aria-modal"),
  "true",
);
await page.locator("#zoom-in").click();
assert.equal(await page.locator("#zoom-level").textContent(), "135%");
await page.keyboard.press("Escape");
assert.equal(await page.locator(".is-fullscreen").count(), 0);
const widths = [320, 375, 390, 412, 768, 1024];
for (const width of widths) {
  await page.setViewportSize({ width, height: 850 });
  await page.waitForTimeout(80);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `overflow ${width}`,
  );
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:8080");
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(650);
await page.screenshot({ path: "docs/screenshots/mobile.png", fullPage: true });
await page.locator(".menu-toggle").click();
await page.locator('#mobile-nav a[href="#territory"]').click();
assert.equal(await page.locator("#mobile-nav").isVisible(), false);
await page.locator(".object-row").first().click();
await page.screenshot({ path: "docs/screenshots/object-mobile.png" });
assert.ok(
  await page
    .locator("#object-dialog")
    .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
);
await page.keyboard.press("Escape");
assert.deepEqual(errors, []);
console.log(
  "PASS: 22 cards; SVG selection; contact; escape; fullscreen; zoom; menu; 6 responsive widths; no JS errors.",
);
await browser.close();
