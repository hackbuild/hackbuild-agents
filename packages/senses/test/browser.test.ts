// The eye in the system Chrome (headless, swiftshader): ID and depth renders,
// readback, grid integration and saliency on a colour frame. Skipped when
// Chrome is missing; the README says when it last ran.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { describe, expect, it } from "vitest";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

describe.skipIf(!existsSync(CHROME))("eye in chrome", () => {
  it("sees the tracked box at its distance and maps the wall", async () => {
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"] });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(pathToFileURL(join(import.meta.dirname, "fixtures/eye.html")).href);
      await page.waitForFunction("window.__result", { timeout: 20000 });
      const r = (await page.evaluate("window.__result")) as Record<string, unknown> & { seen: { label: string; dist: number; pixels: number }[] };
      expect(r.error).toBeUndefined();
      expect(errors).toEqual([]);
      const box = r.seen.find((s) => s.label === "box");
      expect(box).toBeDefined();
      // eye at (0, 0.6, 0), box face nearest the eye about 1.9 m away (computed)
      expect(box?.dist).toBeGreaterThan(1.6);
      expect(box?.dist).toBeLessThan(2.3);
      expect(r.wallCells).toBeGreaterThanOrEqual(2);
      expect(r.free).toBeGreaterThan(1);
      expect(r.asyncSeen).toBe(1);
      expect(r.materialsRestored).toBe(true);
      console.log(`eye in chrome: box ${box?.pixels} px at ${box?.dist.toFixed(2)} m, wall cells ${r.wallCells}, fixation ${JSON.stringify(r.fixation)} (measured)`);
    } finally {
      await browser.close();
    }
  }, 60000);
});
