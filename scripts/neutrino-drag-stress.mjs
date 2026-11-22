// Dev-only: drags the Neutrino mascot hundreds of times with wander on, sampling
// the dock every ~50ms during each hold, and reports any frame where it is
// off-screen, collapsed, or away from the pointer. Playwright is not a project
// dependency: run it ad hoc (`npx playwright install chromium` once).
//   node scripts/neutrino-drag-stress.mjs http://localhost:3000/en 300
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/en";
const runs = Number(process.argv[3] ?? 200);
const browser = await chromium.launch();
const failures = [];

for (const touch of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 }, hasTouch: touch });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("neutrino-prefs-v1", JSON.stringify({ ambientMotion: true })));
  await page.goto(url);
  const dock = page.locator(".neutrino-dock");
  await dock.waitFor();
  await page.waitForTimeout(3000); // let wander legs run
  for (let i = 0; i < runs; i += 1) {
    await page.waitForTimeout(Math.random() * 1500); // vary the grab time relative to a leg
    const box = await dock.boundingBox();
    if (!box) { failures.push({ i, touch, why: "no box before grab" }); continue; }
    const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    const ex = Math.random() * 1300 - 100, ey = Math.random() * 900 - 100; // may end outside the window
    for (let step = 1; step <= 8; step += 1) {
      await page.mouse.move(sx + ((ex - sx) * step) / 8, sy + ((ey - sy) * step) / 8);
      await page.waitForTimeout(50);
      const s = await dock.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { r: r.toJSON(), anims: el.getAnimations().length, transform: getComputedStyle(el).transform, vw: innerWidth, vh: innerHeight };
      });
      const bad = s.r.width === 0 || s.r.right <= 0 || s.r.bottom <= 0 || s.r.left >= s.vw || s.r.top >= s.vh || s.anims !== 0;
      if (bad) failures.push({ i, touch, step, ...s });
    }
    await page.mouse.up();
    const after = await dock.boundingBox();
    if (!after || after.width === 0) failures.push({ i, touch, why: "gone after release" });
  }
  await ctx.close();
}
await browser.close();
console.log(failures.length ? JSON.stringify(failures.slice(0, 10), null, 2) : "no invisible frames");
process.exit(failures.length ? 1 : 0);
