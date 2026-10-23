// Saves a first-screen screenshot for every link that has no uploaded thumbnail,
// as thumbs/auto/<key>.jpg (the site looks there before falling back to mShots).
// Run by .github/workflows/thumbnails.yml. REFRESH=1 re-shoots existing ones too.
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

// Keep in sync with autoThumbKey in common.js.
const autoThumbKey = url => url.replace(/^https?:\/\//i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

const data = JSON.parse(readFileSync("links.json", "utf8"));
const apps = Array.isArray(data) ? data : data.apps || [];
const refresh = process.env.REFRESH === "1";
mkdirSync("thumbs/auto", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
let made = 0, failed = 0;
for (const app of apps) {
  if (app.thumb || !/^https?:\/\//.test(app.url || "")) continue;
  const file = `thumbs/auto/${autoThumbKey(app.url)}.jpg`;
  if (existsSync(file) && !refresh) continue;
  try {
    await page.goto(app.url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500); // let intro animations settle
    await page.screenshot({ path: file, type: "jpeg", quality: 80 });
    made++;
    console.log("saved", file);
  } catch (e) {
    failed++;
    console.log("skipped", app.url, "-", e.message.split("\n")[0]);
  }
}
await browser.close();
console.log(`done: ${made} saved, ${failed} skipped`);
