// The eye in the system Chrome (headless, swiftshader): ID and depth renders,
// readback, grid integration and saliency on a colour frame. Chrome is
// found as the scenario runner finds it (HB_CHROME, macOS, Linux paths);
// skipped when none is found, and the README says when it last ran.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { describe, expect, it } from "vitest";
import { findChrome } from "../../scenario/src/chrome.js";

const CHROME = findChrome() ?? "";

describe.skipIf(!CHROME)("eye in chrome", () => {
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
      // instanced box at (-0.8, 0.2, 3), near face about 2.9 m away; skinned
      // box posed by its bone at (1.2, 0.2, 3.5), near face about 3.5 m away
      // (computed). A depth pass without instancing or skinning reads the
      // 12 m background or the bind pose instead.
      const inst = r.seen.find((s) => s.label === "instanced");
      const skin = r.seen.find((s) => s.label === "skinned");
      expect(inst?.dist).toBeGreaterThan(2.5);
      expect(inst?.dist).toBeLessThan(3.3);
      expect(skin?.dist).toBeGreaterThan(3.1);
      expect(skin?.dist).toBeLessThan(4.0);
      expect(r.wallCells).toBeGreaterThanOrEqual(2);
      expect(r.free).toBeGreaterThan(1);
      expect(r.asyncSeen).toBe(1);
      expect(r.materialsRestored).toBe(true);
      // before: each colorFrame made and disposed a render target (3 over
      // three calls), and a throw during the pass left the ID materials on
      // the scene
      expect(r.colorDisposals).toBe(0);
      expect(r.threw).toBe(true);
      expect(r.restoredAfterThrow).toBe(true);
      console.log(`eye in chrome: box ${box?.pixels} px at ${box?.dist.toFixed(2)} m, instanced ${inst?.pixels} px at ${inst?.dist.toFixed(2)} m, skinned ${skin?.pixels} px at ${skin?.dist.toFixed(2)} m, wall cells ${r.wallCells}, fixation ${JSON.stringify(r.fixation)} (measured)`);
    } finally {
      await browser.close();
    }
  }, 60000);

  it("loads every core single file build from file:// with no THREE on the page", async () => {
    // before: senses.iife.js bundled the eye and ended in `})({}, THREE)`,
    // so it threw ReferenceError on a page without THREE
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--allow-file-access-from-files"] });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(pathToFileURL(join(import.meta.dirname, "fixtures/iife.html")).href);
      await page.waitForFunction("window.__result", { timeout: 20000 });
      const r = (await page.evaluate("window.__result")) as Record<string, unknown>;
      expect(errors).toEqual([]);
      expect(r.error).toBeUndefined();
      expect(r.three).toBe("undefined");
      expect(r.tunables).toBe(1.5);
      expect(r.senses).toBe("saliency");
      expect(typeof r.drives).toBe("number");
      expect(r.mover).toBe("function");
      expect(r.cameras).toBe("function");
      expect(r.sensesThree).toBe("undefined");
    } finally {
      await browser.close();
    }
  }, 60000);
});
