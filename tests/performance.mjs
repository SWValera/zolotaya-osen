const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const results = [];
for (const width of [390, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const failures = [];
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("http://127.0.0.1:8080");
  await page.waitForLoadState("networkidle");
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    requests: performance.getEntriesByType("resource").length,
    resourceBytes: performance
      .getEntriesByType("resource")
      .reduce((n, r) => n + r.decodedBodySize, 0),
    domNodes: document.querySelectorAll("*").length,
    externalResources: performance
      .getEntriesByType("resource")
      .filter((r) => new URL(r.name).origin !== location.origin)
      .map((r) => r.name),
    galleryImages: document.querySelectorAll("#object-dialog img").length,
  }));
  assert.deepEqual(metrics.externalResources, []);
  assert.deepEqual(failures, []);
  assert.equal(metrics.galleryImages, 0);
  assert.ok(metrics.resourceBytes < 1100000);
  results.push(metrics);
  if (width === 1440) {
    for (const id of [
      "river-1",
      "river-2",
      "river-3",
      "river-4",
      "river-5",
      "river-6",
      "river-7",
      "upper-1",
      "upper-2",
      "a-frame",
      "bath-1",
      "bath-2",
      "gazebo-1",
      "gazebo-2",
      "gazebo-3",
    ]) {
      await page.locator("#map-shell").scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.locator(`#area-${id}`).click();
      assert.equal(
        await page.locator(".map-area.is-selected").getAttribute("data-object"),
        id,
      );
      await page.locator("#object-dialog .dialog-close").click();
      await page.waitForFunction(
        () => !document.querySelector("#object-dialog").open,
      );
    }
  }
  await page.close();
}
const nojs = await browser.newPage({ javaScriptEnabled: false });
await nojs.goto("http://127.0.0.1:8080");
assert.equal(await nojs.locator("h1").count(), 1);
assert.ok(
  (await nojs.locator("#stay").textContent()).includes("Домики у реки"),
);
await nojs.locator("noscript a").waitFor({ state: "visible" });
await writeFile(
  "docs/performance.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(
  "PASS: 15 rental SVG regions, no external requests, no missing assets, no initial gallery downloads, SEO content without JS.",
);
console.log(JSON.stringify(results));
await browser.close();
