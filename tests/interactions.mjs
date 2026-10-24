const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:8080");
await page.locator("#map-shell").scrollIntoViewIfNeeded();
await page.waitForTimeout(650);
const client = await context.newCDPSession(page);
const touch = async (type, points) =>
  client.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map(([x, y, id]) => ({
      x,
      y,
      id,
      radiusX: 5,
      radiusY: 5,
    })),
  });
const mapRect = await page.locator("#map-viewport").boundingBox();
const startScroll = await page.evaluate(() => scrollY);
await touch("touchStart", [[180, mapRect.y + 320, 0]]);
for (let i = 1; i <= 8; i++) {
  await touch("touchMove", [[180, mapRect.y + 320 - i * 20, 0]]);
  await page.waitForTimeout(20);
}
await touch("touchEnd", []);
await page.waitForTimeout(300);
assert.ok(
  (await page.evaluate(() => scrollY)) > startScroll + 40,
  "inline swipe scrolls page",
);
await page.locator("#fullscreen").tap();
await page.waitForTimeout(650);
await touch("touchStart", [
  [145, 400, 0],
  [245, 400, 1],
]);
await touch("touchMove", [
  [95, 400, 0],
  [295, 400, 1],
]);
await touch("touchMove", [
  [65, 400, 0],
  [325, 400, 1],
]);
await touch("touchEnd", []);
await page.waitForTimeout(80);
assert.ok(
  parseInt(await page.locator("#zoom-level").textContent()) >= 250,
  "pinch zoom",
);
const before = await page.locator("#territory-map").getAttribute("style");
await touch("touchStart", [[190, 400, 0]]);
await touch("touchMove", [[240, 460, 0]]);
await touch("touchEnd", []);
assert.notEqual(
  await page.locator("#territory-map").getAttribute("style"),
  before,
  "pan",
);
assert.equal(
  await page.locator("#object-dialog").evaluate((d) => d.open),
  false,
  "drag does not open card",
);
await page.locator("#zoom-reset").tap();
await page.waitForTimeout(650);
await page.locator("#area-upper-1").tap();
assert.equal(
  await page.locator("#object-title").textContent(),
  "Верхний домик № 1",
  "tap after pointer capture",
);
await page.screenshot({ path: "docs/screenshots/fullscreen-mobile.png" });
await page.locator("#object-dialog .dialog-close").tap();
await page.waitForTimeout(80);
await page.locator("#fullscreen").tap();
assert.equal(await page.locator(".is-fullscreen").count(), 0);
console.log(
  "PASS: touch scroll, two-finger zoom, pan, tap selection, fullscreen exit.",
);
// Подмена данных только в браузере: исходный файл и реальные карточки не меняются.
const original = await readFile("public/assets/js/objects.js", "utf8");
await page.route("**/objects.js", (route) =>
  route.fulfill({
    contentType: "text/javascript",
    body:
      original +
      `\nobjects[0].price={amount:42500,currency:'KZT'};\nobjects[0].photos=[{src:'./assets/images/nature-demo-small.webp',alt:'Тест галереи 1'},{src:'./assets/images/masterplan.webp',alt:'Тест галереи 2'},{src:'./assets/images/missing-test.webp',alt:'Отсутствующее фото'}];\nobjects[1].status='building'; objects[1].opening='Тест срока открытия';\nobjects.push({...objects[0],id:'new-house-test',mapAreaId:'area-new-house-test',name:'Тест нового объекта',points:null});`,
  }),
);
await page.reload();
await page.locator(".object-row").first().tap();
assert.ok(
  (await page.locator(".price-block strong").textContent()).includes("42"),
);
assert.equal(
  await page.locator(".detail-visual img").getAttribute("alt"),
  "Тест галереи 1",
);
await page.waitForFunction(
  () => document.querySelector(".detail-visual img").naturalWidth > 0,
);
await page.getByRole("button", { name: "Следующее фото" }).tap();
await page.waitForFunction(
  () => document.querySelector(".detail-visual img").naturalWidth > 0,
);
assert.equal(
  await page.locator(".detail-visual img").getAttribute("alt"),
  "Тест галереи 2",
);
await page.getByRole("button", { name: "Следующее фото" }).tap();
await page.locator(".photo-error").waitFor();
assert.equal(
  await page.locator(".photo-error").textContent(),
  "Фотография пока недоступна",
);
await page.getByRole("button", { name: "Предыдущее фото" }).tap();
await page.waitForFunction(
  () => document.querySelector(".detail-visual img").naturalWidth > 0,
);
await page.locator("#object-dialog .dialog-close").tap();
await page.waitForTimeout(80);
await page.locator('[data-object="river-2"].object-row').tap();
assert.equal(await page.locator(".status-badge").textContent(), "Строится");
assert.ok(
  (await page.locator("#object-detail").textContent()).includes(
    "Тест срока открытия",
  ),
);
await page.locator("#object-dialog .dialog-close").tap();
await page.waitForTimeout(80);
await page.locator('[data-object="new-house-test"]').tap();
assert.equal(
  await page.locator("#object-title").textContent(),
  "Тест нового объекта",
);
assert.deepEqual(errors, []);
console.log(
  "PASS: data-only price update (KZT), lazy gallery, missing image fallback, building status/opening, new object without polygon.",
);
await browser.close();
