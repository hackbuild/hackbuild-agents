// smoke-views: one headless smoke per @hackbuild/agents-views view, on the
// built example pages. Serves a built site directory, opens each view's page
// in headless system Chrome with a fresh profile (deleted after), and checks
// that the view draws and follows the scripted day:
//   drives-bars         utility and drive rows drawn, one current row, the drive bars move
//   associations-table  a row per cue with the attn column; reset learning keeps only the priors
//   eye-inset           marked data-ux="inset"; the canvas is not blank; the who switch changes the mode line
// Usage: node tools/smoke-views.mjs [--dir _site] [view...]
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import puppeteer from "puppeteer-core";

const argv = process.argv.slice(2);
const di = argv.indexOf("--dir");
const dir = resolve(di >= 0 ? argv[di + 1] : join(import.meta.dirname, "..", "_site"));
const only = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--dir");
if (!existsSync(join(dir, "drives-bars", "index.html"))) throw new Error(`smoke-views: no built pages in ${dir}; run node tools/build-pages.mjs first`);

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".wasm": "application/wasm" };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = join(dir, path);
  if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const profile = mkdtempSync(join(tmpdir(), "smoke-views-"));
const browser = await puppeteer.launch({
  executablePath: process.env.HB_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  userDataDir: profile,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  defaultViewport: { width: 1440, height: 900 },
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SMOKES = {
  async "drives-bars"(page) {
    const read = () => page.evaluate(() => [...document.querySelectorAll("#rack-brain .hb-gauges")[1].querySelectorAll(".hb-meter > i")].map((i) => i.style.width));
    const a = await read();
    await wait(3000);
    const b = await read();
    const rows = await page.evaluate(() => document.querySelectorAll("#rack-brain .hb-gauge").length);
    const cur = await page.evaluate(() => document.querySelectorAll("#rack-brain .hb-gauges")[0].querySelectorAll(".hb-gauge.is-cur").length);
    const name = await page.evaluate(() => document.querySelector("#rack-brain .hb-marker")?.textContent ?? "");
    return [
      [rows === 12, `${rows} rows, want 7 acts and 5 drives`],
      [cur === 1, `${cur} current utility rows, want 1`],
      [name.length > 0, `behavior "${name}"`],
      [a.join() !== b.join(), `drive bars ${a.join(" ")} then ${b.join(" ")}`],
    ];
  },
  async "associations-table"(page) {
    await page.waitForFunction(() => document.querySelectorAll("#rack-train tbody tr").length >= 3, { timeout: 10000 });
    const head = await page.evaluate(() => [...document.querySelectorAll("#rack-train thead th")].map((t) => t.textContent));
    await page.click("#rack-train .hb-btn");
    await wait(300);
    const after = await page.evaluate(() => [...document.querySelectorAll("#rack-train tbody th")].map((t) => t.textContent));
    return [
      [head.at(-1) === "attn", `head ${head.join(" ")}`],
      [after.join() === "sit,down,come", `after reset the cues are ${after.join(" ")}`],
    ];
  },
  async "eye-inset"(page) {
    const inset = await page.$('[data-ux="inset"]');
    await wait(1500);
    const spread = await page.evaluate(() => {
      const c = document.querySelector('[data-ux="inset"] canvas');
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let lo = 255;
      let hi = 0;
      for (let i = 0; i < d.length; i += 4) {
        const y = (d[i] + d[i + 1] + d[i + 2]) / 3;
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
      return hi - lo;
    });
    const before = await page.evaluate(() => document.querySelector('[data-ux="inset"] .hb-hd-aux').textContent);
    await page.click('[data-ux="inset"] .hb-inset-who > button:nth-child(2)');
    await wait(500);
    const after = await page.evaluate(() => document.querySelector('[data-ux="inset"] .hb-hd-aux').textContent);
    return [
      [!!inset, "an element marked data-ux inset"],
      [spread > 40, `eye canvas brightness spread ${spread.toFixed(0)} of 255 (measured)`],
      [before !== after && after === "human colour", `mode line "${before}" then "${after}"`],
    ];
  },
};

let failed = 0;
try {
  for (const [name, smoke] of Object.entries(SMOKES)) {
    if (only.length && !only.includes(name)) continue;
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/${name}/`, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector(".hb-lay .hb-gauge, .hb-lay tbody tr"), { timeout: 20000 });
    const checks = [...(await smoke(page)), [errors.length === 0, errors.length ? `page errors: ${errors.join("; ")}` : "no page errors"]];
    const ok = checks.every(([p]) => p);
    if (!ok) failed++;
    console.log(`smoke-views: ${name} ${ok ? "pass" : "fail"}`);
    for (const [p, why] of checks) console.log(`  ${p ? "ok  " : "FAIL"} ${why}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
  rmSync(profile, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
